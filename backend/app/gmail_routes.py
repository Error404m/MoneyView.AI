# app/gmail_routes.py

from fastapi import APIRouter, Query
from googleapiclient.discovery import build
from app.gmail_fetcher import get_user_credentials

import base64
import io
from PyPDF2 import PdfReader

from fastapi import HTTPException

from pathlib import Path
from fastapi.responses import FileResponse
from fastapi import Body
from fastapi.responses import Response
from PyPDF2 import PdfWriter
from datetime import datetime, date
import re

router = APIRouter()

def _try_read_pdf_bytes(file_bytes: bytes, password: str | None = None) -> tuple[bytes | None, bool]:
    """Attempt to read and (if needed) decrypt a PDF. Returns (pdf_bytes, password_required)."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            if password:
                if not reader.decrypt(password):
                    return None, True
            else:
                # Try defaults
                for candidate in ["MRIT2607", "mrit2607"]:
                    temp_reader = PdfReader(io.BytesIO(file_bytes))
                    if temp_reader.decrypt(candidate):
                        reader = temp_reader
                        break
                else:
                    return None, True
        # Write clear bytes
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        out_stream = io.BytesIO()
        writer.write(out_stream)
        out_stream.seek(0)
        return out_stream.read(), False
    except Exception:
        return None, False

def _extract_text_from_pdf_bytes(pdf_bytes: bytes, max_pages: int = 3) -> str:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for idx, page in enumerate(reader.pages):
            if idx >= max_pages:
                break
            text += page.extract_text() or ""
        return text
    except Exception:
        return ""

# Amount patterns
_amount_core_pattern = r"(?:[₹Rr][sS]?\.?\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:Dr|Cr)?"
# Strict: must contain a comma group or a decimal
_amount_core_pattern_strict = r"(?:[₹Rr][sS]?\.?\s*)?((?:[0-9]{1,3}(?:,[0-9]{3})+)|(?:[0-9]+\.[0-9]{1,2}))\s*(?:Dr|Cr)?"

# Header-row based parsing for common statement layout
_date_token_pattern = r"(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}|\d{1,2}\s*[A-Za-z]{3,9}\s*\d{2,4}|[A-Za-z]{3,9}\s*\d{1,2},?\s*\d{2,4}|\d{4}[\-/]\d{1,2}[\-/]\d{1,2})"

# ---------- Replace the following functions in your file ----------

def _find_amounts_in_string(s: str, strict: bool = True) -> list[float]:
    """Return list of parsed amounts found in string s. strict=True prefers comma-grouped or decimal amounts."""
    strict_re = re.compile(r"(?:[₹Rr][sS]?\.?\s*)?((?:\d{1,3}(?:,\d{3})+)|\d+\.\d{1,2})\s*(?:Dr|Cr)?", re.IGNORECASE)
    loose_re = re.compile(r"(?:[₹Rr][sS]?\.?\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:Dr|Cr)?", re.IGNORECASE)
    regex = strict_re if strict else loose_re
    results = []
    for m in regex.finditer(s):
        amt = m.group(1)
        try:
            results.append(float(amt.replace(",", "")))
        except Exception:
            continue
    return results

def _parse_table_row_if_present(text: str) -> dict | None:
    """
    Try to detect a header row like:
      Total Amount Due | Minimum Payment Due | Payment Due Date
    and read the next block of lines to extract values.
    """
    lines = [ln.rstrip() for ln in text.splitlines()]
    for i, line in enumerate(lines):
        header = line.lower()
        # look for headers that include words for total & minimum & due date
        if ("total" in header and ("amount" in header or "payment" in header)) and ("minimum" in header or "min" in header) and ("due" in header):
            # take a small block after the header (some statements place values in the next 1-4 lines or columns)
            block_lines = []
            for j in range(i + 1, min(i + 6, len(lines))):
                if lines[j].strip() == "":
                    continue
                block_lines.append(lines[j])
            block = " ".join(block_lines)
            # strict amount extraction first
            amounts = _find_amounts_in_string(block, strict=True)
            if len(amounts) < 2:
                amounts = _find_amounts_in_string(block, strict=False)
            # extract dates in the block
            dates = [m.group(1) for m in re.finditer(_date_token_pattern, block)]
            total_due = None
            min_due = None
            due_dt = None
            if len(amounts) >= 1:
                total_due = amounts[0]
            if len(amounts) >= 2:
                min_due = amounts[1]
            # choose a sensible date candidate - often the payment due date is present in the block
            if dates:
                # prefer the last date in the block (often due date in rightmost column)
                cand = dates[-1]
                for fmt in [
                    "%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y",
                    "%d %b %Y", "%d %B %Y", "%b %d %Y", "%B %d %Y",
                    "%b %d, %Y", "%B %d, %Y", "%d %b, %Y", "%d %B, %Y",
                    "%Y-%m-%d", "%Y/%m/%d",
                ]:
                    try:
                        due_dt = datetime.strptime(cand, fmt)
                        break
                    except Exception:
                        continue
            if total_due is not None or min_due is not None or due_dt is not None:
                return {
                    "total_amount_due": total_due,
                    "minimum_amount_due": min_due,
                    "due_date": due_dt.strftime("%Y-%m-%d") if due_dt else None,
                }
    return None


def _extract_amount_near_label(text: str, label_variants: list[str]) -> float | None:
    """
    Improved approach:
    - Find a line matching the label.
    - Search the same line and the next up-to-5 lines for strict amounts first, then fallback to loose.
    - If nothing found, search the whole document for 'label' as inline pattern.
    - Final fallback: return the largest currency-like amount in the top portion of the doc.
    """
    lines = [ln for ln in text.splitlines()]
    n = len(lines)
    for label in label_variants:
        label_re = re.compile(rf"\b{label}\b", re.IGNORECASE)
        for i, ln in enumerate(lines):
            if label_re.search(ln):
                # scan this line + a small window below (accounts for column layout where value sits below header)
                window = " ".join(lines[i : min(i + 6, n)])  # current line + next 5 lines
                # strict first
                amounts = _find_amounts_in_string(window, strict=True)
                if not amounts:
                    amounts = _find_amounts_in_string(window, strict=False)
                if amounts:
                    return amounts[0]
                # also try a small window above (sometimes label and value are above/below)
                window_up = " ".join(lines[max(0, i - 3) : i + 1])
                amounts = _find_amounts_in_string(window_up, strict=True)
                if not amounts:
                    amounts = _find_amounts_in_string(window_up, strict=False)
                if amounts:
                    return amounts[0]
    # next try inline patterns (same-line patterns across the whole text)
    for label in label_variants:
        regex_line_strict = re.compile(rf"\b{label}\b\s*[:\-]?\s*{_amount_core_pattern_strict}", re.IGNORECASE)
        m = regex_line_strict.search(text)
        if m:
            try:
                return float(m.group(1).replace(",", ""))
            except Exception:
                pass
        regex_line_loose = re.compile(rf"\b{label}\b\s*[:\-]?\s*{_amount_core_pattern}", re.IGNORECASE)
        m2 = regex_line_loose.search(text)
        if m2:
            try:
                return float(m2.group(1).replace(",", ""))
            except Exception:
                pass
    # Final fallback: find the largest amount in the first 3000 chars (big printed totals are usually the largest value)
    head = text[:5000]  # limit
    all_amounts = _find_amounts_in_string(head, strict=False)
    if all_amounts:
        # return the largest sensible amount (likely the total)
        return max(all_amounts)
    return None


def _extract_date_near_label(text: str, label_variants: list[str]) -> datetime | None:
    """
    Look for the given label and then search a few lines around it for date tokens.
    Fall back to inline search.
    """
    lines = [ln for ln in text.splitlines()]
    n = len(lines)
    for label in label_variants:
        label_re = re.compile(rf"\b{label}\b", re.IGNORECASE)
        for i, ln in enumerate(lines):
            if label_re.search(ln):
                # search the line and nearby lines for date tokens
                window_lines = lines[max(0, i - 2) : min(n, i + 6)]
                window_text = " ".join(window_lines)
                m = re.search(_date_token_pattern, window_text)
                if m:
                    cand = m.group(1).strip()
                    for fmt in [
                        "%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y",
                        "%d %b %Y", "%d %B %Y", "%b %d %Y", "%B %d %Y",
                        "%b %d, %Y", "%B %d, %Y", "%d %b, %Y", "%d %B, %Y",
                        "%Y-%m-%d", "%Y/%m/%d",
                    ]:
                        try:
                            return datetime.strptime(cand, fmt)
                        except Exception:
                            continue
    # inline fallback
    m2 = re.search(rf"({'|'.join([re.escape(l) for l in label_variants])}).{{0,60}}{_date_token_pattern}", text, re.IGNORECASE)
    if m2:
        cand = m2.group(1).strip()
        # attempt parsing from the matched groups (m2.group(2) or similar)
        # safer: search for any date token in the entire doc and return the first plausible match
        mdate = re.search(_date_token_pattern, text)
        if mdate:
            cand = mdate.group(1)
            for fmt in [
                "%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y",
                "%d %b %Y", "%d %B %Y", "%b %d %Y", "%B %d %Y",
                "%b %d, %Y", "%B %d, %Y", "%d %b, %Y", "%d %B, %Y",
                "%Y-%m-%d", "%Y/%m/%d",
            ]:
                try:
                    return datetime.strptime(cand, fmt)
                except Exception:
                    continue
    return None

# ---------- End replacement code ----------


def _parse_credit_card_fields(text: str) -> dict:
    # First, try header-row mapping approach
    header_result = _parse_table_row_if_present(text)
    if header_result:
        total_due = header_result.get("total_amount_due")
        min_due = header_result.get("minimum_amount_due")
        due_dt_str = header_result.get("due_date")
        due_dt = datetime.strptime(due_dt_str, "%Y-%m-%d") if due_dt_str else None
    else:
        # Fallback to label-near parsing
        total_due = _extract_amount_near_label(text, [
            r"Total\s*Payment\s*Due",
            r"Total\s*Amount\s*Due",
            r"Amount\s*Due",
            r"Total\s*Due",
        ])
        min_due = _extract_amount_near_label(text, [
            r"Minimum\s*Payment\s*Due",
            r"Minimum\s*Amount\s*Due",
            r"Min\.?\s*Amt\.?\s*Due",
            r"Minimum\s*Due",
        ])
        # specifically target Payment Due Date; avoid Statement Period
        due_dt = _extract_date_near_label(text, [
            r"Payment\s*Due\s*Date",
            r"Due\s*Date"
        ])
    result = {
        "total_amount_due": total_due,
        "minimum_amount_due": min_due,
        "due_date": due_dt.strftime("%Y-%m-%d") if due_dt else (header_result.get("due_date") if header_result else None),
        "days_left": None
    }
    if (due_dt_str := result.get("due_date")):
        try:
            dt = datetime.strptime(due_dt_str, "%Y-%m-%d")
            result["days_left"] = (dt.date() - date.today()).days
        except Exception:
            pass
    return result

@router.get("/gmail/list-pdfs")
def list_pdf_attachments(user_email: str = Query(...)):
    """
    Lists Gmail messages with PDF attachments for a user and downloads them locally.
    Files are saved under downloads/{user_email}/ with message_id prefixed to avoid collisions.
    """
    creds = get_user_credentials(user_email)
    service = build('gmail', 'v1', credentials=creds)

    results = service.users().messages().list(
        userId='me',
        q="has:attachment filename:pdf"
    ).execute()

    messages = results.get('messages', [])
    pdfs = []

    # Prepare download directory per user
    user_dir_safe = user_email.replace("@", "_at_").replace("/", "_")
    download_dir = Path("downloads") / user_dir_safe
    download_dir.mkdir(parents=True, exist_ok=True)

    for msg in messages[:20]:  # Limit to latest 100
        msg_data = service.users().messages().get(userId='me', id=msg['id']).execute()
        subject = next((h["value"] for h in msg_data.get("payload", {}).get("headers", []) if h["name"] == "Subject"), "No Subject")
        for part in msg_data.get("payload", {}).get("parts", []):
            filename = part.get("filename")
            if filename and filename.lower().endswith(".pdf"):
                body = part.get("body", {})
                attachment_id = body.get("attachmentId")
                saved_path = None
                parsed_fields = {}
                password_required = False
                if attachment_id:
                    attachment = service.users().messages().attachments().get(
                        userId='me',
                        messageId=msg['id'],
                        id=attachment_id
                    ).execute()
                    try:
                        file_data = base64.urlsafe_b64decode(attachment.get("data", ""))
                        # Prefix with message id to avoid clashes
                        dest_path = download_dir / f"{msg['id']}_{filename}"
                        with open(dest_path, "wb") as f:
                            f.write(file_data)
                        saved_path = str(dest_path)
                        # If looks like credit card, attempt parsing
                        is_credit = (
                            ("credit" in subject.lower()) or
                            ("card" in subject.lower()) or
                            ("credit" in filename.lower())
                        )
                        if is_credit:
                            read_bytes, pw_required = _try_read_pdf_bytes(file_data)
                            password_required = pw_required
                            if read_bytes:
                                text = _extract_text_from_pdf_bytes(read_bytes)
                                parsed_fields = _parse_credit_card_fields(text)
                    except Exception:
                        saved_path = None

                pdfs.append({
                    "subject": subject,
                    "filename": filename,
                    "message_id": msg['id'],
                    "saved_path": saved_path,
                    **({"total_amount_due": parsed_fields.get("total_amount_due") if parsed_fields and parsed_fields.get("total_amount_due") is not None else 0} if is_credit else {}),
                    **({"minimum_amount_due": parsed_fields.get("minimum_amount_due") if parsed_fields and parsed_fields.get("minimum_amount_due") is not None else 0} if is_credit else {}),
                    **({"due_date": parsed_fields.get("due_date")} if is_credit and parsed_fields else {}),
                    **({"days_left": parsed_fields.get("days_left")} if is_credit and parsed_fields else {}),
                    **({"password_required": password_required} if is_credit and password_required else {}),
                })

    return {"pdf_attachments": pdfs}


@router.get("/gmail/download")
def download_saved_pdf(user_email: str = Query(...), message_id: str = Query(...), filename: str = Query(...)):
    """
    Returns a previously saved PDF attachment as a downloadable file.
    The file is expected at downloads/{sanitized_email}/{message_id}_{filename}.
    """
    user_dir_safe = user_email.replace("@", "_at_").replace("/", "_")
    file_path = Path("downloads") / user_dir_safe / f"{message_id}_{filename}"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=str(file_path), media_type="application/pdf", filename=filename)


@router.post("/gmail/preview")
def preview_pdf(payload: dict = Body(...)):
    """
    Returns the PDF bytes for inline preview. If the PDF is encrypted and a password is provided,
    it will be decrypted on-the-fly. If encrypted and password missing/wrong, returns 401.
    Expected JSON body: { user_email, message_id, filename, password? }
    """
    user_email = payload.get("user_email")
    message_id = payload.get("message_id")
    filename = payload.get("filename")
    password = payload.get("password")

    if not (user_email and message_id and filename):
        raise HTTPException(status_code=400, detail="Missing required fields")

    user_dir_safe = user_email.replace("@", "_at_").replace("/", "_")
    file_path = Path("downloads") / user_dir_safe / f"{message_id}_{filename}"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    try:
        # Helper to write decrypted bytes
        def write_pdf_bytes(pdf_reader: PdfReader) -> bytes:
            writer = PdfWriter()
            for page in pdf_reader.pages:
                writer.add_page(page)
            output_stream = io.BytesIO()
            writer.write(output_stream)
            output_stream.seek(0)
            return output_stream.read()

        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            # If no password provided, try common defaults first
            tried_candidates = []
            if not password:
                candidate_passwords = ["MRIT2607", "mrit2607"]
                for candidate in candidate_passwords:
                    temp_reader = PdfReader(io.BytesIO(file_bytes))
                    result = temp_reader.decrypt(candidate)
                    tried_candidates.append((candidate, result))
                    if result:
                        pdf_bytes = write_pdf_bytes(temp_reader)
                        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={filename}"})
                # None worked; ask for password
                raise HTTPException(status_code=401, detail="PASSWORD_REQUIRED")
            else:
                # Password was provided, validate it
                result = reader.decrypt(password)
                if not result:
                    raise HTTPException(status_code=401, detail="PASSWORD_INCORRECT")
                pdf_bytes = write_pdf_bytes(reader)
        else:
            pdf_bytes = file_bytes

        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={filename}"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gmail/download-parse-pdf")
def download_and_parse_pdf(user_email: str, message_id: str, password: str = None):
    creds = get_user_credentials(user_email)
    service = build('gmail', 'v1', credentials=creds)

    # Get full message
    msg = service.users().messages().get(userId='me', id=message_id).execute()
    parts = msg.get("payload", {}).get("parts", [])

    for part in parts:
        filename = part.get("filename", "")
        body = part.get("body", {})
        attachment_id = body.get("attachmentId")
        if not attachment_id:
            continue

        attachment = service.users().messages().attachments().get(
            userId='me',
            messageId=message_id,
            id=attachment_id
        ).execute()

        file_data = base64.urlsafe_b64decode(attachment["data"])

        try:
            pdf_stream = io.BytesIO(file_data)
            reader = PdfReader(pdf_stream)

            if reader.is_encrypted:
                if not password:
                    raise HTTPException(status_code=400, detail="PDF is encrypted. Please provide password.")
                reader.decrypt(password)

            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""

            return {
                "filename": filename,
                "parsed_text_snippet": text[:2000]  # First 2k chars
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=404, detail="No PDF attachment found.")

import re
import math
from datetime import datetime
from pdf2image import convert_from_bytes
import pytesseract
from pytesseract import Output
from PyPDF2 import PdfReader, PdfWriter
import io


def _merge_numbers(words):
    """Join adjacent tokens into combined numbers like '22,838.30'."""
    merged = []
    buffer = []
    for w in words:
        txt = w["text"]
        if re.match(r"^[0-9,\.]+$", txt):
            buffer.append(txt)
        else:
            if buffer:
                merged.append("".join(buffer))
                buffer = []
            merged.append(txt)
    if buffer:
        merged.append("".join(buffer))
    return merged

def _group_lines(words, y_tolerance=5):
    """Group OCR words into lines based on Y coordinate."""
    lines = {}
    for w in words:
        y = w["y"] // y_tolerance
        lines.setdefault(y, []).append(w)
    # sort words left-to-right within each line
    for y in lines:
        lines[y].sort(key=lambda w: w["x"])
    return list(lines.values())


def _merge_line_numbers(line_words):
    """Merge adjacent numeric tokens in a single line."""
    merged_tokens = []
    buffer = []
    for w in line_words:
        txt = w["text"]
        if re.match(r"^[0-9,\.]+$", txt):
            buffer.append(txt)
        else:
            if buffer:
                merged_tokens.append("".join(buffer))
                buffer = []
            merged_tokens.append(txt)
    if buffer:
        merged_tokens.append("".join(buffer))
    return merged_tokens


def _decrypt_pdf_bytes(file_bytes: bytes, password: str | None = None) -> bytes | None:
    """
    Try to decrypt PDF using provided password or common defaults.
    Returns decrypted PDF bytes, or None if unsuccessful.
    """
    def write_pdf_bytes(reader: PdfReader) -> bytes:
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        out_stream = io.BytesIO()
        writer.write(out_stream)
        return out_stream.getvalue()

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            # If password not provided, try common defaults
            candidate_passwords = [password] if password else ["MRIT2607", "mrit2607"]
            for candidate in candidate_passwords:
                if not candidate:
                    continue
                temp_reader = PdfReader(io.BytesIO(file_bytes))
                if temp_reader.decrypt(candidate):
                    return write_pdf_bytes(temp_reader)
            # None worked
            return None
        # Not encrypted
        return file_bytes
    except Exception:
        return None


# Improved regex patterns
_AMOUNT_RE = re.compile(r"(?:[₹Rs\.]?\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+\.[0-9]{1,2}|[0-9]+)")
_DATE_RE = re.compile(r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\s*\d{1,2},?\s*\d{2,4})\b")

# Enhanced bank-specific label dictionaries
LABELS = {
    "hdfc": {
        "total": ["total amount due", "total due", "amount payable", "total payment due"],
        "minimum": ["minimum amount due", "min due", "minimum payment due"],
        "duedate": ["due date", "payment due date"],
    },
    "icici": {
        "total": ["total amount due", "total amount", "total payment due"],
        "minimum": ["minimum amount due", "minimum payment", "minimum payment due"],
        "duedate": ["payment due date", "due date"],
    },
    "axis": {
        "total": ["total payment due", "amount payable", "total amount due"],
        "minimum": ["minimum payment due", "minimum due", "minimum amount due"],
        "duedate": ["payment due date", "due date"],
    },
    "generic": {
        "total": ["total amount due", "total due", "amount due", "total payment due", "amount payable"],
        "minimum": ["minimum amount due", "minimum due", "minimum payment due"],
        "duedate": ["due date", "payment due", "payment due date"],
    },
}


# ---------------- OCR utils ----------------
def _image_to_words(pil_img):
    data = pytesseract.image_to_data(pil_img, output_type=Output.DICT)
    words = []
    for i in range(len(data["text"])):
        txt = (data["text"][i] or "").strip()
        if not txt:
            continue
        # safe confidence parsing
        conf_val = -1
        try:
            conf_val = int(float(data["conf"][i]))
        except (ValueError, TypeError):
            pass

        w = {
            "text": txt,
            "x": int(data["left"][i]),
            "y": int(data["top"][i]),
            "w": int(data["width"][i]),
            "h": int(data["height"][i]),
            "conf": conf_val,
        }
        words.append(w)
    return words

def _center(b): return (b["x"] + b["w"] / 2, b["y"] + b["h"] / 2)
def _dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

# ---------------- Improved Table-based extractor ----------------
def _extract_from_payment_table(words):
    """Extract values directly from payment summary table structure with better precision."""
    results = {}
    
    # Group words by Y position (rows) with tighter tolerance for table cells
    lines = {}
    for w in words:
        y = w["y"] // 3  # Tighter grouping for table precision
        lines.setdefault(y, []).append(w)
    
    # Sort lines by Y position
    sorted_lines = sorted(lines.items())
    
    payment_summary_found = False
    in_payment_section = False
    
    for y_pos, line_words in sorted_lines:
        line_words.sort(key=lambda w: w["x"])
        line_text = " ".join(w["text"] for w in line_words).lower()
        
        # Detect payment summary section more precisely
        if "payment summary" in line_text:
            payment_summary_found = True
            in_payment_section = True
            print(f"✅ Found PAYMENT SUMMARY section at y={y_pos}")
            continue
            
        # Stop processing when we exit payment summary (e.g., hit "Account Summary")
        if in_payment_section and ("account summary" in line_text or "transaction details" in line_text):
            print(f"📍 Exiting payment summary section at: {line_text[:50]}...")
            break
            
        # Skip if we haven't found payment summary yet
        if not payment_summary_found:
            continue
            
        # Skip terms/conditions lines that contain keywords indicating they're not actual values
        skip_keywords = ["overdue", "penalty", "interest", "levied", "billing", "upto", "between", "if total"]
        if any(keyword in line_text for keyword in skip_keywords):
            continue
        
        # Look for table header patterns and extract values from structured layout
        
        # Pattern 1: Look for "Total Payment Due" header followed by amount
        if "total payment due" in line_text and "total_amount_due" not in results:
            print(f"🎯 Found 'total payment due' in: {line_text}")
            
            # Look for amounts in this line and nearby lines
            search_lines = [line_words]
            # Check next few lines for the actual values (table structure)
            for search_y, search_words in sorted_lines:
                if search_y > y_pos and search_y <= y_pos + 5:  # Look in next few rows
                    search_lines.append(search_words)
            
            best_amount = None
            best_score = 0
            
            for search_line in search_lines:
                for word in search_line:
                    text = word["text"]
                    # Look for amount with Dr suffix
                    if "Dr" in text:
                        amount_text = text.replace("Dr", "").strip()
                        match = _AMOUNT_RE.search(amount_text)
                        if match:
                            try:
                                amount_str = match.group(1).replace(",", "")
                                amount = float(amount_str)
                                
                                # Score based on amount size and position
                                score = amount
                                if amount > 1000:  # Prefer larger amounts for total due
                                    score += 10000
                                if amount > 10000:
                                    score += 20000
                                    
                                if score > best_score:
                                    best_score = score
                                    best_amount = amount
                                    print(f"  💰 Found total amount candidate: {text} -> {amount}")
                                    
                            except ValueError:
                                pass
            
            if best_amount:
                results["total_amount_due"] = best_amount
                print(f"✅ Extracted Total Payment Due: {best_amount}")
        
        # Pattern 2: Look for "Minimum Payment Due" header
        if "minimum payment due" in line_text and "minimum_amount_due" not in results:
            print(f"🎯 Found 'minimum payment due' in: {line_text}")
            
            search_lines = [line_words]
            for search_y, search_words in sorted_lines:
                if search_y > y_pos and search_y <= y_pos + 5:
                    search_lines.append(search_words)
            
            best_amount = None
            best_score = 0
            
            for search_line in search_lines:
                for word in search_line:
                    text = word["text"]
                    if "Dr" in text:
                        amount_text = text.replace("Dr", "").strip()
                        match = _AMOUNT_RE.search(amount_text)
                        if match:
                            try:
                                amount_str = match.group(1).replace(",", "")
                                amount = float(amount_str)
                                
                                # For minimum payment, prefer smaller reasonable amounts
                                score = amount
                                if 100 <= amount <= 10000:  # Reasonable range for minimum payment
                                    score += 5000
                                    
                                if score > best_score:
                                    best_score = score
                                    best_amount = amount
                                    print(f"  💰 Found minimum amount candidate: {text} -> {amount}")
                                    
                            except ValueError:
                                pass
            
            if best_amount:
                results["minimum_amount_due"] = best_amount
                print(f"✅ Extracted Minimum Payment Due: {best_amount}")
        
        # Pattern 3: Look for "Payment Due Date" 
        if ("payment due date" in line_text or "due date" in line_text) and "due_date" not in results:
            print(f"🎯 Found due date pattern in: {line_text}")
            
            search_lines = [line_words]
            for search_y, search_words in sorted_lines:
                if search_y > y_pos and search_y <= y_pos + 5:
                    search_lines.append(search_words)
            
            for search_line in search_lines:
                for word in search_line:
                    text = word["text"]
                    if _DATE_RE.search(text):
                        # Validate it looks like a reasonable due date
                        if len(text) >= 8:  # Should be at least DD/MM/YY format
                            results["due_date"] = text
                            print(f"✅ Found due date: {text}")
                            break
                if "due_date" in results:
                    break
    
    return results

# ---------------- Enhanced label-based extractor ----------------
def _is_terms_section(line_text):
    """Check if line is from terms and conditions (to be ignored)."""
    terms_keywords = [
        "overdue penalty", "late payment fee", "interest rate", "minimum amount due",
        "outstanding amount after the due date", "monthly billing", "terms and conditions",
        "interest will be charged", "please note", "charges applicable", "levied only",
        "reflected in the monthly", "amount less than the total", "upto rs", "between rs",
        "if total payment", "if total due", "calculation", "would result"
    ]
    line_lower = line_text.lower()
    return any(keyword in line_lower for keyword in terms_keywords)

def _find_nearest_value(words, labels, value_type, window_px=400):
    """Find nearest numeric/date to a label, avoiding terms sections."""
    # Group words into lines
    lines = {}
    for w in words:
        y = w["y"] // 8
        lines.setdefault(y, []).append(w)

    # Sort lines by Y position
    sorted_lines = sorted(lines.items())
    
    best_match = None
    best_score = 0
    in_payment_summary = False

    for y_pos, line_words in sorted_lines:
        line_words.sort(key=lambda w: w["x"])
        line_text = " ".join(w["text"] for w in line_words)
        line_text_lower = line_text.lower()
        
        # Track if we're in payment summary section
        if "payment summary" in line_text_lower:
            in_payment_summary = True
            print(f"📍 Entered payment summary section")
            continue
        elif "account summary" in line_text_lower or "transaction details" in line_text_lower:
            if in_payment_summary:
                print(f"📍 Exited payment summary section")
            in_payment_summary = False
            
        # Skip terms and conditions sections completely
        if _is_terms_section(line_text):
            print(f"⏭️  Skipping terms section: {line_text[:60]}...")
            continue

        # Look for label matches, but heavily prefer payment summary section
        for lab in labels:
            if lab.lower() in line_text_lower:
                print(f"🎯 Found label '{lab}' in line: {line_text}")
                
                # Heavy bonus for being in payment summary section
                section_bonus = 10000 if in_payment_summary else 0
                
                candidates = []
                for cand in line_words:
                    original_txt = cand["text"]
                    
                    if value_type in ["total", "minimum"]:
                        # Look for amounts with Dr suffix (preferred)
                        clean_txt = original_txt.replace("Dr", "").replace("Cr", "").strip()
                        m = _AMOUNT_RE.search(clean_txt)
                        if m:
                            try:
                                amount_str = m.group(1).replace(",", "")
                                val = float(amount_str)
                                
                                if val < 1.0:
                                    continue
                                    
                                score = section_bonus + val
                                
                                # Strong preference for Dr suffix
                                if "Dr" in original_txt:
                                    score += 5000
                                    
                                # For total amounts, prefer larger values
                                if value_type == "total" and val > 10000:
                                    score += 2000
                                elif value_type == "minimum" and 100 <= val <= 5000:
                                    score += 2000
                                    
                                candidates.append((score, val, original_txt))
                                print(f"  💰 Amount candidate: {original_txt} -> {val} (score: {score})")
                                
                            except ValueError:
                                pass
                                
                    elif value_type == "duedate":
                        if _DATE_RE.search(original_txt):
                            score = section_bonus + 100
                            candidates.append((score, original_txt, original_txt))
                            print(f"  📅 Date candidate: {original_txt} (score: {score})")

                if candidates:
                    candidates.sort(key=lambda x: -x[0])
                    best_candidate = candidates[0]
                    
                    if best_candidate[0] > best_score:
                        best_score = best_candidate[0]
                        best_match = best_candidate[1]
                        print(f"  ✅ New best match for {value_type}: {best_candidate[2]} -> {best_match}")

    return best_match


def _parse_date_string(date_str):
    """Enhanced date parsing with more formats."""
    if not date_str:
        return None
        
    # Clean the date string
    date_str = date_str.strip()
    
    # Try various date formats commonly found in credit card statements
    formats = [
        "%d/%m/%Y",     # 04/09/2025
        "%d-%m-%Y",     # 04-09-2025
        "%d/%m/%y",     # 04/09/25
        "%d-%m-%y",     # 04-09-25
        "%Y-%m-%d",     # 2025-09-04
        "%d %b %Y",     # 04 Sep 2025
        "%d %B %Y",     # 04 September 2025
        "%b %d, %Y",    # Sep 04, 2025
        "%B %d, %Y",    # September 04, 2025
        "%d %b, %Y",    # 04 Sep, 2025
        "%d %B, %Y",    # 04 September, 2025
    ]
    
    for fmt in formats:
        try:
            parsed_date = datetime.strptime(date_str, fmt)
            return parsed_date.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    print(f"❌ Could not parse date: {date_str}")
    return None


def extract_creditcard_data(file_bytes: bytes, bank_hint: str = "generic", password: str | None = None) -> dict:
    """Main entrypoint: Extracts total, minimum, due date from credit card PDF."""
    decrypted_bytes = _decrypt_pdf_bytes(file_bytes, password)
    if not decrypted_bytes:
        raise ValueError("PDF is encrypted. Please provide correct password.")
    
    results = {"total_amount_due": None, "minimum_amount_due": None, "due_date": None}
    
    try:
        pages = convert_from_bytes(decrypted_bytes, dpi=300)
    except Exception as e:
        print(f"❌ Error converting PDF to images: {e}")
        return results

    # Focus on first page where payment summary is typically located
    for page_num, page in enumerate(pages[:1]):  # Process first page only
        print(f"\n📄 Processing page {page_num + 1}...")
        
        try:
            words = _image_to_words(page)
            print(f"📝 Extracted {len(words)} words from page {page_num + 1}")
            
        except Exception as e:
            print(f"❌ Error extracting text from page {page_num + 1}: {e}")
            continue

        # Primary approach: Extract from payment table structure
        print(f"\n🔍 === Trying improved table-based extraction ===")
        table_results = _extract_from_payment_table(words)
        
        # Use table results if found
        for key, value in table_results.items():
            if value is not None:
                if key == "due_date":
                    parsed_date = _parse_date_string(value)
                    if parsed_date:
                        results["due_date"] = parsed_date
                        print(f"✅ Table extraction - Due date: {value} -> {parsed_date}")
                else:
                    results[key] = value
                    print(f"✅ Table extraction - {key}: {value}")

        # If we found the critical values, we're done
        if results["total_amount_due"] and results["minimum_amount_due"]:
            print("🎉 Successfully found all required payment amounts!")
            break

    # Fallback: only if we're missing critical values and have more pages
    missing_values = [k for k, v in results.items() if v is None]
    if missing_values and len(pages) > 1:
        print(f"\n🔄 === Fallback extraction for missing values: {missing_values} ===")
        
        try:
            page = pages[1]
            words = _image_to_words(page)
            print(f"📝 Extracted {len(words)} words from page 2")
            
            bank_labels = LABELS.get(bank_hint.lower(), LABELS["generic"])
            
            if not results["total_amount_due"]:
                total = _find_nearest_value(words, bank_labels["total"], "total")
                if total:
                    results["total_amount_due"] = total
                    print(f"✅ Fallback - Total: {total}")
                    
            if not results["minimum_amount_due"]:
                minimum = _find_nearest_value(words, bank_labels["minimum"], "minimum")
                if minimum:
                    results["minimum_amount_due"] = minimum
                    print(f"✅ Fallback - Minimum: {minimum}")
                    
            if not results["due_date"]:
                due_date = _find_nearest_value(words, bank_labels["duedate"], "duedate")
                if due_date:
                    parsed_date = _parse_date_string(due_date)
                    if parsed_date:
                        results["due_date"] = parsed_date
                        print(f"✅ Fallback - Due date: {due_date} -> {parsed_date}")
                        
        except Exception as e:
            print(f"❌ Error during fallback extraction: {e}")

    print(f"\n🎯 Final results: {results}")
    return results

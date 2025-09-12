# test_parser.py

from pathlib import Path
# from app.creditcard_parser import extract_creditcard_data
# jrb_test.py
from creditcard_parser import extract_creditcard_data   # ✅ no "app." prefix


pdf_path = Path("/Users/mrityunjay.tiwari/Desktop/MAHADEV/jrb_credit_card/backe/downloads/m.tiwari9889_at_gmail.com/198ae87f73fea86f_Credit Card Statement.pdf")

with open(pdf_path, "rb") as f:
    pdf_bytes = f.read()

# You can pass bank_hint="hdfc", "icici", or "generic"
result = extract_creditcard_data(pdf_bytes, bank_hint="generic")


# result = extract_creditcard_data(pdf_bytes, bank_hint="axis")
print("✅ Extracted Fields:", result)


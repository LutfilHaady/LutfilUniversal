import json

import anthropic
from dotenv import load_dotenv
from pydantic import ValidationError

from app.models.schemas import InvoiceData

load_dotenv()

_client = None

EXTRACTION_PROMPT = """Extract structured data from the following OCR-scanned invoice text.
Return ONLY valid JSON with exactly these fields:

{{
  "invoice_number": "string",
  "date": "string (YYYY-MM-DD)",
  "vendor_name": "string",
  "po_reference": "string or null if not found",
  "line_items": [
    {{
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "total": number
    }}
  ],
  "subtotal": number,
  "tax": number,
  "total": number
}}

If a field cannot be found in the text, use null for strings and 0.0 for numbers.
For line_items, extract every itemized line you can find with description, quantity, unit price, and line total.

OCR TEXT:
{ocr_text}"""


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def extract_invoice_from_text(ocr_text: str, max_retries: int = 2) -> InvoiceData:
    client = _get_client()
    prompt = EXTRACTION_PROMPT.format(ocr_text=ocr_text)
    last_error = None
    for attempt in range(max_retries):
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = message.content[0].text
        try:
            cleaned = raw_text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
            data = json.loads(cleaned)
            return InvoiceData(
                **data,
                ocr_source="",
                ocr_confidence=0.0,
            )
        except (json.JSONDecodeError, ValidationError) as e:
            last_error = e
            continue
    raise ValueError(f"Failed to extract invoice after {max_retries} attempts: {last_error}")

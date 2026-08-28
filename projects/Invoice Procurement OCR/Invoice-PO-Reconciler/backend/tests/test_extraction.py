import json
from unittest.mock import MagicMock, patch

import pytest
from app.extraction.llm_extractor import extract_invoice_from_text
from app.models.schemas import InvoiceData


MOCK_LLM_RESPONSE = json.dumps({
    "invoice_number": "INV-2024-001",
    "date": "2024-03-15",
    "vendor_name": "Industrial Supply Co",
    "po_reference": "PO-2024-001",
    "line_items": [
        {"description": "Safety Gloves", "quantity": 200, "unit_price": 50.0, "total": 10000.0},
        {"description": "Hard Hats", "quantity": 50, "unit_price": 25.0, "total": 1250.0},
    ],
    "subtotal": 11250.0,
    "tax": 787.50,
    "total": 12037.50,
})


@pytest.fixture
def mock_anthropic():
    mock_client = MagicMock()
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=MOCK_LLM_RESPONSE)]
    mock_client.messages.create.return_value = mock_message
    return mock_client


def test_extract_invoice_returns_invoice_data(mock_anthropic):
    with patch("app.extraction.llm_extractor._get_client", return_value=mock_anthropic):
        result = extract_invoice_from_text("Invoice Number: INV-2024-001\nTotal: $12037.50")
    assert isinstance(result, InvoiceData)
    assert result.invoice_number == "INV-2024-001"
    assert result.vendor_name == "Industrial Supply Co"
    assert len(result.line_items) == 2
    assert result.total == 12037.50


def test_extract_invoice_calls_claude_with_ocr_text(mock_anthropic):
    ocr_text = "Invoice Number: INV-2024-001\nTotal: $12037.50"
    with patch("app.extraction.llm_extractor._get_client", return_value=mock_anthropic):
        extract_invoice_from_text(ocr_text)
    call_args = mock_anthropic.messages.create.call_args
    prompt_content = call_args.kwargs["messages"][0]["content"]
    assert ocr_text in prompt_content


def test_extract_invoice_missing_po_reference(mock_anthropic):
    response_no_po = json.dumps({
        "invoice_number": "INV-002",
        "date": "2024-01-15",
        "vendor_name": "Acme Corp",
        "po_reference": None,
        "line_items": [
            {"description": "Widget", "quantity": 10, "unit_price": 2.0, "total": 20.0},
        ],
        "subtotal": 20.0,
        "tax": 1.40,
        "total": 21.40,
    })
    mock_anthropic.messages.create.return_value.content = [MagicMock(text=response_no_po)]
    with patch("app.extraction.llm_extractor._get_client", return_value=mock_anthropic):
        result = extract_invoice_from_text("Some OCR text without PO")
    assert result.po_reference is None


def test_extract_invoice_retries_on_invalid_json(mock_anthropic):
    bad_response = MagicMock()
    bad_response.content = [MagicMock(text="not valid json")]
    good_response = MagicMock()
    good_response.content = [MagicMock(text=MOCK_LLM_RESPONSE)]
    mock_anthropic.messages.create.side_effect = [bad_response, good_response]
    with patch("app.extraction.llm_extractor._get_client", return_value=mock_anthropic):
        result = extract_invoice_from_text("Some OCR text")
    assert isinstance(result, InvoiceData)
    assert mock_anthropic.messages.create.call_count == 2

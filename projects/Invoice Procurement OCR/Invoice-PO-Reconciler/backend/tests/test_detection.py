import json
from unittest.mock import MagicMock, patch

import pytest
from app.models.schemas import LineItem, InvoiceData, PurchaseOrderData, Discrepancy
from app.matching.exact import MatchedPair, MatchResult
from app.detection.checks import run_all_checks
from app.detection.materiality import classify_materiality

TOLERANCE = 0.01


def _make_invoice(**overrides) -> InvoiceData:
    defaults = dict(
        invoice_number="INV-001",
        date="2024-03-15",
        vendor_name="Acme Corp",
        po_reference="PO-001",
        line_items=[LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)],
        subtotal=50.0,
        tax=3.50,
        total=53.50,
        ocr_source="paddleocr",
        ocr_confidence=0.9,
    )
    defaults.update(overrides)
    return InvoiceData(**defaults)


def _make_po(**overrides) -> PurchaseOrderData:
    defaults = dict(
        po_number="PO-001",
        date="2024-03-10",
        vendor_name="Acme Corp",
        line_items=[LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)],
        subtotal=50.0,
        tax=3.50,
        total=53.50,
    )
    defaults.update(overrides)
    return PurchaseOrderData(**defaults)


def _make_match_result(inv_items, po_items) -> MatchResult:
    matched = [
        MatchedPair(invoice_item=inv, po_item=po)
        for inv, po in zip(inv_items, po_items)
    ]
    return MatchResult(matched=matched, unmatched_invoice=[], unmatched_po=[])


# --- Price mismatch ---

def test_price_mismatch_detected():
    inv_item = LineItem(description="Widget", quantity=10, unit_price=8.0, total=80.0)
    po_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)
    invoice = _make_invoice(line_items=[inv_item], subtotal=80.0, tax=5.60, total=85.60)
    po = _make_po()
    match_result = _make_match_result([inv_item], [po_item])
    discs = run_all_checks(invoice, po, match_result, [])
    price_discs = [d for d in discs if d.type == "price_mismatch"]
    assert len(price_discs) == 1
    assert price_discs[0].invoice_value == "8.0"
    assert price_discs[0].po_value == "5.0"


def test_no_price_mismatch_when_equal():
    invoice = _make_invoice()
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    price_discs = [d for d in discs if d.type == "price_mismatch"]
    assert len(price_discs) == 0


# --- Quantity mismatch ---

def test_quantity_mismatch_detected():
    inv_item = LineItem(description="Widget", quantity=15, unit_price=5.0, total=75.0)
    po_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)
    invoice = _make_invoice(line_items=[inv_item], subtotal=75.0, tax=5.25, total=80.25)
    po = _make_po()
    match_result = _make_match_result([inv_item], [po_item])
    discs = run_all_checks(invoice, po, match_result, [])
    qty_discs = [d for d in discs if d.type == "quantity_mismatch"]
    assert len(qty_discs) == 1


# --- Missing PO reference ---

def test_missing_po_reference():
    invoice = _make_invoice(po_reference=None)
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    ref_discs = [d for d in discs if d.type == "missing_po_reference"]
    assert len(ref_discs) == 1


def test_wrong_po_reference():
    invoice = _make_invoice(po_reference="PO-999")
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    ref_discs = [d for d in discs if d.type == "missing_po_reference"]
    assert len(ref_discs) == 1


def test_correct_po_reference():
    invoice = _make_invoice(po_reference="PO-001")
    po = _make_po(po_number="PO-001")
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    ref_discs = [d for d in discs if d.type == "missing_po_reference"]
    assert len(ref_discs) == 0


# --- Duplicate invoice ---

def test_duplicate_invoice_same_number():
    invoice = _make_invoice(invoice_number="INV-001")
    seen = [_make_invoice(invoice_number="INV-001")]
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, seen)
    dup_discs = [d for d in discs if d.type == "duplicate_invoice"]
    assert len(dup_discs) == 1


def test_duplicate_invoice_same_vendor_total_date():
    invoice = _make_invoice(invoice_number="INV-002")
    seen = [_make_invoice(invoice_number="INV-999")]  # different number, same vendor+total+date
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, seen)
    dup_discs = [d for d in discs if d.type == "duplicate_invoice"]
    assert len(dup_discs) == 1


def test_no_duplicate_when_unique():
    invoice = _make_invoice()
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    dup_discs = [d for d in discs if d.type == "duplicate_invoice"]
    assert len(dup_discs) == 0


# --- Math/tax error ---

def test_math_error_bad_line_total():
    inv_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=60.0)  # should be 50
    invoice = _make_invoice(line_items=[inv_item], subtotal=60.0, tax=4.20, total=64.20)
    po = _make_po()
    match_result = _make_match_result([inv_item], po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    math_discs = [d for d in discs if d.type == "math_error"]
    assert len(math_discs) >= 1


def test_math_error_bad_subtotal():
    inv_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)
    invoice = _make_invoice(line_items=[inv_item], subtotal=55.0, tax=3.85, total=58.85)  # subtotal wrong
    po = _make_po()
    match_result = _make_match_result([inv_item], po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    math_discs = [d for d in discs if d.type == "math_error"]
    assert len(math_discs) >= 1


def test_no_math_error_when_correct():
    invoice = _make_invoice()
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    math_discs = [d for d in discs if d.type == "math_error"]
    assert len(math_discs) == 0


# --- Tolerance ---

def test_price_within_tolerance_not_flagged():
    inv_item = LineItem(description="Widget", quantity=10, unit_price=5.005, total=50.05)
    po_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)
    invoice = _make_invoice(line_items=[inv_item], subtotal=50.05, tax=3.50, total=53.55)
    po = _make_po()
    match_result = _make_match_result([inv_item], [po_item])
    discs = run_all_checks(invoice, po, match_result, [])
    price_discs = [d for d in discs if d.type == "price_mismatch"]
    assert len(price_discs) == 0


# --- Unmatched items ---

def test_extra_invoice_items_flagged():
    extra = LineItem(description="Surprise Item", quantity=1, unit_price=999, total=999)
    invoice = _make_invoice(line_items=[
        LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0), extra
    ])
    po = _make_po()
    match_result = MatchResult(
        matched=[MatchedPair(invoice_item=invoice.line_items[0], po_item=po.line_items[0])],
        unmatched_invoice=[extra],
        unmatched_po=[],
    )
    discs = run_all_checks(invoice, po, match_result, [])
    extra_discs = [d for d in discs if d.type == "extra_invoice_item"]
    assert len(extra_discs) == 1


def test_extra_po_items_flagged():
    po_extra = LineItem(description="Missing From Invoice", quantity=5, unit_price=20, total=100)
    invoice = _make_invoice()
    po = _make_po(line_items=[
        LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0), po_extra
    ])
    match_result = MatchResult(
        matched=[MatchedPair(invoice_item=invoice.line_items[0], po_item=po.line_items[0])],
        unmatched_invoice=[],
        unmatched_po=[po_extra],
    )
    discs = run_all_checks(invoice, po, match_result, [])
    extra_discs = [d for d in discs if d.type == "missing_invoice_item"]
    assert len(extra_discs) == 1


# --- Materiality classification ---

def test_classify_materiality():
    discs = [
        Discrepancy(
            type="price_mismatch", severity="unclassified", justification="",
            invoice_value="65.0", po_value="50.0", financial_impact=3000.0, line_item="Gloves",
        ),
    ]
    mock_response = json.dumps({
        "classifications": [
            {"index": 0, "severity": "material", "justification": "$15/unit overcharge on 200 units = $3,000"}
        ]
    })
    mock_client = MagicMock()
    mock_client.messages.create.return_value.content = [MagicMock(text=mock_response)]

    with patch("app.detection.materiality._get_client", return_value=mock_client):
        result = classify_materiality(discs)

    assert len(result) == 1
    assert result[0].severity == "material"
    assert "3,000" in result[0].justification


def test_classify_materiality_empty_list():
    result = classify_materiality([])
    assert result == []

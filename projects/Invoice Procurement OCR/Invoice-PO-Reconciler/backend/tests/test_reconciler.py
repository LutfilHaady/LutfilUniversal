from unittest.mock import patch
from PIL import Image

import pytest
from app.models.schemas import (
    LineItem, InvoiceData, PurchaseOrderData, Discrepancy,
    ReconciliationResult,
)
from app.ocr import OcrResult, DualOcrResult
from app.matching.exact import MatchedPair, MatchResult
from app.services.reconciler import reconcile


MOCK_INVOICE_DATA = InvoiceData(
    invoice_number="INV-001",
    date="2024-03-15",
    vendor_name="Acme Corp",
    po_reference="PO-001",
    line_items=[LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)],
    subtotal=50.0,
    tax=3.50,
    total=53.50,
    ocr_source="paddleocr",
    ocr_confidence=0.91,
)


@pytest.fixture
def test_image():
    return Image.new("RGB", (100, 100), "white")


@pytest.fixture
def sample_po():
    return PurchaseOrderData(
        po_number="PO-001",
        date="2024-03-10",
        vendor_name="Acme Corp",
        line_items=[LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)],
        subtotal=50.0,
        tax=3.50,
        total=53.50,
    )


@patch("app.services.reconciler.classify_materiality", side_effect=lambda x: x)
@patch("app.services.reconciler.run_all_checks", return_value=[])
@patch("app.services.reconciler.match_fuzzy")
@patch("app.services.reconciler.match_exact")
@patch("app.services.reconciler.extract_invoice_from_text", return_value=MOCK_INVOICE_DATA)
@patch("app.services.reconciler.run_dual_ocr")
def test_reconcile_clean_pair(
    mock_ocr, mock_extract, mock_exact, mock_fuzzy, mock_checks, mock_mat,
    test_image, sample_po,
):
    mock_ocr.return_value = DualOcrResult(
        tesseract=OcrResult(text="invoice text", confidence=0.8),
        paddleocr=OcrResult(text="invoice text", confidence=0.9),
        best_source="paddleocr",
        best_text="invoice text",
    )
    mock_exact.return_value = MatchResult(
        matched=[MatchedPair(
            invoice_item=MOCK_INVOICE_DATA.line_items[0],
            po_item=sample_po.line_items[0],
        )],
        unmatched_invoice=[],
        unmatched_po=[],
    )
    mock_fuzzy.return_value = MatchResult(matched=[], unmatched_invoice=[], unmatched_po=[])

    result = reconcile(test_image, sample_po, [])

    assert isinstance(result, ReconciliationResult)
    assert result.invoice.invoice_number == "INV-001"
    assert result.purchase_order.po_number == "PO-001"
    assert len(result.discrepancies) == 0
    assert result.ocr_comparison is not None
    assert result.ocr_comparison.paddleocr_confidence == 0.9


@patch("app.services.reconciler.classify_materiality", side_effect=lambda x: x)
@patch("app.services.reconciler.run_all_checks")
@patch("app.services.reconciler.match_fuzzy")
@patch("app.services.reconciler.match_exact")
@patch("app.services.reconciler.extract_invoice_from_text", return_value=MOCK_INVOICE_DATA)
@patch("app.services.reconciler.run_dual_ocr")
def test_reconcile_with_discrepancies(
    mock_ocr, mock_extract, mock_exact, mock_fuzzy, mock_checks, mock_mat,
    test_image, sample_po,
):
    mock_ocr.return_value = DualOcrResult(
        tesseract=OcrResult(text="text", confidence=0.8),
        paddleocr=OcrResult(text="text", confidence=0.9),
        best_source="paddleocr",
        best_text="text",
    )
    mock_exact.return_value = MatchResult(
        matched=[MatchedPair(
            invoice_item=MOCK_INVOICE_DATA.line_items[0],
            po_item=sample_po.line_items[0],
        )],
        unmatched_invoice=[], unmatched_po=[],
    )
    mock_fuzzy.return_value = MatchResult(matched=[], unmatched_invoice=[], unmatched_po=[])
    mock_checks.return_value = [
        Discrepancy(
            type="price_mismatch", severity="unclassified", justification="",
            invoice_value="8.0", po_value="5.0", financial_impact=30.0, line_item="Widget",
        )
    ]

    result = reconcile(test_image, sample_po, [])

    assert len(result.discrepancies) == 1
    assert result.discrepancies[0].type == "price_mismatch"

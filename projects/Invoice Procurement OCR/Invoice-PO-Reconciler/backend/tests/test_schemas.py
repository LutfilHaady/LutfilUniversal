from app.models.schemas import (
    LineItem,
    InvoiceData,
    PurchaseOrderData,
    Discrepancy,
    OcrComparison,
    ReconciliationResult,
)


def test_line_item_creation():
    item = LineItem(
        description="Safety Gloves",
        quantity=100.0,
        unit_price=5.50,
        total=550.0,
    )
    assert item.description == "Safety Gloves"
    assert item.quantity == 100.0
    assert item.unit_price == 5.50
    assert item.total == 550.0


def test_invoice_data_with_po_reference():
    item = LineItem(description="Widget", quantity=10.0, unit_price=2.0, total=20.0)
    invoice = InvoiceData(
        invoice_number="INV-001",
        date="2024-01-15",
        vendor_name="Acme Corp",
        po_reference="PO-001",
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
        ocr_source="tesseract",
        ocr_confidence=0.85,
    )
    assert invoice.invoice_number == "INV-001"
    assert invoice.po_reference == "PO-001"
    assert len(invoice.line_items) == 1


def test_invoice_data_missing_po_reference():
    item = LineItem(description="Widget", quantity=10.0, unit_price=2.0, total=20.0)
    invoice = InvoiceData(
        invoice_number="INV-002",
        date="2024-01-15",
        vendor_name="Acme Corp",
        po_reference=None,
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
        ocr_source="paddleocr",
        ocr_confidence=0.92,
    )
    assert invoice.po_reference is None


def test_purchase_order_data():
    item = LineItem(description="Widget", quantity=10.0, unit_price=2.0, total=20.0)
    po = PurchaseOrderData(
        po_number="PO-001",
        date="2024-01-10",
        vendor_name="Acme Corp",
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
    )
    assert po.po_number == "PO-001"


def test_discrepancy():
    d = Discrepancy(
        type="price_mismatch",
        severity="material",
        justification="$15/unit overcharge on 200 units",
        invoice_value="65.00",
        po_value="50.00",
        financial_impact=3000.0,
        line_item="Safety Gloves",
    )
    assert d.type == "price_mismatch"
    assert d.severity == "material"
    assert d.financial_impact == 3000.0


def test_discrepancy_no_line_item():
    d = Discrepancy(
        type="missing_po_reference",
        severity="critical",
        justification="No PO number on invoice",
        invoice_value="N/A",
        po_value="N/A",
        financial_impact=0.0,
        line_item=None,
    )
    assert d.line_item is None


def test_ocr_comparison():
    comp = OcrComparison(
        tesseract_confidence=0.82,
        paddleocr_confidence=0.91,
        field_agreement={"invoice_number": True, "total": True, "vendor_name": False},
    )
    assert comp.paddleocr_confidence > comp.tesseract_confidence
    assert comp.field_agreement["invoice_number"] is True
    assert comp.field_agreement["vendor_name"] is False


def test_reconciliation_result():
    item = LineItem(description="Widget", quantity=10.0, unit_price=2.0, total=20.0)
    invoice = InvoiceData(
        invoice_number="INV-001",
        date="2024-01-15",
        vendor_name="Acme Corp",
        po_reference="PO-001",
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
        ocr_source="tesseract",
        ocr_confidence=0.85,
    )
    po = PurchaseOrderData(
        po_number="PO-001",
        date="2024-01-10",
        vendor_name="Acme Corp",
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
    )
    result = ReconciliationResult(
        invoice=invoice,
        purchase_order=po,
        discrepancies=[],
        ocr_comparison=None,
    )
    assert len(result.discrepancies) == 0
    assert result.ocr_comparison is None

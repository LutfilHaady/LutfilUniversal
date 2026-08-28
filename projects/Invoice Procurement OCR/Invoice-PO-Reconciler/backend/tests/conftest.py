import pytest
from app.models.schemas import LineItem, InvoiceData, PurchaseOrderData


@pytest.fixture
def sample_line_items():
    return [
        LineItem(description="Safety Gloves", quantity=200.0, unit_price=50.0, total=10000.0),
        LineItem(description="Hard Hats", quantity=50.0, unit_price=25.0, total=1250.0),
    ]


@pytest.fixture
def sample_invoice(sample_line_items):
    return InvoiceData(
        invoice_number="INV-2024-001",
        date="2024-03-15",
        vendor_name="Industrial Supply Co",
        po_reference="PO-2024-001",
        line_items=sample_line_items,
        subtotal=11250.0,
        tax=787.50,
        total=12037.50,
        ocr_source="paddleocr",
        ocr_confidence=0.91,
    )


@pytest.fixture
def sample_po(sample_line_items):
    return PurchaseOrderData(
        po_number="PO-2024-001",
        date="2024-03-10",
        vendor_name="Industrial Supply Co",
        line_items=sample_line_items,
        subtotal=11250.0,
        tax=787.50,
        total=12037.50,
    )

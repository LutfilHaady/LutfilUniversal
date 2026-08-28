from pydantic import BaseModel


class LineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total: float


class InvoiceData(BaseModel):
    invoice_number: str
    date: str
    vendor_name: str
    po_reference: str | None
    line_items: list[LineItem]
    subtotal: float
    tax: float
    total: float
    ocr_source: str
    ocr_confidence: float


class PurchaseOrderData(BaseModel):
    po_number: str
    date: str
    vendor_name: str
    line_items: list[LineItem]
    subtotal: float
    tax: float
    total: float


class Discrepancy(BaseModel):
    type: str
    severity: str
    justification: str
    invoice_value: str
    po_value: str
    financial_impact: float
    line_item: str | None


class OcrComparison(BaseModel):
    tesseract_confidence: float
    paddleocr_confidence: float
    field_agreement: dict[str, bool]


class ReconciliationResult(BaseModel):
    invoice: InvoiceData
    purchase_order: PurchaseOrderData
    discrepancies: list[Discrepancy]
    ocr_comparison: OcrComparison | None

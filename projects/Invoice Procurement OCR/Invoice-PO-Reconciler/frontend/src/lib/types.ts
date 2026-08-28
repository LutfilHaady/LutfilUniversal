export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface InvoiceData {
  invoice_number: string;
  date: string;
  vendor_name: string;
  po_reference: string | null;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  ocr_source: string;
  ocr_confidence: number;
}

export interface PurchaseOrderData {
  po_number: string;
  date: string;
  vendor_name: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface Discrepancy {
  type: string;
  severity: string;
  justification: string;
  invoice_value: string;
  po_value: string;
  financial_impact: number;
  line_item: string | null;
}

export interface OcrComparison {
  tesseract_confidence: number;
  paddleocr_confidence: number;
  field_agreement: Record<string, boolean>;
}

export interface ReconciliationResult {
  invoice: InvoiceData;
  purchase_order: PurchaseOrderData;
  discrepancies: Discrepancy[];
  ocr_comparison: OcrComparison | null;
}

export interface PresetOption {
  id: string;
  label: string;
  description: string;
}

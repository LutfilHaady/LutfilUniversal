from PIL import Image

from app.models.schemas import (
    InvoiceData, PurchaseOrderData, OcrComparison, ReconciliationResult,
)
from app.ocr.compare import run_dual_ocr
from app.extraction.llm_extractor import extract_invoice_from_text
from app.matching.exact import match_exact, MatchResult
from app.matching.fuzzy import match_fuzzy
from app.detection.checks import run_all_checks
from app.detection.materiality import classify_materiality


def reconcile(
    invoice_image: Image.Image,
    po: PurchaseOrderData,
    seen_invoices: list[InvoiceData],
) -> ReconciliationResult:
    dual_ocr = run_dual_ocr(invoice_image)

    tess_invoice = extract_invoice_from_text(dual_ocr.tesseract.text)
    tess_invoice = tess_invoice.model_copy(update={
        "ocr_source": "tesseract",
        "ocr_confidence": dual_ocr.tesseract.confidence,
    })

    paddle_invoice = extract_invoice_from_text(dual_ocr.paddleocr.text)
    paddle_invoice = paddle_invoice.model_copy(update={
        "ocr_source": "paddleocr",
        "ocr_confidence": dual_ocr.paddleocr.confidence,
    })

    field_agreement = {}
    for field in ["invoice_number", "date", "vendor_name", "po_reference", "subtotal", "tax", "total"]:
        field_agreement[field] = getattr(tess_invoice, field) == getattr(paddle_invoice, field)

    ocr_comparison = OcrComparison(
        tesseract_confidence=dual_ocr.tesseract.confidence,
        paddleocr_confidence=dual_ocr.paddleocr.confidence,
        field_agreement=field_agreement,
    )

    invoice = paddle_invoice if dual_ocr.best_source == "paddleocr" else tess_invoice

    exact_result = match_exact(invoice.line_items, po.line_items)

    fuzzy_result = match_fuzzy(exact_result.unmatched_invoice, exact_result.unmatched_po)

    combined = MatchResult(
        matched=exact_result.matched + fuzzy_result.matched,
        unmatched_invoice=fuzzy_result.unmatched_invoice,
        unmatched_po=fuzzy_result.unmatched_po,
    )

    discrepancies = run_all_checks(invoice, po, combined, seen_invoices)

    if discrepancies:
        discrepancies = classify_materiality(discrepancies)

    return ReconciliationResult(
        invoice=invoice,
        purchase_order=po,
        discrepancies=discrepancies,
        ocr_comparison=ocr_comparison,
    )

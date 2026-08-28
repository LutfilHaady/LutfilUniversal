from app.models.schemas import InvoiceData, PurchaseOrderData, Discrepancy
from app.matching.exact import MatchResult

TOLERANCE = 0.01


def _approx_eq(a: float, b: float) -> bool:
    return abs(a - b) <= TOLERANCE


def _check_price_mismatches(match_result: MatchResult) -> list[Discrepancy]:
    discs = []
    for pair in match_result.matched:
        if not _approx_eq(pair.invoice_item.unit_price, pair.po_item.unit_price):
            impact = abs(pair.invoice_item.unit_price - pair.po_item.unit_price) * pair.invoice_item.quantity
            discs.append(Discrepancy(
                type="price_mismatch",
                severity="unclassified",
                justification="",
                invoice_value=str(pair.invoice_item.unit_price),
                po_value=str(pair.po_item.unit_price),
                financial_impact=round(impact, 2),
                line_item=pair.invoice_item.description,
            ))
    return discs


def _check_quantity_mismatches(match_result: MatchResult) -> list[Discrepancy]:
    discs = []
    for pair in match_result.matched:
        if not _approx_eq(pair.invoice_item.quantity, pair.po_item.quantity):
            impact = abs(pair.invoice_item.quantity - pair.po_item.quantity) * pair.po_item.unit_price
            discs.append(Discrepancy(
                type="quantity_mismatch",
                severity="unclassified",
                justification="",
                invoice_value=str(pair.invoice_item.quantity),
                po_value=str(pair.po_item.quantity),
                financial_impact=round(impact, 2),
                line_item=pair.invoice_item.description,
            ))
    return discs


def _check_missing_po_reference(
    invoice: InvoiceData, po: PurchaseOrderData
) -> list[Discrepancy]:
    if invoice.po_reference is None or invoice.po_reference != po.po_number:
        return [Discrepancy(
            type="missing_po_reference",
            severity="unclassified",
            justification="",
            invoice_value=str(invoice.po_reference),
            po_value=po.po_number,
            financial_impact=0.0,
            line_item=None,
        )]
    return []


def _check_duplicate_invoice(
    invoice: InvoiceData, seen_invoices: list[InvoiceData]
) -> list[Discrepancy]:
    for seen in seen_invoices:
        same_number = invoice.invoice_number == seen.invoice_number
        same_tuple = (
            invoice.vendor_name == seen.vendor_name
            and _approx_eq(invoice.total, seen.total)
            and invoice.date == seen.date
        )
        if same_number or same_tuple:
            return [Discrepancy(
                type="duplicate_invoice",
                severity="unclassified",
                justification="",
                invoice_value=invoice.invoice_number,
                po_value=f"matches {seen.invoice_number}",
                financial_impact=invoice.total,
                line_item=None,
            )]
    return []


def _check_math_errors(invoice: InvoiceData) -> list[Discrepancy]:
    discs = []
    for item in invoice.line_items:
        expected = round(item.quantity * item.unit_price, 2)
        if not _approx_eq(item.total, expected):
            discs.append(Discrepancy(
                type="math_error",
                severity="unclassified",
                justification="",
                invoice_value=f"line total {item.total}",
                po_value=f"expected {expected}",
                financial_impact=abs(item.total - expected),
                line_item=item.description,
            ))
    line_sum = round(sum(item.total for item in invoice.line_items), 2)
    if not _approx_eq(invoice.subtotal, line_sum):
        discs.append(Discrepancy(
            type="math_error",
            severity="unclassified",
            justification="",
            invoice_value=f"subtotal {invoice.subtotal}",
            po_value=f"expected {line_sum}",
            financial_impact=abs(invoice.subtotal - line_sum),
            line_item=None,
        ))
    expected_total = round(invoice.subtotal + invoice.tax, 2)
    if not _approx_eq(invoice.total, expected_total):
        discs.append(Discrepancy(
            type="math_error",
            severity="unclassified",
            justification="",
            invoice_value=f"total {invoice.total}",
            po_value=f"expected {expected_total}",
            financial_impact=abs(invoice.total - expected_total),
            line_item=None,
        ))
    return discs


def _check_unmatched_items(match_result: MatchResult) -> list[Discrepancy]:
    discs = []
    for item in match_result.unmatched_invoice:
        discs.append(Discrepancy(
            type="extra_invoice_item",
            severity="unclassified",
            justification="",
            invoice_value=item.description,
            po_value="not on PO",
            financial_impact=item.total,
            line_item=item.description,
        ))
    for item in match_result.unmatched_po:
        discs.append(Discrepancy(
            type="missing_invoice_item",
            severity="unclassified",
            justification="",
            invoice_value="not on invoice",
            po_value=item.description,
            financial_impact=item.total,
            line_item=item.description,
        ))
    return discs


def run_all_checks(
    invoice: InvoiceData,
    po: PurchaseOrderData,
    match_result: MatchResult,
    seen_invoices: list[InvoiceData],
) -> list[Discrepancy]:
    discs = []
    discs.extend(_check_price_mismatches(match_result))
    discs.extend(_check_quantity_mismatches(match_result))
    discs.extend(_check_missing_po_reference(invoice, po))
    discs.extend(_check_duplicate_invoice(invoice, seen_invoices))
    discs.extend(_check_math_errors(invoice))
    discs.extend(_check_unmatched_items(match_result))
    return discs

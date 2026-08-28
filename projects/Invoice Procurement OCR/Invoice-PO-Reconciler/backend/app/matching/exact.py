import re

from pydantic import BaseModel

from app.models.schemas import LineItem


class MatchedPair(BaseModel):
    invoice_item: LineItem
    po_item: LineItem


class MatchResult(BaseModel):
    matched: list[MatchedPair]
    unmatched_invoice: list[LineItem]
    unmatched_po: list[LineItem]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def match_exact(
    invoice_items: list[LineItem], po_items: list[LineItem]
) -> MatchResult:
    matched = []
    used_po_indices: set[int] = set()
    unmatched_invoice = []

    for inv_item in invoice_items:
        inv_norm = _normalize(inv_item.description)
        found = False
        for j, po_item in enumerate(po_items):
            if j in used_po_indices:
                continue
            if _normalize(po_item.description) == inv_norm:
                matched.append(MatchedPair(invoice_item=inv_item, po_item=po_item))
                used_po_indices.add(j)
                found = True
                break
        if not found:
            unmatched_invoice.append(inv_item)

    unmatched_po = [
        po_items[j] for j in range(len(po_items)) if j not in used_po_indices
    ]

    return MatchResult(
        matched=matched,
        unmatched_invoice=unmatched_invoice,
        unmatched_po=unmatched_po,
    )

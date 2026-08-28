import json

import anthropic
from dotenv import load_dotenv

from app.models.schemas import LineItem
from app.matching.exact import MatchedPair, MatchResult, match_exact

load_dotenv()

_client = None

FUZZY_MATCH_PROMPT = """You are comparing line items from an invoice (OCR-extracted, may have typos) against line items from a purchase order (structured, clean).

Determine which invoice items match which PO items based on their descriptions referring to the same product/service.

Invoice items:
{invoice_items}

PO items:
{po_items}

Return ONLY valid JSON:
{{
  "matches": [
    {{"invoice_index": 0, "po_index": 0, "confidence": 0.95}}
  ]
}}

Rules:
- confidence must be 0.0 to 1.0
- Only include matches where you're reasonably confident (>= 0.5) the items refer to the same thing
- Each invoice_index and po_index can appear at most once
- If no matches are found, return {{"matches": []}}"""

CONFIDENCE_THRESHOLD = 0.5


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def match_fuzzy(
    unmatched_invoice: list[LineItem], unmatched_po: list[LineItem]
) -> MatchResult:
    if not unmatched_invoice or not unmatched_po:
        return MatchResult(
            matched=[], unmatched_invoice=unmatched_invoice, unmatched_po=unmatched_po
        )

    client = _get_client()
    inv_desc = "\n".join(
        f"  [{i}] {item.description}" for i, item in enumerate(unmatched_invoice)
    )
    po_desc = "\n".join(
        f"  [{i}] {item.description}" for i, item in enumerate(unmatched_po)
    )
    prompt = FUZZY_MATCH_PROMPT.format(invoice_items=inv_desc, po_items=po_desc)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]

    data = json.loads(raw)
    matched = []
    used_inv: set[int] = set()
    used_po: set[int] = set()

    for m in data.get("matches", []):
        inv_idx = m["invoice_index"]
        po_idx = m["po_index"]
        conf = m["confidence"]
        if conf >= CONFIDENCE_THRESHOLD and inv_idx not in used_inv and po_idx not in used_po:
            matched.append(
                MatchedPair(
                    invoice_item=unmatched_invoice[inv_idx],
                    po_item=unmatched_po[po_idx],
                )
            )
            used_inv.add(inv_idx)
            used_po.add(po_idx)

    remaining_inv = [item for i, item in enumerate(unmatched_invoice) if i not in used_inv]
    remaining_po = [item for i, item in enumerate(unmatched_po) if i not in used_po]

    return MatchResult(
        matched=matched, unmatched_invoice=remaining_inv, unmatched_po=remaining_po
    )


def match_line_items(
    invoice_items: list[LineItem], po_items: list[LineItem]
) -> MatchResult:
    """
    Run exact matching first, then fuzzy matching on the unmatched items.

    Args:
        invoice_items: Line items from the invoice
        po_items: Line items from the PO

    Returns:
        MatchResult with all matched pairs and remaining unmatched items
    """
    exact_result = match_exact(invoice_items, po_items)
    fuzzy_result = match_fuzzy(exact_result.unmatched_invoice, exact_result.unmatched_po)

    return MatchResult(
        matched=exact_result.matched + fuzzy_result.matched,
        unmatched_invoice=fuzzy_result.unmatched_invoice,
        unmatched_po=fuzzy_result.unmatched_po,
    )

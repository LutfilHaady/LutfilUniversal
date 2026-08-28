import json

import anthropic
from dotenv import load_dotenv

from app.models.schemas import Discrepancy

load_dotenv()

_client = None

MATERIALITY_PROMPT = """You are classifying invoice-vs-purchase-order discrepancies by financial materiality.

For each discrepancy below, assign a severity and a one-line justification.

Severity levels:
- cosmetic: trivial difference with no financial impact (e.g., rounding by a few cents)
- minor: small financial impact, likely a clerical error (< $100)
- material: significant financial impact that needs review ($100-$5,000 or >5% deviation)
- critical: large financial impact or fraud indicator (> $5,000 or suspicious pattern)

Discrepancies:
{discrepancies}

Return ONLY valid JSON:
{{
  "classifications": [
    {{"index": 0, "severity": "material", "justification": "one line explanation"}}
  ]
}}"""


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def classify_materiality(discrepancies: list[Discrepancy]) -> list[Discrepancy]:
    if not discrepancies:
        return []

    client = _get_client()
    disc_text = "\n".join(
        f"  [{i}] type={d.type}, invoice_value={d.invoice_value}, "
        f"po_value={d.po_value}, financial_impact=${d.financial_impact:.2f}, "
        f"line_item={d.line_item}"
        for i, d in enumerate(discrepancies)
    )
    prompt = MATERIALITY_PROMPT.format(discrepancies=disc_text)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]

    data = json.loads(raw)
    result = []
    classifications = {c["index"]: c for c in data["classifications"]}

    for i, disc in enumerate(discrepancies):
        if i in classifications:
            c = classifications[i]
            result.append(disc.model_copy(update={
                "severity": c["severity"],
                "justification": c["justification"],
            }))
        else:
            result.append(disc)

    return result

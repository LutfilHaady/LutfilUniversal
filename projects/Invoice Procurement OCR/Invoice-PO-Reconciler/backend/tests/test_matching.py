import json
from unittest.mock import MagicMock, patch

import pytest
from app.models.schemas import LineItem
from app.matching.exact import match_exact, MatchedPair, MatchResult
from app.matching.fuzzy import match_fuzzy


def test_exact_match_identical_descriptions():
    inv_items = [
        LineItem(description="Safety Gloves", quantity=200, unit_price=50, total=10000),
        LineItem(description="Hard Hats", quantity=50, unit_price=25, total=1250),
    ]
    po_items = [
        LineItem(description="Safety Gloves", quantity=200, unit_price=50, total=10000),
        LineItem(description="Hard Hats", quantity=50, unit_price=25, total=1250),
    ]
    result = match_exact(inv_items, po_items)
    assert len(result.matched) == 2
    assert len(result.unmatched_invoice) == 0
    assert len(result.unmatched_po) == 0


def test_exact_match_case_insensitive():
    inv_items = [LineItem(description="safety gloves", quantity=200, unit_price=50, total=10000)]
    po_items = [LineItem(description="Safety Gloves", quantity=200, unit_price=50, total=10000)]
    result = match_exact(inv_items, po_items)
    assert len(result.matched) == 1


def test_exact_match_whitespace_normalized():
    inv_items = [LineItem(description="  Safety   Gloves  ", quantity=200, unit_price=50, total=10000)]
    po_items = [LineItem(description="Safety Gloves", quantity=200, unit_price=50, total=10000)]
    result = match_exact(inv_items, po_items)
    assert len(result.matched) == 1


def test_exact_match_partial_match():
    inv_items = [
        LineItem(description="Safety Gloves", quantity=200, unit_price=50, total=10000),
        LineItem(description="Fire Extinguisher", quantity=5, unit_price=100, total=500),
    ]
    po_items = [
        LineItem(description="Safety Gloves", quantity=200, unit_price=50, total=10000),
        LineItem(description="First Aid Kit", quantity=10, unit_price=30, total=300),
    ]
    result = match_exact(inv_items, po_items)
    assert len(result.matched) == 1
    assert result.matched[0].invoice_item.description == "Safety Gloves"
    assert len(result.unmatched_invoice) == 1
    assert result.unmatched_invoice[0].description == "Fire Extinguisher"
    assert len(result.unmatched_po) == 1
    assert result.unmatched_po[0].description == "First Aid Kit"


def test_exact_match_no_matches():
    inv_items = [LineItem(description="Widget A", quantity=10, unit_price=5, total=50)]
    po_items = [LineItem(description="Widget B", quantity=10, unit_price=5, total=50)]
    result = match_exact(inv_items, po_items)
    assert len(result.matched) == 0
    assert len(result.unmatched_invoice) == 1
    assert len(result.unmatched_po) == 1


def test_exact_match_different_values_still_matches():
    """Exact matching is on description only. Price/qty differences are for detection, not matching."""
    inv_items = [LineItem(description="Safety Gloves", quantity=300, unit_price=65, total=19500)]
    po_items = [LineItem(description="Safety Gloves", quantity=200, unit_price=50, total=10000)]
    result = match_exact(inv_items, po_items)
    assert len(result.matched) == 1


def test_fuzzy_match_calls_claude():
    inv_items = [LineItem(description="Sfety Glovs", quantity=200, unit_price=50, total=10000)]
    po_items = [LineItem(description="Safety Gloves", quantity=200, unit_price=50, total=10000)]

    mock_response = json.dumps({
        "matches": [{"invoice_index": 0, "po_index": 0, "confidence": 0.9}]
    })
    mock_client = MagicMock()
    mock_client.messages.create.return_value.content = [MagicMock(text=mock_response)]

    with patch("app.matching.fuzzy._get_client", return_value=mock_client):
        result = match_fuzzy(inv_items, po_items)

    assert len(result.matched) == 1
    assert len(result.unmatched_invoice) == 0
    assert len(result.unmatched_po) == 0


def test_fuzzy_match_low_confidence_stays_unmatched():
    inv_items = [LineItem(description="Random Item", quantity=1, unit_price=10, total=10)]
    po_items = [LineItem(description="Completely Different", quantity=1, unit_price=10, total=10)]

    mock_response = json.dumps({
        "matches": [{"invoice_index": 0, "po_index": 0, "confidence": 0.3}]
    })
    mock_client = MagicMock()
    mock_client.messages.create.return_value.content = [MagicMock(text=mock_response)]

    with patch("app.matching.fuzzy._get_client", return_value=mock_client):
        result = match_fuzzy(inv_items, po_items)

    assert len(result.matched) == 0
    assert len(result.unmatched_invoice) == 1
    assert len(result.unmatched_po) == 1

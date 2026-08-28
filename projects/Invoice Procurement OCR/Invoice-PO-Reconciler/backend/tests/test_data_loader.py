import json
from pathlib import Path

import pytest
from app.data_loader import load_po, load_ground_truth, PairConfig
from app.models.schemas import PurchaseOrderData


@pytest.fixture
def tmp_po_file(tmp_path):
    po_data = {
        "po_number": "PO-TEST-001",
        "date": "2024-01-10",
        "vendor_name": "Test Vendor",
        "line_items": [
            {"description": "Widget", "quantity": 10.0, "unit_price": 5.0, "total": 50.0}
        ],
        "subtotal": 50.0,
        "tax": 3.50,
        "total": 53.50,
    }
    po_file = tmp_path / "po_test.json"
    po_file.write_text(json.dumps(po_data))
    return po_file


@pytest.fixture
def tmp_ground_truth(tmp_path):
    gt = {
        "pairs": [
            {
                "id": "pair_001",
                "invoice": "invoices/inv_001.png",
                "po": "purchase_orders/po_001.json",
                "expected_discrepancies": [],
                "label": "Clean Match",
            },
            {
                "id": "pair_002",
                "invoice": "invoices/inv_002.png",
                "po": "purchase_orders/po_002.json",
                "expected_discrepancies": [
                    {
                        "type": "price_mismatch",
                        "line_item": "Widget",
                        "invoice_value": "10.0",
                        "po_value": "8.0",
                    }
                ],
                "label": "Price Mismatch",
            },
        ]
    }
    gt_file = tmp_path / "ground_truth.json"
    gt_file.write_text(json.dumps(gt))
    return gt_file


def test_load_po(tmp_po_file):
    po = load_po(tmp_po_file)
    assert isinstance(po, PurchaseOrderData)
    assert po.po_number == "PO-TEST-001"
    assert po.vendor_name == "Test Vendor"
    assert len(po.line_items) == 1
    assert po.line_items[0].description == "Widget"
    assert po.line_items[0].quantity == 10.0
    assert po.line_items[0].unit_price == 5.0
    assert po.total == 53.50


def test_load_po_missing_file():
    with pytest.raises(FileNotFoundError):
        load_po(Path("/nonexistent/po.json"))


def test_load_po_invalid_json(tmp_path):
    bad_file = tmp_path / "bad.json"
    bad_file.write_text("not valid json")
    with pytest.raises(json.JSONDecodeError):
        load_po(bad_file)


def test_load_ground_truth(tmp_ground_truth):
    pairs = load_ground_truth(tmp_ground_truth)
    assert len(pairs) == 2
    assert isinstance(pairs[0], PairConfig)
    assert pairs[0].id == "pair_001"
    assert pairs[0].invoice == "invoices/inv_001.png"
    assert pairs[0].po == "purchase_orders/po_001.json"
    assert pairs[0].label == "Clean Match"
    assert pairs[0].expected_discrepancies == []
    assert pairs[1].id == "pair_002"
    assert pairs[1].label == "Price Mismatch"
    assert len(pairs[1].expected_discrepancies) == 1
    assert pairs[1].expected_discrepancies[0]["type"] == "price_mismatch"


def test_load_ground_truth_empty_pairs(tmp_path):
    gt_file = tmp_path / "gt_empty.json"
    gt_file.write_text(json.dumps({"pairs": []}))
    pairs = load_ground_truth(gt_file)
    assert pairs == []


def test_pair_config_fields():
    """PairConfig exposes all expected fields."""
    pc = PairConfig(
        id="pair_test",
        invoice="invoices/test.png",
        po="purchase_orders/test.json",
        expected_discrepancies=[{"type": "math_error"}],
        label="Math Error",
    )
    assert pc.id == "pair_test"
    assert pc.invoice == "invoices/test.png"
    assert pc.po == "purchase_orders/test.json"
    assert pc.label == "Math Error"
    assert len(pc.expected_discrepancies) == 1

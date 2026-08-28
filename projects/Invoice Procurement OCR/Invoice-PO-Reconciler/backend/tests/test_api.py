import json
import io
from unittest.mock import patch, MagicMock
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.models.schemas import (
    LineItem, InvoiceData, PurchaseOrderData, ReconciliationResult, OcrComparison,
)


client = TestClient(app)

MOCK_RESULT = ReconciliationResult(
    invoice=InvoiceData(
        invoice_number="INV-001", date="2024-03-15", vendor_name="Acme",
        po_reference="PO-001",
        line_items=[LineItem(description="Widget", quantity=10, unit_price=5, total=50)],
        subtotal=50, tax=3.5, total=53.5, ocr_source="paddleocr", ocr_confidence=0.9,
    ),
    purchase_order=PurchaseOrderData(
        po_number="PO-001", date="2024-03-10", vendor_name="Acme",
        line_items=[LineItem(description="Widget", quantity=10, unit_price=5, total=50)],
        subtotal=50, tax=3.5, total=53.5,
    ),
    discrepancies=[],
    ocr_comparison=OcrComparison(
        tesseract_confidence=0.8, paddleocr_confidence=0.9,
        field_agreement={"invoice_number": True},
    ),
)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "tesseract" in data["ocr_engines"]
    assert "paddleocr" in data["ocr_engines"]


@patch("app.api.routes.reconcile", return_value=MOCK_RESULT)
@patch("app.api.routes.load_po")
def test_reconcile_upload(mock_load_po, mock_reconcile):
    mock_load_po.return_value = MOCK_RESULT.purchase_order

    img = Image.new("RGB", (100, 100), "white")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    img_bytes.seek(0)

    po_data = MOCK_RESULT.purchase_order.model_dump_json()

    resp = client.post(
        "/api/reconcile",
        files={
            "invoice": ("test.png", img_bytes, "image/png"),
            "po": ("po.json", po_data.encode(), "application/json"),
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["invoice"]["invoice_number"] == "INV-001"
    assert data["discrepancies"] == []


@patch("app.api.routes.load_ground_truth")
def test_get_presets(mock_gt, tmp_path):
    """Test GET /api/presets using tmp_path with a real ground_truth.json file."""
    from app.data_loader import PairConfig

    # Create a real ground_truth.json so Path.exists() returns True
    gt_data = {
        "pairs": [
            {
                "id": "pair_001",
                "invoice": "invoices/inv_001.png",
                "po": "purchase_orders/po_001.json",
                "expected_discrepancies": [],
                "label": "Clean Match",
            }
        ]
    }
    gt_file = tmp_path / "ground_truth.json"
    gt_file.write_text(json.dumps(gt_data))

    mock_gt.return_value = [
        PairConfig(
            id="pair_001", invoice="invoices/inv_001.png",
            po="purchase_orders/po_001.json",
            expected_discrepancies=[], label="Clean Match",
        ),
    ]

    with patch("app.api.routes.DATA_DIR", tmp_path):
        resp = client.get("/api/presets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["id"] == "pair_001"
    assert data[0]["label"] == "Clean Match"


@patch("app.api.routes.reconcile", return_value=MOCK_RESULT)
@patch("app.api.routes.load_po")
@patch("app.api.routes.load_ground_truth")
def test_reconcile_preset(mock_gt, mock_load_po, mock_reconcile, tmp_path):
    """Test POST /api/reconcile/preset using tmp_path with actual files."""
    from app.data_loader import PairConfig

    # Set up ground truth
    gt_data = {
        "pairs": [
            {
                "id": "pair_001",
                "invoice": "invoices/inv_001.png",
                "po": "purchase_orders/po_001.json",
                "expected_discrepancies": [],
                "label": "Clean Match",
            }
        ]
    }
    gt_file = tmp_path / "ground_truth.json"
    gt_file.write_text(json.dumps(gt_data))

    # Create invoice and PO files
    invoices_dir = tmp_path / "invoices"
    invoices_dir.mkdir()
    img = Image.new("RGB", (100, 100), "white")
    img.save(invoices_dir / "inv_001.png")

    po_dir = tmp_path / "purchase_orders"
    po_dir.mkdir()
    po_file = po_dir / "po_001.json"
    po_file.write_text(MOCK_RESULT.purchase_order.model_dump_json())

    mock_gt.return_value = [
        PairConfig(
            id="pair_001", invoice="invoices/inv_001.png",
            po="purchase_orders/po_001.json",
            expected_discrepancies=[], label="Clean Match",
        ),
    ]
    mock_load_po.return_value = MOCK_RESULT.purchase_order

    with patch("app.api.routes.DATA_DIR", tmp_path):
        resp = client.post("/api/reconcile/preset", json={"preset_id": "pair_001"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["invoice"]["invoice_number"] == "INV-001"


def test_reconcile_preset_missing_id():
    """Test POST /api/reconcile/preset without preset_id returns 400."""
    resp = client.post("/api/reconcile/preset", json={})
    assert resp.status_code == 400


def test_reconcile_preset_not_found(tmp_path):
    """Test POST /api/reconcile/preset with unknown preset_id returns 404."""
    from app.data_loader import PairConfig

    gt_data = {"pairs": []}
    gt_file = tmp_path / "ground_truth.json"
    gt_file.write_text(json.dumps(gt_data))

    with patch("app.api.routes.DATA_DIR", tmp_path), \
         patch("app.api.routes.load_ground_truth", return_value=[]):
        resp = client.post("/api/reconcile/preset", json={"preset_id": "nonexistent"})
    assert resp.status_code == 404

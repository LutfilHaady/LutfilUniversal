import io
import json
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image

from app.models.schemas import PurchaseOrderData, ReconciliationResult
from app.data_loader import load_po, load_ground_truth, PairConfig
from app.services.reconciler import reconcile

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"

SUPPORTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("/api/health")
def health():
    return {"status": "ok", "ocr_engines": ["tesseract", "paddleocr"]}


@router.post("/api/reconcile")
async def reconcile_upload(
    invoice: UploadFile = File(...),
    po: UploadFile = File(...),
):
    if invoice.size and invoice.size > MAX_FILE_SIZE:
        raise HTTPException(400, "Invoice file exceeds 10MB limit")
    if po.size and po.size > MAX_FILE_SIZE:
        raise HTTPException(400, "PO file exceeds 10MB limit")

    invoice_bytes = await invoice.read()
    try:
        image = Image.open(io.BytesIO(invoice_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid or corrupt invoice image file")

    po_bytes = await po.read()
    try:
        po_json = json.loads(po_bytes)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(400, "PO file is not valid JSON")
    try:
        po_data = PurchaseOrderData(**po_json)
    except Exception:
        raise HTTPException(400, "PO JSON does not match expected schema")

    result = reconcile(image, po_data, [])
    return result.model_dump()


@router.post("/api/reconcile/preset")
async def reconcile_preset(body: dict):
    preset_id = body.get("preset_id")
    if not preset_id:
        raise HTTPException(400, "preset_id is required")

    gt_path = DATA_DIR / "ground_truth.json"
    if not gt_path.exists():
        raise HTTPException(500, "Ground truth file not found")

    pairs = load_ground_truth(gt_path)
    pair = next((p for p in pairs if p.id == preset_id), None)
    if not pair:
        raise HTTPException(404, f"Preset '{preset_id}' not found")

    invoice_path = DATA_DIR / pair.invoice
    po_path = DATA_DIR / pair.po

    if not invoice_path.exists() or not po_path.exists():
        raise HTTPException(500, f"Data files missing for preset '{preset_id}'")

    image = Image.open(invoice_path).convert("RGB")
    po_data = load_po(po_path)

    result = reconcile(image, po_data, [])
    return result.model_dump()


@router.get("/api/presets")
def get_presets():
    gt_path = DATA_DIR / "ground_truth.json"
    if not gt_path.exists():
        return []
    pairs = load_ground_truth(gt_path)
    return [
        {"id": p.id, "label": p.label, "description": f"{len(p.expected_discrepancies)} expected discrepancies"}
        for p in pairs
    ]

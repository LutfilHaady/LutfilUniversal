# Invoice-PO Reconciler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OCR-powered invoice-to-purchase-order reconciliation tool that extracts data from invoice images via dual OCR engines, compares against structured PO data, detects discrepancies, classifies them by financial materiality, and presents findings in a web UI.

**Architecture:** Invoice images go through Tesseract + PaddleOCR (dual-engine with comparison), then Claude API structures the raw OCR text into typed fields. Structured invoice data is matched line-by-line against PO JSON data, run through 5 deterministic discrepancy checks, then Claude API classifies each finding by severity. FastAPI serves the backend, Next.js + shadcn/ui renders upload and results pages.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, pytesseract, PaddleOCR, Anthropic Python SDK, pdf2image, Pillow, Next.js 14+ (App Router), shadcn/ui, TypeScript

## Global Constraints

- Python 3.11+ required (union type syntax `str | None`)
- All LLM calls use Claude API via `anthropic` Python SDK — model: `claude-sonnet-4-6`
- OCR is the primary extraction path — no pdfplumber, no text-layer shortcuts
- Deterministic-first: LLM used only for (1) OCR text structuring, (2) fuzzy matching fallback, (3) materiality classification
- POs are structured JSON (source of truth); only invoices are OCR'd
- No database — JSON files in `data/`
- API keys gitignored from commit #1 — use `.env` + `python-dotenv`
- Float comparisons use $0.01 tolerance
- All work happens inside `Invoice-PO-Reconciler/` at `C:\Users\lutfi\OneDrive\Desktop\Coding\Invoice Procurement OCR\Invoice-PO-Reconciler\`

---

### Task 1: Project Scaffolding + Pydantic Schemas

**Files:**
- Create: `backend/app/__init__.py`, `backend/app/models/__init__.py`, `backend/app/models/schemas.py`
- Create: `backend/app/api/__init__.py`, `backend/app/ocr/__init__.py`, `backend/app/extraction/__init__.py`
- Create: `backend/app/matching/__init__.py`, `backend/app/detection/__init__.py`, `backend/app/services/__init__.py`
- Create: `backend/requirements.txt`, `backend/.env.example`
- Create: `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/tests/test_schemas.py`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `LineItem`, `InvoiceData`, `PurchaseOrderData`, `Discrepancy`, `OcrComparison`, `ReconciliationResult` — all Pydantic BaseModel classes importable from `app.models.schemas`

- [ ] **Step 1: Create .gitignore and project skeleton**

Create `.gitignore` at repo root:

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
.venv/
venv/

# Environment
.env
backend/.env

# Node
node_modules/
.next/
frontend/.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Data - HF dataset cache
*.hf_cache/
```

Create all `__init__.py` files (empty):
```
backend/app/__init__.py
backend/app/api/__init__.py
backend/app/ocr/__init__.py
backend/app/extraction/__init__.py
backend/app/matching/__init__.py
backend/app/detection/__init__.py
backend/app/services/__init__.py
backend/app/models/__init__.py
backend/tests/__init__.py
```

Create `backend/.env.example`:
```
ANTHROPIC_API_KEY=your-api-key-here
```

- [ ] **Step 2: Create requirements.txt**

Create `backend/requirements.txt`:

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
anthropic>=0.40.0
pytesseract>=0.3.10
paddleocr>=2.8.0
paddlepaddle>=2.6.0
pdf2image>=1.16.0
Pillow>=10.0.0
pydantic>=2.0.0
python-multipart>=0.0.7
python-dotenv>=1.0.0
httpx>=0.27.0
pytest>=8.0.0
```

- [ ] **Step 3: Install dependencies**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate  # Windows
pip install -r requirements.txt
```

Also install Tesseract system binary: download the Windows installer from the UB-Mannheim Tesseract GitHub releases page, install it, and add its install directory to your system PATH. Verify with:

```bash
tesseract --version
```

Expected: version info (5.x)

- [ ] **Step 4: Write the failing test for schemas**

Create `backend/tests/test_schemas.py`:

```python
from app.models.schemas import (
    LineItem,
    InvoiceData,
    PurchaseOrderData,
    Discrepancy,
    OcrComparison,
    ReconciliationResult,
)


def test_line_item_creation():
    item = LineItem(
        description="Safety Gloves",
        quantity=100.0,
        unit_price=5.50,
        total=550.0,
    )
    assert item.description == "Safety Gloves"
    assert item.quantity == 100.0
    assert item.unit_price == 5.50
    assert item.total == 550.0


def test_invoice_data_with_po_reference():
    item = LineItem(description="Widget", quantity=10.0, unit_price=2.0, total=20.0)
    invoice = InvoiceData(
        invoice_number="INV-001",
        date="2024-01-15",
        vendor_name="Acme Corp",
        po_reference="PO-001",
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
        ocr_source="tesseract",
        ocr_confidence=0.85,
    )
    assert invoice.invoice_number == "INV-001"
    assert invoice.po_reference == "PO-001"
    assert len(invoice.line_items) == 1


def test_invoice_data_missing_po_reference():
    item = LineItem(description="Widget", quantity=10.0, unit_price=2.0, total=20.0)
    invoice = InvoiceData(
        invoice_number="INV-002",
        date="2024-01-15",
        vendor_name="Acme Corp",
        po_reference=None,
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
        ocr_source="paddleocr",
        ocr_confidence=0.92,
    )
    assert invoice.po_reference is None


def test_purchase_order_data():
    item = LineItem(description="Widget", quantity=10.0, unit_price=2.0, total=20.0)
    po = PurchaseOrderData(
        po_number="PO-001",
        date="2024-01-10",
        vendor_name="Acme Corp",
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
    )
    assert po.po_number == "PO-001"


def test_discrepancy():
    d = Discrepancy(
        type="price_mismatch",
        severity="material",
        justification="$15/unit overcharge on 200 units",
        invoice_value="65.00",
        po_value="50.00",
        financial_impact=3000.0,
        line_item="Safety Gloves",
    )
    assert d.type == "price_mismatch"
    assert d.severity == "material"
    assert d.financial_impact == 3000.0


def test_discrepancy_no_line_item():
    d = Discrepancy(
        type="missing_po_reference",
        severity="critical",
        justification="No PO number on invoice",
        invoice_value="N/A",
        po_value="N/A",
        financial_impact=0.0,
        line_item=None,
    )
    assert d.line_item is None


def test_ocr_comparison():
    comp = OcrComparison(
        tesseract_confidence=0.82,
        paddleocr_confidence=0.91,
        field_agreement={"invoice_number": True, "total": True, "vendor_name": False},
    )
    assert comp.paddleocr_confidence > comp.tesseract_confidence
    assert comp.field_agreement["invoice_number"] is True
    assert comp.field_agreement["vendor_name"] is False


def test_reconciliation_result():
    item = LineItem(description="Widget", quantity=10.0, unit_price=2.0, total=20.0)
    invoice = InvoiceData(
        invoice_number="INV-001",
        date="2024-01-15",
        vendor_name="Acme Corp",
        po_reference="PO-001",
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
        ocr_source="tesseract",
        ocr_confidence=0.85,
    )
    po = PurchaseOrderData(
        po_number="PO-001",
        date="2024-01-10",
        vendor_name="Acme Corp",
        line_items=[item],
        subtotal=20.0,
        tax=1.40,
        total=21.40,
    )
    result = ReconciliationResult(
        invoice=invoice,
        purchase_order=po,
        discrepancies=[],
        ocr_comparison=None,
    )
    assert len(result.discrepancies) == 0
    assert result.ocr_comparison is None
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd backend
python -m pytest tests/test_schemas.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.schemas'`

- [ ] **Step 6: Implement schemas**

Create `backend/app/models/schemas.py`:

```python
from pydantic import BaseModel


class LineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total: float


class InvoiceData(BaseModel):
    invoice_number: str
    date: str
    vendor_name: str
    po_reference: str | None
    line_items: list[LineItem]
    subtotal: float
    tax: float
    total: float
    ocr_source: str
    ocr_confidence: float


class PurchaseOrderData(BaseModel):
    po_number: str
    date: str
    vendor_name: str
    line_items: list[LineItem]
    subtotal: float
    tax: float
    total: float


class Discrepancy(BaseModel):
    type: str
    severity: str
    justification: str
    invoice_value: str
    po_value: str
    financial_impact: float
    line_item: str | None


class OcrComparison(BaseModel):
    tesseract_confidence: float
    paddleocr_confidence: float
    field_agreement: dict[str, bool]


class ReconciliationResult(BaseModel):
    invoice: InvoiceData
    purchase_order: PurchaseOrderData
    discrepancies: list[Discrepancy]
    ocr_comparison: OcrComparison | None
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_schemas.py -v
```

Expected: all 8 tests PASS

- [ ] **Step 8: Create conftest with shared fixtures**

Create `backend/tests/conftest.py`:

```python
import pytest
from app.models.schemas import LineItem, InvoiceData, PurchaseOrderData


@pytest.fixture
def sample_line_items():
    return [
        LineItem(description="Safety Gloves", quantity=200.0, unit_price=50.0, total=10000.0),
        LineItem(description="Hard Hats", quantity=50.0, unit_price=25.0, total=1250.0),
    ]


@pytest.fixture
def sample_invoice(sample_line_items):
    return InvoiceData(
        invoice_number="INV-2024-001",
        date="2024-03-15",
        vendor_name="Industrial Supply Co",
        po_reference="PO-2024-001",
        line_items=sample_line_items,
        subtotal=11250.0,
        tax=787.50,
        total=12037.50,
        ocr_source="paddleocr",
        ocr_confidence=0.91,
    )


@pytest.fixture
def sample_po(sample_line_items):
    return PurchaseOrderData(
        po_number="PO-2024-001",
        date="2024-03-10",
        vendor_name="Industrial Supply Co",
        line_items=sample_line_items,
        subtotal=11250.0,
        tax=787.50,
        total=12037.50,
    )
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding + Pydantic schemas with tests"
```

---

### Task 2: OCR Engines (Tesseract + PaddleOCR + Comparison)

**Files:**
- Create: `backend/app/ocr/tesseract.py`, `backend/app/ocr/paddle.py`, `backend/app/ocr/compare.py`
- Create: `backend/tests/test_ocr.py`

**Interfaces:**
- Consumes: Pillow `Image` objects
- Produces:
  - `run_tesseract(image: Image.Image) -> OcrResult` — returns `OcrResult(text: str, confidence: float)`
  - `run_paddleocr(image: Image.Image) -> OcrResult` — same signature
  - `run_dual_ocr(image: Image.Image) -> DualOcrResult` — returns both results + which had higher confidence

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_ocr.py`:

```python
from PIL import Image, ImageDraw
import pytest
from app.ocr.tesseract import run_tesseract
from app.ocr.paddle import run_paddleocr
from app.ocr.compare import run_dual_ocr, OcrResult, DualOcrResult


@pytest.fixture
def test_image():
    """Create a simple image with known text for OCR testing."""
    img = Image.new("RGB", (400, 100), "white")
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), "Invoice Number: INV-001", fill="black")
    draw.text((10, 50), "Total: $100.00", fill="black")
    return img


def test_run_tesseract_returns_ocr_result(test_image):
    result = run_tesseract(test_image)
    assert isinstance(result, OcrResult)
    assert isinstance(result.text, str)
    assert len(result.text) > 0
    assert 0.0 <= result.confidence <= 1.0


def test_run_paddleocr_returns_ocr_result(test_image):
    result = run_paddleocr(test_image)
    assert isinstance(result, OcrResult)
    assert isinstance(result.text, str)
    assert len(result.text) > 0
    assert 0.0 <= result.confidence <= 1.0


def test_run_dual_ocr_returns_both(test_image):
    result = run_dual_ocr(test_image)
    assert isinstance(result, DualOcrResult)
    assert isinstance(result.tesseract, OcrResult)
    assert isinstance(result.paddleocr, OcrResult)
    assert result.best_source in ("tesseract", "paddleocr")
    assert result.best_text == (
        result.tesseract.text
        if result.best_source == "tesseract"
        else result.paddleocr.text
    )


def test_run_dual_ocr_picks_higher_confidence(test_image):
    result = run_dual_ocr(test_image)
    if result.tesseract.confidence >= result.paddleocr.confidence:
        assert result.best_source == "tesseract"
    else:
        assert result.best_source == "paddleocr"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_ocr.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.ocr.tesseract'`

- [ ] **Step 3: Implement shared OcrResult model**

Add to `backend/app/ocr/__init__.py`:

```python
from pydantic import BaseModel


class OcrResult(BaseModel):
    text: str
    confidence: float


class DualOcrResult(BaseModel):
    tesseract: OcrResult
    paddleocr: OcrResult
    best_source: str
    best_text: str
```

- [ ] **Step 4: Implement Tesseract wrapper**

Create `backend/app/ocr/tesseract.py`:

```python
import pytesseract
from PIL import Image

from app.ocr import OcrResult


def run_tesseract(image: Image.Image) -> OcrResult:
    text = pytesseract.image_to_string(image)
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    confidences = [int(c) for c in data["conf"] if int(c) > 0]
    avg_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0
    return OcrResult(text=text.strip(), confidence=avg_confidence)
```

- [ ] **Step 5: Implement PaddleOCR wrapper**

Create `backend/app/ocr/paddle.py`:

```python
import numpy as np
from PIL import Image
from paddleocr import PaddleOCR

from app.ocr import OcrResult

_ocr_engine = None


def _get_engine() -> PaddleOCR:
    global _ocr_engine
    if _ocr_engine is None:
        _ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    return _ocr_engine


def run_paddleocr(image: Image.Image) -> OcrResult:
    engine = _get_engine()
    img_array = np.array(image)
    results = engine.ocr(img_array, cls=True)
    if not results or not results[0]:
        return OcrResult(text="", confidence=0.0)
    lines = []
    confidences = []
    for line in results[0]:
        text = line[1][0]
        conf = line[1][1]
        lines.append(text)
        confidences.append(conf)
    full_text = "\n".join(lines)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return OcrResult(text=full_text, confidence=avg_confidence)
```

- [ ] **Step 6: Implement comparison module**

Create `backend/app/ocr/compare.py`:

```python
from PIL import Image

from app.ocr import OcrResult, DualOcrResult
from app.ocr.tesseract import run_tesseract
from app.ocr.paddle import run_paddleocr


def run_dual_ocr(image: Image.Image) -> DualOcrResult:
    tess_result = run_tesseract(image)
    paddle_result = run_paddleocr(image)
    if tess_result.confidence >= paddle_result.confidence:
        best_source = "tesseract"
        best_text = tess_result.text
    else:
        best_source = "paddleocr"
        best_text = paddle_result.text
    return DualOcrResult(
        tesseract=tess_result,
        paddleocr=paddle_result,
        best_source=best_source,
        best_text=best_text,
    )
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_ocr.py -v
```

Expected: all 4 tests PASS (note: first run of PaddleOCR downloads model files — may take 30-60 seconds)

- [ ] **Step 8: Commit**

```bash
git add backend/app/ocr/ backend/tests/test_ocr.py
git commit -m "feat: Tesseract + PaddleOCR wrappers with dual-engine comparison"
```

---

### Task 3: LLM Extraction (Claude API)

**Files:**
- Create: `backend/app/extraction/llm_extractor.py`
- Create: `backend/tests/test_extraction.py`

**Interfaces:**
- Consumes: `str` (raw OCR text), `anthropic.Anthropic` client
- Produces: `extract_invoice_from_text(ocr_text: str) -> InvoiceData` — parses raw OCR text into a validated InvoiceData using Claude API

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_extraction.py`:

```python
import json
from unittest.mock import MagicMock, patch

import pytest
from app.extraction.llm_extractor import extract_invoice_from_text
from app.models.schemas import InvoiceData


MOCK_LLM_RESPONSE = json.dumps({
    "invoice_number": "INV-2024-001",
    "date": "2024-03-15",
    "vendor_name": "Industrial Supply Co",
    "po_reference": "PO-2024-001",
    "line_items": [
        {"description": "Safety Gloves", "quantity": 200, "unit_price": 50.0, "total": 10000.0},
        {"description": "Hard Hats", "quantity": 50, "unit_price": 25.0, "total": 1250.0},
    ],
    "subtotal": 11250.0,
    "tax": 787.50,
    "total": 12037.50,
})


@pytest.fixture
def mock_anthropic():
    mock_client = MagicMock()
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=MOCK_LLM_RESPONSE)]
    mock_client.messages.create.return_value = mock_message
    return mock_client


def test_extract_invoice_returns_invoice_data(mock_anthropic):
    with patch("app.extraction.llm_extractor._get_client", return_value=mock_anthropic):
        result = extract_invoice_from_text("Invoice Number: INV-2024-001\nTotal: $12037.50")
    assert isinstance(result, InvoiceData)
    assert result.invoice_number == "INV-2024-001"
    assert result.vendor_name == "Industrial Supply Co"
    assert len(result.line_items) == 2
    assert result.total == 12037.50


def test_extract_invoice_calls_claude_with_ocr_text(mock_anthropic):
    ocr_text = "Invoice Number: INV-2024-001\nTotal: $12037.50"
    with patch("app.extraction.llm_extractor._get_client", return_value=mock_anthropic):
        extract_invoice_from_text(ocr_text)
    call_args = mock_anthropic.messages.create.call_args
    prompt_content = call_args.kwargs["messages"][0]["content"]
    assert ocr_text in prompt_content


def test_extract_invoice_missing_po_reference(mock_anthropic):
    response_no_po = json.dumps({
        "invoice_number": "INV-002",
        "date": "2024-01-15",
        "vendor_name": "Acme Corp",
        "po_reference": None,
        "line_items": [
            {"description": "Widget", "quantity": 10, "unit_price": 2.0, "total": 20.0},
        ],
        "subtotal": 20.0,
        "tax": 1.40,
        "total": 21.40,
    })
    mock_anthropic.messages.create.return_value.content = [MagicMock(text=response_no_po)]
    with patch("app.extraction.llm_extractor._get_client", return_value=mock_anthropic):
        result = extract_invoice_from_text("Some OCR text without PO")
    assert result.po_reference is None


def test_extract_invoice_retries_on_invalid_json(mock_anthropic):
    bad_response = MagicMock()
    bad_response.content = [MagicMock(text="not valid json")]
    good_response = MagicMock()
    good_response.content = [MagicMock(text=MOCK_LLM_RESPONSE)]
    mock_anthropic.messages.create.side_effect = [bad_response, good_response]
    with patch("app.extraction.llm_extractor._get_client", return_value=mock_anthropic):
        result = extract_invoice_from_text("Some OCR text")
    assert isinstance(result, InvoiceData)
    assert mock_anthropic.messages.create.call_count == 2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_extraction.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.extraction.llm_extractor'`

- [ ] **Step 3: Implement LLM extractor**

Create `backend/app/extraction/llm_extractor.py`:

```python
import json
import os

import anthropic
from dotenv import load_dotenv

from app.models.schemas import InvoiceData

load_dotenv()

_client = None

EXTRACTION_PROMPT = """Extract structured data from the following OCR-scanned invoice text.
Return ONLY valid JSON with exactly these fields:

{{
  "invoice_number": "string",
  "date": "string (YYYY-MM-DD)",
  "vendor_name": "string",
  "po_reference": "string or null if not found",
  "line_items": [
    {{
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "total": number
    }}
  ],
  "subtotal": number,
  "tax": number,
  "total": number
}}

If a field cannot be found in the text, use null for strings and 0.0 for numbers.
For line_items, extract every itemized line you can find with description, quantity, unit price, and line total.

OCR TEXT:
{ocr_text}"""


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def extract_invoice_from_text(ocr_text: str, max_retries: int = 2) -> InvoiceData:
    client = _get_client()
    prompt = EXTRACTION_PROMPT.format(ocr_text=ocr_text)
    last_error = None
    for attempt in range(max_retries):
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = message.content[0].text
        try:
            cleaned = raw_text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
            data = json.loads(cleaned)
            return InvoiceData(
                **data,
                ocr_source="",
                ocr_confidence=0.0,
            )
        except (json.JSONDecodeError, Exception) as e:
            last_error = e
            continue
    raise ValueError(f"Failed to extract invoice after {max_retries} attempts: {last_error}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_extraction.py -v
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/extraction/ backend/tests/test_extraction.py
git commit -m "feat: Claude API LLM extraction from OCR text to InvoiceData"
```

---

### Task 4: Data Preparation (Invoices, POs, Ground Truth)

**Files:**
- Create: `scripts/prepare_data.py`
- Create: `data/purchase_orders/po_001.json` through `po_012.json`
- Create: `data/ground_truth.json`
- Create: `backend/app/data_loader.py`
- Create: `backend/tests/test_data_loader.py`
- Populate: `data/invoices/` with selected images

**Interfaces:**
- Consumes: HuggingFace `datasets` library, `PurchaseOrderData` from schemas
- Produces:
  - `load_po(path: Path) -> PurchaseOrderData`
  - `load_ground_truth(path: Path) -> list[PairConfig]`
  - `PairConfig(id: str, invoice_path: str, po_path: str, expected_discrepancies: list[dict], label: str)`

- [ ] **Step 1: Write the data preparation script**

Create `scripts/prepare_data.py`:

```python
"""
Data preparation script.
Downloads invoice images from HuggingFace dataset and saves selected ones locally.

Usage:
    cd Invoice-PO-Reconciler
    python scripts/prepare_data.py

Requires: pip install datasets Pillow
"""
import json
from pathlib import Path

from datasets import load_dataset


def main():
    data_dir = Path(__file__).parent.parent / "data"
    invoices_dir = data_dir / "invoices"
    invoices_dir.mkdir(parents=True, exist_ok=True)

    print("Loading dataset from HuggingFace...")
    ds = load_dataset("mychen76/invoices-and-receipts_ocr_v1", split="train")
    print(f"Dataset loaded: {len(ds)} rows")

    # Browse and filter: look for rows with clear invoice formatting
    # Print first 20 rows' text to help manual selection
    for i in range(min(20, len(ds))):
        row = ds[i]
        text = row.get("text", "")[:200] if row.get("text") else "NO TEXT"
        print(f"\n--- Row {i} ---")
        print(f"Text preview: {text}")
        if row.get("image"):
            print(f"Has image: yes")

    print("\n\nReview the rows above.")
    print("Then manually pick 10-15 rows by index and save their images.")
    print("Example: to save row 5's image:")
    print('  ds[5]["image"].save(invoices_dir / "inv_001.png")')


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script to browse the dataset**

```bash
cd Invoice-PO-Reconciler
python scripts/prepare_data.py
```

Review the output. Pick 10-15 invoice images that have clear formatting with invoice numbers, dates, line items with quantities and prices. Save them using the dataset API:

```python
from datasets import load_dataset
from pathlib import Path

ds = load_dataset("mychen76/invoices-and-receipts_ocr_v1", split="train")
invoices_dir = Path("data/invoices")
invoices_dir.mkdir(parents=True, exist_ok=True)

# Replace these indices with your actual picks after reviewing
picks = [0, 3, 5, 7, 10, 12, 15, 18, 20, 22, 25, 28]
for i, idx in enumerate(picks, 1):
    ds[idx]["image"].save(invoices_dir / f"inv_{i:03d}.png")
    print(f"Saved inv_{i:03d}.png from row {idx}")
```

- [ ] **Step 3: Author purchase order JSON files**

Create `data/purchase_orders/` directory. For each selected invoice image, author a matching PO JSON. Here is the template and examples:

Create `data/purchase_orders/po_001.json` (clean match example):
```json
{
  "po_number": "PO-2024-001",
  "date": "2024-01-10",
  "vendor_name": "Vendor from invoice 1",
  "line_items": [
    {
      "description": "Exact description from invoice",
      "quantity": 10.0,
      "unit_price": 25.00,
      "total": 250.00
    }
  ],
  "subtotal": 250.00,
  "tax": 17.50,
  "total": 267.50
}
```

Create `data/purchase_orders/po_002.json` (price mismatch — change unit_price from invoice value):
```json
{
  "po_number": "PO-2024-002",
  "date": "2024-01-12",
  "vendor_name": "Vendor from invoice 2",
  "line_items": [
    {
      "description": "Item from invoice 2",
      "quantity": 100.0,
      "unit_price": 45.00,
      "total": 4500.00
    }
  ],
  "subtotal": 4500.00,
  "tax": 315.00,
  "total": 4815.00
}
```

Repeat for all 10-15 pairs, following the volume plan:
- 3-4 clean matches (PO exactly matches invoice OCR output)
- 2 price mismatches (different unit_price)
- 2 quantity mismatches (different quantity)
- 1-2 missing PO reference (invoice won't have a po_reference field, or it won't match)
- 1-2 duplicate invoices (two invoices with same invoice_number or same vendor+total+date)
- 1-2 math/tax errors (PO is correct, invoice has wrong line total or tax)
- 1-2 multi-discrepancy pairs

**Important:** After running OCR on each invoice (Task 2's code), check what text comes out. Author PO descriptions to match the OCR output closely for clean pairs, and introduce specific differences for discrepancy pairs.

- [ ] **Step 4: Create ground_truth.json**

Create `data/ground_truth.json`:

```json
{
  "pairs": [
    {
      "id": "pair_001",
      "invoice": "invoices/inv_001.png",
      "po": "purchase_orders/po_001.json",
      "expected_discrepancies": [],
      "label": "Clean Match"
    },
    {
      "id": "pair_002",
      "invoice": "invoices/inv_002.png",
      "po": "purchase_orders/po_002.json",
      "expected_discrepancies": [
        {
          "type": "price_mismatch",
          "line_item": "Description of mismatched item",
          "invoice_value": "50.00",
          "po_value": "45.00"
        }
      ],
      "label": "Price Mismatch"
    },
    {
      "id": "pair_003",
      "invoice": "invoices/inv_003.png",
      "po": "purchase_orders/po_003.json",
      "expected_discrepancies": [
        {
          "type": "quantity_mismatch",
          "line_item": "Description of mismatched item",
          "invoice_value": "150",
          "po_value": "100"
        }
      ],
      "label": "Quantity Mismatch"
    }
  ]
}
```

Continue for all pairs. Each pair entry has `id`, `invoice` (relative path), `po` (relative path), `expected_discrepancies` (list of expected findings), and `label` (human-readable name for the preset chip).

- [ ] **Step 5: Write failing test for data loader**

Create `backend/tests/test_data_loader.py`:

```python
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
                    {"type": "price_mismatch", "line_item": "Widget", "invoice_value": "10.0", "po_value": "8.0"}
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
    assert len(po.line_items) == 1
    assert po.total == 53.50


def test_load_ground_truth(tmp_ground_truth):
    pairs = load_ground_truth(tmp_ground_truth)
    assert len(pairs) == 2
    assert isinstance(pairs[0], PairConfig)
    assert pairs[0].id == "pair_001"
    assert pairs[0].label == "Clean Match"
    assert pairs[0].expected_discrepancies == []
    assert pairs[1].id == "pair_002"
    assert len(pairs[1].expected_discrepancies) == 1
```

- [ ] **Step 6: Implement data loader**

Create `backend/app/data_loader.py`:

```python
import json
from pathlib import Path

from pydantic import BaseModel

from app.models.schemas import PurchaseOrderData


class PairConfig(BaseModel):
    id: str
    invoice: str
    po: str
    expected_discrepancies: list[dict]
    label: str


def load_po(path: Path) -> PurchaseOrderData:
    with open(path) as f:
        data = json.load(f)
    return PurchaseOrderData(**data)


def load_ground_truth(path: Path) -> list[PairConfig]:
    with open(path) as f:
        data = json.load(f)
    return [PairConfig(**pair) for pair in data["pairs"]]
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_data_loader.py -v
```

Expected: both tests PASS

- [ ] **Step 8: Commit**

```bash
git add scripts/ data/ backend/app/data_loader.py backend/tests/test_data_loader.py
git commit -m "feat: data preparation script, PO loader, ground truth schema"
```

---

### Task 5: Line-Item Matching (Exact + Fuzzy)

**Files:**
- Create: `backend/app/matching/exact.py`, `backend/app/matching/fuzzy.py`
- Create: `backend/tests/test_matching.py`

**Interfaces:**
- Consumes: `list[LineItem]` (from invoice), `list[LineItem]` (from PO)
- Produces:
  - `MatchedPair(invoice_item: LineItem, po_item: LineItem)` — a paired match
  - `MatchResult(matched: list[MatchedPair], unmatched_invoice: list[LineItem], unmatched_po: list[LineItem])`
  - `match_exact(invoice_items: list[LineItem], po_items: list[LineItem]) -> MatchResult`
  - `match_fuzzy(unmatched_invoice: list[LineItem], unmatched_po: list[LineItem]) -> MatchResult` — uses Claude API
  - `match_line_items(invoice_items: list[LineItem], po_items: list[LineItem]) -> MatchResult` — runs exact then fuzzy

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_matching.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_matching.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement exact matching**

Create `backend/app/matching/exact.py`:

```python
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
```

- [ ] **Step 4: Implement fuzzy matching**

Create `backend/app/matching/fuzzy.py`:

```python
import json

import anthropic
from dotenv import load_dotenv

from app.models.schemas import LineItem
from app.matching.exact import MatchedPair, MatchResult

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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_matching.py -v
```

Expected: all 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/matching/ backend/tests/test_matching.py
git commit -m "feat: exact + fuzzy (Claude API) line-item matching"
```

---

### Task 6: Discrepancy Detection + Materiality Classification

**Files:**
- Create: `backend/app/detection/checks.py`, `backend/app/detection/materiality.py`
- Create: `backend/tests/test_detection.py`

**Interfaces:**
- Consumes:
  - `MatchResult` from `app.matching.exact`
  - `InvoiceData`, `PurchaseOrderData`, `Discrepancy` from `app.models.schemas`
- Produces:
  - `run_all_checks(invoice: InvoiceData, po: PurchaseOrderData, match_result: MatchResult, seen_invoices: list[InvoiceData]) -> list[Discrepancy]` — runs all 5 deterministic checks, returns unclassified discrepancies (severity="unclassified")
  - `classify_materiality(discrepancies: list[Discrepancy]) -> list[Discrepancy]` — calls Claude API to add severity + justification

- [ ] **Step 1: Write failing tests for deterministic checks**

Create `backend/tests/test_detection.py`:

```python
import json
from unittest.mock import MagicMock, patch

import pytest
from app.models.schemas import LineItem, InvoiceData, PurchaseOrderData, Discrepancy
from app.matching.exact import MatchedPair, MatchResult
from app.detection.checks import run_all_checks
from app.detection.materiality import classify_materiality

TOLERANCE = 0.01


def _make_invoice(**overrides) -> InvoiceData:
    defaults = dict(
        invoice_number="INV-001",
        date="2024-03-15",
        vendor_name="Acme Corp",
        po_reference="PO-001",
        line_items=[LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)],
        subtotal=50.0,
        tax=3.50,
        total=53.50,
        ocr_source="paddleocr",
        ocr_confidence=0.9,
    )
    defaults.update(overrides)
    return InvoiceData(**defaults)


def _make_po(**overrides) -> PurchaseOrderData:
    defaults = dict(
        po_number="PO-001",
        date="2024-03-10",
        vendor_name="Acme Corp",
        line_items=[LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)],
        subtotal=50.0,
        tax=3.50,
        total=53.50,
    )
    defaults.update(overrides)
    return PurchaseOrderData(**defaults)


def _make_match_result(inv_items, po_items) -> MatchResult:
    matched = [
        MatchedPair(invoice_item=inv, po_item=po)
        for inv, po in zip(inv_items, po_items)
    ]
    return MatchResult(matched=matched, unmatched_invoice=[], unmatched_po=[])


# --- Price mismatch ---

def test_price_mismatch_detected():
    inv_item = LineItem(description="Widget", quantity=10, unit_price=8.0, total=80.0)
    po_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)
    invoice = _make_invoice(line_items=[inv_item], subtotal=80.0, tax=5.60, total=85.60)
    po = _make_po()
    match_result = _make_match_result([inv_item], [po_item])
    discs = run_all_checks(invoice, po, match_result, [])
    price_discs = [d for d in discs if d.type == "price_mismatch"]
    assert len(price_discs) == 1
    assert price_discs[0].invoice_value == "8.0"
    assert price_discs[0].po_value == "5.0"


def test_no_price_mismatch_when_equal():
    invoice = _make_invoice()
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    price_discs = [d for d in discs if d.type == "price_mismatch"]
    assert len(price_discs) == 0


# --- Quantity mismatch ---

def test_quantity_mismatch_detected():
    inv_item = LineItem(description="Widget", quantity=15, unit_price=5.0, total=75.0)
    po_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)
    invoice = _make_invoice(line_items=[inv_item], subtotal=75.0, tax=5.25, total=80.25)
    po = _make_po()
    match_result = _make_match_result([inv_item], [po_item])
    discs = run_all_checks(invoice, po, match_result, [])
    qty_discs = [d for d in discs if d.type == "quantity_mismatch"]
    assert len(qty_discs) == 1


# --- Missing PO reference ---

def test_missing_po_reference():
    invoice = _make_invoice(po_reference=None)
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    ref_discs = [d for d in discs if d.type == "missing_po_reference"]
    assert len(ref_discs) == 1


def test_wrong_po_reference():
    invoice = _make_invoice(po_reference="PO-999")
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    ref_discs = [d for d in discs if d.type == "missing_po_reference"]
    assert len(ref_discs) == 1


def test_correct_po_reference():
    invoice = _make_invoice(po_reference="PO-001")
    po = _make_po(po_number="PO-001")
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    ref_discs = [d for d in discs if d.type == "missing_po_reference"]
    assert len(ref_discs) == 0


# --- Duplicate invoice ---

def test_duplicate_invoice_same_number():
    invoice = _make_invoice(invoice_number="INV-001")
    seen = [_make_invoice(invoice_number="INV-001")]
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, seen)
    dup_discs = [d for d in discs if d.type == "duplicate_invoice"]
    assert len(dup_discs) == 1


def test_duplicate_invoice_same_vendor_total_date():
    invoice = _make_invoice(invoice_number="INV-002")
    seen = [_make_invoice(invoice_number="INV-999")]  # different number, same vendor+total+date
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, seen)
    dup_discs = [d for d in discs if d.type == "duplicate_invoice"]
    assert len(dup_discs) == 1


def test_no_duplicate_when_unique():
    invoice = _make_invoice()
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    dup_discs = [d for d in discs if d.type == "duplicate_invoice"]
    assert len(dup_discs) == 0


# --- Math/tax error ---

def test_math_error_bad_line_total():
    inv_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=60.0)  # should be 50
    invoice = _make_invoice(line_items=[inv_item], subtotal=60.0, tax=4.20, total=64.20)
    po = _make_po()
    match_result = _make_match_result([inv_item], po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    math_discs = [d for d in discs if d.type == "math_error"]
    assert len(math_discs) >= 1


def test_math_error_bad_subtotal():
    inv_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)
    invoice = _make_invoice(line_items=[inv_item], subtotal=55.0, tax=3.85, total=58.85)  # subtotal wrong
    po = _make_po()
    match_result = _make_match_result([inv_item], po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    math_discs = [d for d in discs if d.type == "math_error"]
    assert len(math_discs) >= 1


def test_no_math_error_when_correct():
    invoice = _make_invoice()
    po = _make_po()
    match_result = _make_match_result(invoice.line_items, po.line_items)
    discs = run_all_checks(invoice, po, match_result, [])
    math_discs = [d for d in discs if d.type == "math_error"]
    assert len(math_discs) == 0


# --- Tolerance ---

def test_price_within_tolerance_not_flagged():
    inv_item = LineItem(description="Widget", quantity=10, unit_price=5.005, total=50.05)
    po_item = LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)
    invoice = _make_invoice(line_items=[inv_item], subtotal=50.05, tax=3.50, total=53.55)
    po = _make_po()
    match_result = _make_match_result([inv_item], [po_item])
    discs = run_all_checks(invoice, po, match_result, [])
    price_discs = [d for d in discs if d.type == "price_mismatch"]
    assert len(price_discs) == 0


# --- Unmatched items ---

def test_extra_invoice_items_flagged():
    extra = LineItem(description="Surprise Item", quantity=1, unit_price=999, total=999)
    invoice = _make_invoice(line_items=[
        LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0), extra
    ])
    po = _make_po()
    match_result = MatchResult(
        matched=[MatchedPair(invoice_item=invoice.line_items[0], po_item=po.line_items[0])],
        unmatched_invoice=[extra],
        unmatched_po=[],
    )
    discs = run_all_checks(invoice, po, match_result, [])
    extra_discs = [d for d in discs if d.type == "extra_invoice_item"]
    assert len(extra_discs) == 1


def test_extra_po_items_flagged():
    po_extra = LineItem(description="Missing From Invoice", quantity=5, unit_price=20, total=100)
    invoice = _make_invoice()
    po = _make_po(line_items=[
        LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0), po_extra
    ])
    match_result = MatchResult(
        matched=[MatchedPair(invoice_item=invoice.line_items[0], po_item=po.line_items[0])],
        unmatched_invoice=[],
        unmatched_po=[po_extra],
    )
    discs = run_all_checks(invoice, po, match_result, [])
    extra_discs = [d for d in discs if d.type == "missing_invoice_item"]
    assert len(extra_discs) == 1


# --- Materiality classification ---

def test_classify_materiality():
    discs = [
        Discrepancy(
            type="price_mismatch", severity="unclassified", justification="",
            invoice_value="65.0", po_value="50.0", financial_impact=3000.0, line_item="Gloves",
        ),
    ]
    mock_response = json.dumps({
        "classifications": [
            {"index": 0, "severity": "material", "justification": "$15/unit overcharge on 200 units = $3,000"}
        ]
    })
    mock_client = MagicMock()
    mock_client.messages.create.return_value.content = [MagicMock(text=mock_response)]

    with patch("app.detection.materiality._get_client", return_value=mock_client):
        result = classify_materiality(discs)

    assert len(result) == 1
    assert result[0].severity == "material"
    assert "3,000" in result[0].justification


def test_classify_materiality_empty_list():
    result = classify_materiality([])
    assert result == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_detection.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement deterministic checks**

Create `backend/app/detection/checks.py`:

```python
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
```

- [ ] **Step 4: Implement materiality classification**

Create `backend/app/detection/materiality.py`:

```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_detection.py -v
```

Expected: all 17 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/detection/ backend/tests/test_detection.py
git commit -m "feat: 5 deterministic discrepancy checks + LLM materiality classification"
```

---

### Task 7: Pipeline Orchestrator

**Files:**
- Create: `backend/app/services/reconciler.py`
- Create: `backend/tests/test_reconciler.py`

**Interfaces:**
- Consumes:
  - `run_dual_ocr(image) -> DualOcrResult` from `app.ocr.compare`
  - `extract_invoice_from_text(text) -> InvoiceData` from `app.extraction.llm_extractor`
  - `match_exact(inv, po) -> MatchResult` from `app.matching.exact`
  - `match_fuzzy(inv, po) -> MatchResult` from `app.matching.fuzzy`
  - `run_all_checks(invoice, po, match_result, seen) -> list[Discrepancy]` from `app.detection.checks`
  - `classify_materiality(discs) -> list[Discrepancy]` from `app.detection.materiality`
  - `load_po(path) -> PurchaseOrderData` from `app.data_loader`
- Produces:
  - `reconcile(invoice_image: Image, po: PurchaseOrderData, seen_invoices: list[InvoiceData]) -> ReconciliationResult`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_reconciler.py`:

```python
import json
from unittest.mock import MagicMock, patch
from PIL import Image

import pytest
from app.models.schemas import (
    LineItem, InvoiceData, PurchaseOrderData, Discrepancy,
    OcrComparison, ReconciliationResult,
)
from app.ocr import OcrResult, DualOcrResult
from app.matching.exact import MatchedPair, MatchResult
from app.services.reconciler import reconcile


MOCK_INVOICE_DATA = InvoiceData(
    invoice_number="INV-001",
    date="2024-03-15",
    vendor_name="Acme Corp",
    po_reference="PO-001",
    line_items=[LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)],
    subtotal=50.0,
    tax=3.50,
    total=53.50,
    ocr_source="paddleocr",
    ocr_confidence=0.91,
)


@pytest.fixture
def test_image():
    return Image.new("RGB", (100, 100), "white")


@pytest.fixture
def sample_po():
    return PurchaseOrderData(
        po_number="PO-001",
        date="2024-03-10",
        vendor_name="Acme Corp",
        line_items=[LineItem(description="Widget", quantity=10, unit_price=5.0, total=50.0)],
        subtotal=50.0,
        tax=3.50,
        total=53.50,
    )


@patch("app.services.reconciler.classify_materiality", side_effect=lambda x: x)
@patch("app.services.reconciler.run_all_checks", return_value=[])
@patch("app.services.reconciler.match_fuzzy")
@patch("app.services.reconciler.match_exact")
@patch("app.services.reconciler.extract_invoice_from_text", return_value=MOCK_INVOICE_DATA)
@patch("app.services.reconciler.run_dual_ocr")
def test_reconcile_clean_pair(
    mock_ocr, mock_extract, mock_exact, mock_fuzzy, mock_checks, mock_mat,
    test_image, sample_po,
):
    mock_ocr.return_value = DualOcrResult(
        tesseract=OcrResult(text="invoice text", confidence=0.8),
        paddleocr=OcrResult(text="invoice text", confidence=0.9),
        best_source="paddleocr",
        best_text="invoice text",
    )
    mock_exact.return_value = MatchResult(
        matched=[MatchedPair(
            invoice_item=MOCK_INVOICE_DATA.line_items[0],
            po_item=sample_po.line_items[0],
        )],
        unmatched_invoice=[],
        unmatched_po=[],
    )
    mock_fuzzy.return_value = MatchResult(matched=[], unmatched_invoice=[], unmatched_po=[])

    result = reconcile(test_image, sample_po, [])

    assert isinstance(result, ReconciliationResult)
    assert result.invoice.invoice_number == "INV-001"
    assert result.purchase_order.po_number == "PO-001"
    assert len(result.discrepancies) == 0
    assert result.ocr_comparison is not None
    assert result.ocr_comparison.paddleocr_confidence == 0.9


@patch("app.services.reconciler.classify_materiality", side_effect=lambda x: x)
@patch("app.services.reconciler.run_all_checks")
@patch("app.services.reconciler.match_fuzzy")
@patch("app.services.reconciler.match_exact")
@patch("app.services.reconciler.extract_invoice_from_text", return_value=MOCK_INVOICE_DATA)
@patch("app.services.reconciler.run_dual_ocr")
def test_reconcile_with_discrepancies(
    mock_ocr, mock_extract, mock_exact, mock_fuzzy, mock_checks, mock_mat,
    test_image, sample_po,
):
    mock_ocr.return_value = DualOcrResult(
        tesseract=OcrResult(text="text", confidence=0.8),
        paddleocr=OcrResult(text="text", confidence=0.9),
        best_source="paddleocr",
        best_text="text",
    )
    mock_exact.return_value = MatchResult(
        matched=[MatchedPair(
            invoice_item=MOCK_INVOICE_DATA.line_items[0],
            po_item=sample_po.line_items[0],
        )],
        unmatched_invoice=[], unmatched_po=[],
    )
    mock_fuzzy.return_value = MatchResult(matched=[], unmatched_invoice=[], unmatched_po=[])
    mock_checks.return_value = [
        Discrepancy(
            type="price_mismatch", severity="unclassified", justification="",
            invoice_value="8.0", po_value="5.0", financial_impact=30.0, line_item="Widget",
        )
    ]

    result = reconcile(test_image, sample_po, [])

    assert len(result.discrepancies) == 1
    assert result.discrepancies[0].type == "price_mismatch"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_reconciler.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement orchestrator**

Create `backend/app/services/reconciler.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_reconciler.py -v
```

Expected: both tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ backend/tests/test_reconciler.py
git commit -m "feat: pipeline orchestrator wiring OCR -> extraction -> matching -> detection"
```

---

### Task 8: FastAPI API Endpoints

**Files:**
- Create: `backend/app/main.py`, `backend/app/api/routes.py`
- Create: `backend/tests/test_api.py`

**Interfaces:**
- Consumes:
  - `reconcile(image, po, seen) -> ReconciliationResult` from `app.services.reconciler`
  - `load_po(path) -> PurchaseOrderData` from `app.data_loader`
  - `load_ground_truth(path) -> list[PairConfig]` from `app.data_loader`
- Produces:
  - `POST /api/reconcile` — multipart upload, returns `ReconciliationResult`
  - `POST /api/reconcile/preset` — body `{"preset_id": "..."}`, returns `ReconciliationResult`
  - `GET /api/presets` — returns list of preset metadata
  - `GET /api/health` — returns status

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_api.py`:

```python
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


@patch("app.api.routes.DATA_DIR", new_callable=lambda: property(lambda self: Path(".")))
@patch("app.api.routes.load_ground_truth")
def test_get_presets(mock_gt, mock_dir):
    from app.data_loader import PairConfig
    mock_gt.return_value = [
        PairConfig(
            id="pair_001", invoice="invoices/inv_001.png",
            po="purchase_orders/po_001.json",
            expected_discrepancies=[], label="Clean Match",
        ),
    ]
    resp = client.get("/api/presets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["id"] == "pair_001"
    assert data[0]["label"] == "Clean Match"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_api.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement FastAPI app**

Create `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.api.routes import router

app = FastAPI(title="Invoice-PO Reconciler", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
```

- [ ] **Step 4: Implement API routes**

Create `backend/app/api/routes.py`:

```python
import io
import json
import tempfile
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

    invoice_bytes = await invoice.read()
    image = Image.open(io.BytesIO(invoice_bytes)).convert("RGB")

    po_bytes = await po.read()
    po_data = PurchaseOrderData(**json.loads(po_bytes))

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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_api.py -v
```

Expected: all 3 tests PASS

- [ ] **Step 6: Verify server starts**

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Open browser to `http://localhost:8000/api/health`. Expected: `{"status":"ok","ocr_engines":["tesseract","paddleocr"]}`

Stop server with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add backend/app/main.py backend/app/api/ backend/tests/test_api.py
git commit -m "feat: FastAPI endpoints for reconcile, presets, and health"
```

---

### Task 9: Evaluation Script

**Files:**
- Create: `scripts/run_evaluation.py`
- Create: `docs/` directory (testing_report.md will be generated)

**Interfaces:**
- Consumes:
  - `load_ground_truth(path) -> list[PairConfig]` from `app.data_loader`
  - `load_po(path) -> PurchaseOrderData` from `app.data_loader`
  - `reconcile(image, po, seen) -> ReconciliationResult` from `app.services.reconciler`
- Produces: `docs/testing_report.md` — generated markdown file with accuracy metrics

- [ ] **Step 1: Implement evaluation script**

Create `scripts/run_evaluation.py`:

```python
"""
Run the full reconciliation pipeline against all ground truth pairs.
Computes OCR accuracy and discrepancy detection precision/recall.

Usage:
    cd Invoice-PO-Reconciler/backend
    python -m scripts.run_evaluation

Or from repo root:
    cd Invoice-PO-Reconciler
    python scripts/run_evaluation.py
"""
import sys
from pathlib import Path
from datetime import datetime

# Add backend to path so we can import app modules
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from PIL import Image
from app.data_loader import load_ground_truth, load_po
from app.services.reconciler import reconcile
from app.models.schemas import ReconciliationResult

DATA_DIR = Path(__file__).parent.parent / "data"
DOCS_DIR = Path(__file__).parent.parent / "docs"


def evaluate():
    gt_path = DATA_DIR / "ground_truth.json"
    pairs = load_ground_truth(gt_path)
    print(f"Loaded {len(pairs)} pairs from ground truth\n")

    results: list[tuple] = []  # (pair_config, reconciliation_result)
    seen_invoices = []

    for pair in pairs:
        print(f"Processing {pair.id} ({pair.label})...")
        invoice_path = DATA_DIR / pair.invoice
        po_path = DATA_DIR / pair.po

        image = Image.open(invoice_path).convert("RGB")
        po = load_po(po_path)

        result = reconcile(image, po, seen_invoices)
        seen_invoices.append(result.invoice)
        results.append((pair, result))
        print(f"  Found {len(result.discrepancies)} discrepancies")

    report = generate_report(results)
    DOCS_DIR.mkdir(exist_ok=True)
    report_path = DOCS_DIR / "testing_report.md"
    report_path.write_text(report)
    print(f"\nReport written to {report_path}")


def generate_report(results: list[tuple]) -> str:
    lines = [
        "# Testing Report",
        f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"\nTotal pairs evaluated: {len(results)}",
        "\n---\n",
        "## OCR Engine Comparison\n",
        "| Pair | Tesseract Conf | PaddleOCR Conf | Fields Agreed |",
        "|---|---|---|---|",
    ]

    for pair, result in results:
        if result.ocr_comparison:
            oc = result.ocr_comparison
            agreed = sum(1 for v in oc.field_agreement.values() if v)
            total = len(oc.field_agreement)
            lines.append(
                f"| {pair.id} | {oc.tesseract_confidence:.2f} | "
                f"{oc.paddleocr_confidence:.2f} | {agreed}/{total} |"
            )

    # Detection accuracy
    true_pos = 0
    false_pos = 0
    false_neg = 0
    type_stats: dict[str, dict[str, int]] = {}

    for pair, result in results:
        expected_types = {d["type"] for d in pair.expected_discrepancies}
        found_types = {d.type for d in result.discrepancies}

        for t in found_types:
            type_stats.setdefault(t, {"tp": 0, "fp": 0, "fn": 0})
            if t in expected_types:
                type_stats[t]["tp"] += 1
                true_pos += 1
            else:
                type_stats[t]["fp"] += 1
                false_pos += 1

        for t in expected_types:
            if t not in found_types:
                type_stats.setdefault(t, {"tp": 0, "fp": 0, "fn": 0})
                type_stats[t]["fn"] += 1
                false_neg += 1

    precision = true_pos / (true_pos + false_pos) if (true_pos + false_pos) > 0 else 0
    recall = true_pos / (true_pos + false_neg) if (true_pos + false_neg) > 0 else 0

    lines.extend([
        "\n---\n",
        "## Discrepancy Detection Accuracy\n",
        f"- **Precision:** {precision:.1%}",
        f"- **Recall:** {recall:.1%}",
        f"- **True Positives:** {true_pos}",
        f"- **False Positives:** {false_pos}",
        f"- **False Negatives:** {false_neg}",
        "\n### Per-Type Breakdown\n",
        "| Type | TP | FP | FN | Precision | Recall |",
        "|---|---|---|---|---|---|",
    ])

    for t, stats in sorted(type_stats.items()):
        tp, fp, fn = stats["tp"], stats["fp"], stats["fn"]
        p = tp / (tp + fp) if (tp + fp) > 0 else 0
        r = tp / (tp + fn) if (tp + fn) > 0 else 0
        lines.append(f"| {t} | {tp} | {fp} | {fn} | {p:.0%} | {r:.0%} |")

    # Per-pair details
    lines.extend(["\n---\n", "## Per-Pair Results\n"])
    for pair, result in results:
        lines.append(f"### {pair.id}: {pair.label}\n")
        expected = [d["type"] for d in pair.expected_discrepancies]
        found = [d.type for d in result.discrepancies]
        lines.append(f"- Expected: {expected if expected else 'none (clean pair)'}")
        lines.append(f"- Found: {found if found else 'none'}")
        if result.discrepancies:
            for d in result.discrepancies:
                lines.append(f"  - **{d.type}** [{d.severity}]: {d.justification}")
                lines.append(f"    Invoice: {d.invoice_value} | PO: {d.po_value} | Impact: ${d.financial_impact:.2f}")
        lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    evaluate()
```

- [ ] **Step 2: Run evaluation (requires Task 4 data to be prepared)**

```bash
cd Invoice-PO-Reconciler
python scripts/run_evaluation.py
```

Expected: processes all pairs, generates `docs/testing_report.md` with real numbers. Review the report for OCR accuracy and detection precision/recall.

- [ ] **Step 3: Commit**

```bash
git add scripts/run_evaluation.py docs/testing_report.md
git commit -m "feat: evaluation script with OCR comparison and detection accuracy metrics"
```

---

### Task 10: Frontend — Setup + Upload Page

**Files:**
- Create: Next.js project in `frontend/` via `create-next-app`
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/result-context.tsx`
- Create: `frontend/components/upload-zone.tsx`, `frontend/components/preset-chips.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: `GET /api/presets`, `POST /api/reconcile`, `POST /api/reconcile/preset` from backend
- Produces: Upload page UI with drag-drop, preset chips, and reconcile button; stores result in React context and navigates to `/results`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd Invoice-PO-Reconciler
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --no-src-dir --import-alias="@/*" --yes
```

- [ ] **Step 2: Install shadcn and add components**

```bash
cd Invoice-PO-Reconciler/frontend
npx shadcn@latest init -d
npx shadcn@latest add card button badge table alert
```

- [ ] **Step 3: Create API client**

Create `frontend/lib/api.ts`:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export interface PresetPair {
  id: string;
  label: string;
  description: string;
}

export async function fetchPresets(): Promise<PresetPair[]> {
  const res = await fetch(`${API_BASE}/api/presets`);
  if (!res.ok) throw new Error("Failed to fetch presets");
  return res.json();
}

export async function reconcileUpload(
  invoiceFile: File,
  poFile: File
): Promise<ReconciliationResult> {
  const form = new FormData();
  form.append("invoice", invoiceFile);
  form.append("po", poFile);
  const res = await fetch(`${API_BASE}/api/reconcile`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Reconciliation failed");
  return res.json();
}

export async function reconcilePreset(
  presetId: string
): Promise<ReconciliationResult> {
  const res = await fetch(`${API_BASE}/api/reconcile/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset_id: presetId }),
  });
  if (!res.ok) throw new Error("Preset reconciliation failed");
  return res.json();
}
```

- [ ] **Step 4: Create result context**

Create `frontend/lib/result-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ReconciliationResult } from "./api";

interface ResultContextType {
  result: ReconciliationResult | null;
  setResult: (r: ReconciliationResult | null) => void;
}

const ResultContext = createContext<ResultContextType>({
  result: null,
  setResult: () => {},
});

export function ResultProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  return (
    <ResultContext.Provider value={{ result, setResult }}>
      {children}
    </ResultContext.Provider>
  );
}

export function useResult() {
  return useContext(ResultContext);
}
```

- [ ] **Step 5: Wrap layout with ResultProvider**

Replace `frontend/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ResultProvider } from "@/lib/result-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Invoice-PO Reconciler",
  description: "OCR-powered invoice-to-purchase-order reconciliation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ResultProvider>
          <main className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto py-8 px-4">
              <h1 className="text-2xl font-bold mb-1">Invoice-PO Reconciler</h1>
              <p className="text-sm text-muted-foreground mb-8">
                Upload an invoice image and a purchase order to detect discrepancies.
              </p>
              {children}
            </div>
          </main>
        </ResultProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Create upload zone component**

Create `frontend/components/upload-zone.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface UploadZoneProps {
  label: string;
  accept: string;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  previewUrl?: string | null;
}

export function UploadZone({ label, accept, onFileSelect, selectedFile, previewUrl }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  return (
    <Card
      className={`p-6 border-2 border-dashed text-center transition-colors ${
        isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <p className="font-medium mb-2">{label}</p>
      {selectedFile ? (
        <div>
          <p className="text-sm text-muted-foreground mb-2">{selectedFile.name}</p>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-40 mx-auto mb-2 rounded border"
            />
          )}
          <Button variant="outline" size="sm" onClick={() => onFileSelect(null as unknown as File)}>
            Clear
          </Button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Drag & drop or click to browse
          </p>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>Choose File</span>
            </Button>
            <input
              type="file"
              accept={accept}
              onChange={handleChange}
              className="hidden"
            />
          </label>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 7: Create preset chips component**

Create `frontend/components/preset-chips.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchPresets, PresetPair } from "@/lib/api";

interface PresetChipsProps {
  onSelect: (presetId: string) => void;
  loading: boolean;
}

export function PresetChips({ onSelect, loading }: PresetChipsProps) {
  const [presets, setPresets] = useState<PresetPair[]>([]);

  useEffect(() => {
    fetchPresets().then(setPresets).catch(() => setPresets([]));
  }, []);

  if (presets.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-sm text-muted-foreground self-center">Try:</span>
      {presets.map((p) => (
        <Button
          key={p.id}
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => onSelect(p.id)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Build the upload page**

Replace `frontend/app/page.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload-zone";
import { PresetChips } from "@/components/preset-chips";
import { useResult } from "@/lib/result-context";
import { reconcileUpload, reconcilePreset } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const { setResult } = useResult();
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [poFile, setPoFile] = useState<File | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvoiceSelect = useCallback((file: File) => {
    setInvoiceFile(file);
    if (file && file.type.startsWith("image/")) {
      setInvoicePreview(URL.createObjectURL(file));
    } else {
      setInvoicePreview(null);
    }
  }, []);

  const handleReconcile = async () => {
    if (!invoiceFile || !poFile) return;
    setLoading(true);
    setError(null);
    try {
      const result = await reconcileUpload(invoiceFile, poFile);
      setResult(result);
      router.push("/results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconciliation failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = async (presetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reconcilePreset(presetId);
      setResult(result);
      router.push("/results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preset reconciliation failed");
    } finally {
      setLoading(false);
    }
  };

  const canReconcile = invoiceFile && poFile && !loading;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <UploadZone
          label="Invoice (PDF / PNG / JPG)"
          accept=".pdf,.png,.jpg,.jpeg"
          onFileSelect={handleInvoiceSelect}
          selectedFile={invoiceFile}
          previewUrl={invoicePreview}
        />
        <UploadZone
          label="Purchase Order (JSON)"
          accept=".json"
          onFileSelect={setPoFile}
          selectedFile={poFile}
        />
      </div>

      <PresetChips onSelect={handlePreset} loading={loading} />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <Button
        onClick={handleReconcile}
        disabled={!canReconcile}
        className="w-full"
        size="lg"
      >
        {loading ? "Processing..." : "Reconcile"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 9: Create .env.local.example**

Create `frontend/.env.local.example`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 10: Verify upload page renders**

```bash
cd Invoice-PO-Reconciler/frontend
npm run dev
```

Open `http://localhost:3000`. Verify:
- Two upload zones render side by side
- Drag-drop and click-to-browse work
- Preset chips appear (if backend is running with data)
- Reconcile button is disabled until both files selected

Stop with Ctrl+C.

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "feat: Next.js + shadcn upload page with drag-drop and preset chips"
```

---

### Task 11: Frontend — Results Page + API Wiring

**Files:**
- Create: `frontend/app/results/page.tsx`
- Create: `frontend/components/summary-strip.tsx`, `frontend/components/ocr-confidence.tsx`
- Create: `frontend/components/discrepancy-table.tsx`, `frontend/components/clean-state.tsx`

**Interfaces:**
- Consumes: `ReconciliationResult` from `result-context`
- Produces: Results page with summary strip, OCR comparison, discrepancy table, clean state

- [ ] **Step 1: Create summary strip component**

Create `frontend/components/summary-strip.tsx`:

```tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Discrepancy } from "@/lib/api";

interface SummaryStripProps {
  discrepancies: Discrepancy[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  material: "bg-orange-500 text-white",
  minor: "bg-yellow-500 text-black",
  cosmetic: "bg-gray-400 text-white",
  unclassified: "bg-gray-300 text-black",
};

export function SummaryStrip({ discrepancies }: SummaryStripProps) {
  const counts: Record<string, number> = {};
  for (const d of discrepancies) {
    counts[d.severity] = (counts[d.severity] || 0) + 1;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold">
          {discrepancies.length} discrepanc{discrepancies.length === 1 ? "y" : "ies"} found
        </span>
        <div className="flex gap-2">
          {Object.entries(counts).map(([severity, count]) => (
            <Badge key={severity} className={SEVERITY_COLORS[severity] || ""}>
              {count} {severity}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Create OCR confidence component**

Create `frontend/components/ocr-confidence.tsx`:

```tsx
import { Card } from "@/components/ui/card";
import { OcrComparison } from "@/lib/api";

interface OcrConfidenceProps {
  comparison: OcrComparison;
}

export function OcrConfidence({ comparison }: OcrConfidenceProps) {
  const agreed = Object.values(comparison.field_agreement).filter(Boolean).length;
  const total = Object.keys(comparison.field_agreement).length;

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3 text-sm">OCR Engine Comparison</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Tesseract</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded">
              <div
                className="h-2 bg-blue-500 rounded"
                style={{ width: `${comparison.tesseract_confidence * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs">{(comparison.tesseract_confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div>
          <p className="text-muted-foreground">PaddleOCR</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded">
              <div
                className="h-2 bg-green-500 rounded"
                style={{ width: `${comparison.paddleocr_confidence * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs">{(comparison.paddleocr_confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Fields agreed: {agreed}/{total}
      </p>
    </Card>
  );
}
```

- [ ] **Step 3: Create discrepancy table component**

Create `frontend/components/discrepancy-table.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Discrepancy } from "@/lib/api";

interface DiscrepancyTableProps {
  discrepancies: Discrepancy[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  material: "bg-orange-500 text-white",
  minor: "bg-yellow-500 text-black",
  cosmetic: "bg-gray-400 text-white",
  unclassified: "bg-gray-300 text-black",
};

const TYPE_LABELS: Record<string, string> = {
  price_mismatch: "Price Mismatch",
  quantity_mismatch: "Quantity Mismatch",
  missing_po_reference: "Missing PO Ref",
  duplicate_invoice: "Duplicate Invoice",
  math_error: "Math/Tax Error",
  extra_invoice_item: "Extra Invoice Item",
  missing_invoice_item: "Missing Invoice Item",
};

export function DiscrepancyTable({ discrepancies }: DiscrepancyTableProps) {
  const sorted = [...discrepancies].sort(
    (a, b) => b.financial_impact - a.financial_impact
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Line Item</TableHead>
          <TableHead>Invoice Value</TableHead>
          <TableHead>PO Value</TableHead>
          <TableHead className="text-right">Impact</TableHead>
          <TableHead>Justification</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((d, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">
              {TYPE_LABELS[d.type] || d.type}
            </TableCell>
            <TableCell>
              <Badge className={SEVERITY_COLORS[d.severity] || ""}>
                {d.severity}
              </Badge>
            </TableCell>
            <TableCell>{d.line_item || "—"}</TableCell>
            <TableCell className="font-mono text-sm">{d.invoice_value}</TableCell>
            <TableCell className="font-mono text-sm">{d.po_value}</TableCell>
            <TableCell className="text-right font-mono text-sm">
              ${d.financial_impact.toFixed(2)}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-xs">
              {d.justification}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Create clean state component**

Create `frontend/components/clean-state.tsx`:

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CleanState() {
  return (
    <Alert className="border-green-300 bg-green-50">
      <AlertTitle className="text-green-800">No discrepancies found</AlertTitle>
      <AlertDescription className="text-green-700">
        The invoice matches the purchase order. No issues detected.
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 5: Build the results page**

Create `frontend/app/results/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useResult } from "@/lib/result-context";
import { SummaryStrip } from "@/components/summary-strip";
import { OcrConfidence } from "@/components/ocr-confidence";
import { DiscrepancyTable } from "@/components/discrepancy-table";
import { CleanState } from "@/components/clean-state";

export default function ResultsPage() {
  const router = useRouter();
  const { result } = useResult();

  useEffect(() => {
    if (!result) router.push("/");
  }, [result, router]);

  if (!result) return null;

  const hasDiscrepancies = result.discrepancies.length > 0;

  return (
    <div className="space-y-6">
      {hasDiscrepancies ? (
        <>
          <SummaryStrip discrepancies={result.discrepancies} />
          {result.ocr_comparison && (
            <OcrConfidence comparison={result.ocr_comparison} />
          )}
          <DiscrepancyTable discrepancies={result.discrepancies} />
        </>
      ) : (
        <>
          <CleanState />
          {result.ocr_comparison && (
            <OcrConfidence comparison={result.ocr_comparison} />
          )}
        </>
      )}

      <Button variant="outline" onClick={() => router.push("/")}>
        Run another
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Test full flow**

Start both backend and frontend:

```bash
# Terminal 1
cd Invoice-PO-Reconciler/backend
uvicorn app.main:app --reload --port 8000

# Terminal 2
cd Invoice-PO-Reconciler/frontend
npm run dev
```

Test at `http://localhost:3000`:
1. Click a preset chip -> verify results page shows with summary strip, OCR confidence, and discrepancy table
2. Upload a custom invoice image + PO JSON -> verify reconciliation works
3. On a clean pair -> verify green "No discrepancies found" alert shows
4. Click "Run another" -> verify navigation back to upload page

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: results page with summary strip, OCR comparison, discrepancy table"
```

---

### Task 12: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: all previous tasks (architecture, testing report, screenshots)
- Produces: complete README for the public repo

- [ ] **Step 1: Write README**

Create `README.md` at repo root:

```markdown
# Invoice-PO Reconciler

> OCR-powered invoice-to-purchase-order reconciliation. Detects discrepancies between invoice images and purchase orders, classifies them by financial materiality, and reports findings.

Built as a personal project demonstrating OCR + LLM-assisted document processing.

---

## Problem

Accounts-payable teams manually reconcile vendor invoices against purchase orders before approving payment — checking prices, quantities, and references match. This is slow, error-prone, and where invoice fraud and overbilling slip through.

This tool automates **two-way matching** (invoice ↔ PO): it OCR-extracts data from invoice images, compares line-by-line against structured PO data, flags discrepancies, and ranks them by financial materiality.

---

## Architecture

\`\`\`
Invoice Image → [Tesseract + PaddleOCR] → Raw Text
                                             ↓
                                   [Claude API Extraction]
                                             ↓
                                    Structured InvoiceData
                                             ↓
PO JSON ──────────────────────→ [Line-Item Matching]
                                  (exact → fuzzy fallback)
                                             ↓
                                 [Discrepancy Detection]
                                  (5 deterministic checks)
                                             ↓
                                [Materiality Classification]
                                  (Claude API: severity + justification)
                                             ↓
                                      FastAPI REST API
                                             ↓
                                  Next.js + shadcn/ui Frontend
\`\`\`

**Deterministic-first:** Arithmetic and exact comparisons are done in code. The LLM handles only (1) structuring OCR text, (2) fuzzy line-item matching, and (3) materiality classification.

---

## Data

- **Invoices:** Selected from the public HuggingFace dataset `mychen76/invoices-and-receipts_ocr_v1` (synthetic). Loaded at runtime, never committed.
- **Purchase orders:** Authored independently as JSON files — some clean matches, most seeded with specific discrepancies for testing.
- **Ground truth:** `data/ground_truth.json` maps each pair to expected discrepancies, enabling precision/recall measurement.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **OCR primary, no text-layer shortcut** | The point is to demonstrate OCR processing, not skip past it |
| **Dual OCR engines with comparison** | Tesseract vs PaddleOCR accuracy comparison demonstrates evaluation ability |
| **Deterministic-first detection** | LLM for judgment calls only; math and comparisons don't need one |
| **Two-way match (no goods receipt)** | Core matching logic lives in invoice↔PO; goods receipts are a separate document type |
| **Synthetic data, stated openly** | Real+modern+itemized+paired invoice/PO data doesn't exist publicly |
| **No RAG, no agent** | No corpus to search; the tool detects and reports, doesn't act autonomously |

---

## Testing Report

See [`docs/testing_report.md`](docs/testing_report.md) for full results including:
- Tesseract vs PaddleOCR accuracy comparison per invoice
- Discrepancy detection precision/recall per type
- OCR-induced vs logic-induced error breakdown

---

## Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Tesseract OCR (system install, added to PATH)
- Anthropic API key

### Backend
\`\`\`bash
cd backend
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env  # add your ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000
\`\`\`

### Frontend
\`\`\`bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
\`\`\`

Open `http://localhost:3000`

---

## Scope & Limitations

- **Two-way match only** — goods receipt matching is out of scope
- **OCR accuracy depends on image quality** — poorly scanned invoices degrade results
- **No production hardening** — no auth, no rate limiting, no persistent storage
- **Synthetic test data** — real-world invoice layouts vary more than this dataset covers

---

## Where This Could Expand

Positioned within the four-pillar agentic procurement model:

1. **Three-way matching** — add goods receipt comparison
2. **Per-vendor trend analysis** — detect systematic overbilling patterns
3. **Closed-loop materiality learning** — train severity classification on human review decisions
4. **ERP integration** — connect to SAP/Oracle for automated PO lookup and approval routing

All explicitly *not yet implemented*.
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: complete README with architecture, design decisions, and setup instructions"
```

- [ ] **Step 3: Run full test suite one final time**

```bash
cd backend
python -m pytest tests/ -v
```

Expected: all tests PASS across all test files.

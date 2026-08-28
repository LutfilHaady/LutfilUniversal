# invoice-po-reconciler — Design Specification

> Invoice-to-purchase-order reconciliation tool. OCR-extracts structured data from invoice images, compares against purchase order records, detects discrepancies, classifies them by financial materiality, and reports findings.

---

## 1. Purpose

Legal, finance, and accounts-payable teams spend significant manual effort reconciling vendor invoices against purchase orders — checking whether prices, quantities, and references match before approving payment. This is slow, repetitive, and error-prone at scale, and it's where invoice fraud and overbilling slip through.

This tool automates the **invoice <-> PO matching** step (a two-way match): it OCR-extracts structured data from invoice images, compares them line by line against structured PO data, flags discrepancies, and ranks those discrepancies by financial materiality — so a trivial rounding difference isn't treated the same as a $10,000 quantity error.

**Scope honesty:** This is a personal portfolio project built independently to demonstrate OCR + LLM-assisted document processing skills relevant to the OCBC veNTUre brief (stated skills: Python, LLM API, OCR). It is not claimed as prior work experience.

---

## 2. Problem Framing

In procurement, the industry-standard control is **three-way matching**: reconciling the purchase order (what was ordered), the goods receipt (what arrived), and the invoice (what's being billed). Discrepancies across these three documents are the primary signal for billing errors and fraud.

This project implements **two-way matching** (invoice <-> PO only), scoping out goods-receipt matching. That's a conscious decision — goods receipts are a third document type requiring data not available; the core matching logic lives in invoice<->PO.

The tool implements the **invoice exception-handling** function: clean invoices pass through unflagged, while discrepancies are surfaced, categorized, and ranked for human review.

---

## 3. Discrepancy Types Detected

| Type | Description | Detection method |
|---|---|---|
| **Price mismatch** | Unit price on invoice differs from agreed PO price | Deterministic (exact compare on matched line items) |
| **Quantity mismatch** | Quantity billed differs from quantity ordered | Deterministic (exact compare on matched line items) |
| **Missing PO reference** | Invoice has no valid PO number, or it doesn't resolve to a known PO | Deterministic (field presence + lookup) |
| **Duplicate invoice** | Same invoice submitted twice (same invoice #, or same vendor+total+date) | Deterministic (cross-reference across invoice set) |
| **Math / tax error** | Line totals, subtotal, tax, or grand total don't compute correctly | Deterministic (arithmetic validation) |

**Materiality classification** (LLM-assisted): each detected discrepancy is tagged `cosmetic / minor / material / critical` with a one-line justification, so findings can be ranked by financial significance.

---

## 4. Architecture

```
[Invoice image/PDF]          [Purchase Order JSON]
        |                            |
        v                            v
[OCR Layer]                   [JSON loader]
  - Tesseract -> raw text       - Load structured PO data
  - PaddleOCR -> raw text
  - Accuracy comparison
        |                            |
        v                            |
[LLM Extraction (Claude API)]       |
  - Raw OCR text -> structured      |
    invoice JSON (invoice #,        |
    date, vendor, line items,       |
    totals)                         |
        |                            |
        v                            v
[Normalized Internal Schema]
  InvoiceData / PurchaseOrderData
        |
        v
[Line-Item Matching]
  - Exact description match (deterministic)
  - Claude API fallback for fuzzy matches
        |
        v
[Discrepancy Detection]
  - Price mismatch (deterministic)
  - Quantity mismatch (deterministic)
  - Missing PO reference (deterministic)
  - Duplicate invoice (deterministic)
  - Math/tax error (deterministic)
        |
        v
[Materiality Classification (Claude API)]
  - cosmetic / minor / material / critical
  - One-line justification per finding
        |
        v
[FastAPI REST API]
  POST /api/reconcile
  GET  /api/presets
  POST /api/reconcile/preset
        |
        v
[Next.js + shadcn/ui Frontend]
  - Upload page (drag-drop + presets)
  - Results page (summary + discrepancy table)
```

**Key design principle:** deterministic-first. Anything that can be checked with code is checked with code. The LLM is used in exactly 3 places: (1) OCR text -> structured data extraction, (2) fuzzy line-item matching fallback, (3) materiality classification.

---

## 5. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend logic | Python + FastAPI | Matches OCBC brief; clean REST API separation |
| LLM | Claude API (structured JSON output) | Matches brief; used narrowly for extraction, fuzzy matching, materiality |
| OCR (primary) | Tesseract + PaddleOCR (both, with comparison) | Matches brief; dual-engine comparison demonstrates evaluation ability |
| Frontend | Next.js + shadcn/ui | Modern, presentable; reused upload patterns from prior experience |
| Data validation | Pydantic | Type-safe schemas, automatic validation |

**Explicitly excluded:**
- **pdfplumber / text extraction** — all documents go through OCR; no text-layer shortcut
- **RAG / vector DB** — no corpus to retrieve from; each comparison only needs the two documents
- **Agentic / autonomous execution** — the tool detects and reports; it does not take autonomous actions
- **Database** — JSON files are sufficient for 10-15 pairs

---

## 6. Data Model

```python
class LineItem:
    description: str
    quantity: float
    unit_price: float
    total: float

class InvoiceData:
    invoice_number: str
    date: str
    vendor_name: str
    po_reference: str | None
    line_items: list[LineItem]
    subtotal: float
    tax: float
    total: float
    ocr_source: str               # "tesseract" | "paddleocr"
    ocr_confidence: float

class PurchaseOrderData:
    po_number: str
    date: str
    vendor_name: str
    line_items: list[LineItem]
    subtotal: float
    tax: float
    total: float

class Discrepancy:
    type: str                     # "price_mismatch" | "quantity_mismatch" | etc.
    severity: str                 # "cosmetic" | "minor" | "material" | "critical"
    justification: str
    invoice_value: str
    po_value: str
    financial_impact: float
    line_item: str | None

class ReconciliationResult:
    invoice: InvoiceData
    purchase_order: PurchaseOrderData
    discrepancies: list[Discrepancy]
    ocr_comparison: OcrComparison | None

class OcrComparison:
    tesseract_confidence: float
    paddleocr_confidence: float
    field_agreement: dict[str, bool]
```

---

## 7. OCR & Extraction Pipeline

1. **Image preparation** — Accept PDF or image (PNG/JPG). If PDF, render to image via `pdf2image`.
2. **Dual OCR run** — Tesseract (`pytesseract`) and PaddleOCR (`paddleocr`) both process the image. Each returns raw text + confidence scores.
3. **LLM structuring** — Raw OCR text sent to Claude API with a structured extraction prompt. Returns validated `InvoiceData` via Pydantic.
4. **OCR comparison logging** — LLM structuring runs on both OCR outputs. Field-level agreement compared for the testing report. The higher-confidence result is used for the reconciliation by default (PaddleOCR expected to win on most invoices).

**Purchase orders:** No OCR. Direct JSON load -> `PurchaseOrderData`, validated via Pydantic.

**Error handling:**
- OCR returns empty/garbage -> API returns error with raw OCR text for debugging
- LLM returns invalid JSON -> one retry, then error
- Unsupported image format -> reject at upload with supported formats list

---

## 8. Matching & Discrepancy Detection

**Line-item matching (two-pass):**
- **Pass 1 (deterministic):** Exact string match on description (case-insensitive, whitespace-normalized)
- **Pass 2 (LLM fallback):** Unmatched items sent to Claude API as a batch for fuzzy matching with confidence scores

**Deterministic checks on matched pairs:**
- Price mismatch: `invoice.unit_price != po.unit_price`
- Quantity mismatch: `invoice.quantity != po.quantity`
- Math/tax error: verify line totals, subtotal sum, tax calculation
- Missing PO reference: `po_reference is None` or doesn't match known PO
- Duplicate invoice: same `invoice_number` or same `(vendor, total, date)` tuple

**Materiality classification:** All discrepancies sent to Claude API in one batch for severity + justification.

**Edge cases:**
- Extra invoice line items -> flagged as "unbilled on PO"
- Extra PO line items -> flagged as "ordered but not invoiced"
- Float comparison uses $0.01 tolerance for rounding
- Duplicate detection only runs with multiple invoices loaded

---

## 9. API Design (FastAPI)

```
POST /api/reconcile
  Multipart form: invoice file (PDF/PNG/JPG) + PO file (JSON)
  Returns: ReconciliationResult JSON

POST /api/reconcile/preset
  Body: { "preset_id": "price_mismatch_01" }
  Returns: ReconciliationResult JSON

GET /api/presets
  Returns: list of preset pairs with metadata (id, label, description)

GET /api/health
  Returns: { "status": "ok", "ocr_engines": ["tesseract", "paddleocr"] }
```

- No auth (portfolio project, local-only)
- 10MB file size limit
- CORS allows Next.js dev server (localhost:3000)

---

## 10. Frontend (Next.js + shadcn/ui)

### Upload Page
- Two side-by-side cards: Invoice upload (PDF/PNG/JPG with thumbnail preview) + PO upload (JSON, auto-filled by presets)
- Preset chips row: "Try: Price Mismatch", "Try: Clean Match", etc.
- Reconcile button (disabled until both inputs present, spinner during processing)

### Results Page
- Summary strip: total discrepancies + severity breakdown as colored badges
- OCR confidence card: Tesseract vs PaddleOCR scores + field agreement
- Discrepancy table: Type, Severity badge, Line Item, Invoice Value, PO Value, Financial Impact, Justification — sorted by financial impact descending
- Clean state: green Alert "No discrepancies found"
- "Run another" link back to upload

### Component mapping
| Element | shadcn Component |
|---|---|
| Upload zones | `Card` + dropzone with `Button`/`Label` |
| Image preview | `<img>` inside Card |
| Preset chips | `Button variant="outline"` |
| Summary strip | `Card` + `Badge` per severity |
| OCR confidence | `Card` with progress indicators |
| Discrepancy table | `Table` with sortable columns |
| Severity badges | `Badge` (red/orange/yellow/gray) |
| Clean state | `Alert` (success variant) |

---

## 11. Data Preparation & Ground Truth

**Invoices:** 10-15 images hand-picked from HuggingFace `mychen76/invoices-and-receipts_ocr_v1`. Stored in `data/invoices/`.

**Purchase orders:** Authored as JSON files in `data/purchase_orders/`. Some exact matches, most seeded with one discrepancy.

**Volume:**
| Category | Count |
|---|---|
| Clean match | 3-4 |
| Price mismatch | 2 |
| Quantity mismatch | 2 |
| Missing PO reference | 1-2 |
| Duplicate invoice | 1-2 |
| Math/tax error | 1-2 |
| Multi-discrepancy | 1-2 |

**Ground truth:** `data/ground_truth.json` maps each pair to its seeded discrepancies. Presets endpoint reads from this file.

---

## 12. Testing Report & Accuracy Measurement

### OCR Accuracy (Tesseract vs PaddleOCR)
- Field extraction accuracy (% matching ground truth)
- Confidence scores per engine per invoice
- Field agreement rate between engines
- Failure case analysis

### Discrepancy Detection Accuracy
- Precision: of flagged discrepancies, how many were real?
- Recall: of seeded discrepancies, how many were found?
- False positives / false negatives breakdown
- OCR-induced errors vs logic-induced errors (separated)

**Deliverable:** `docs/testing_report.md`
**Runner:** `scripts/run_evaluation.py` — reproducible with one command

---

## 13. Project Structure

```
invoice-po-reconciler/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   └── routes.py
│   │   ├── ocr/
│   │   │   ├── tesseract.py
│   │   │   ├── paddleocr.py
│   │   │   └── compare.py
│   │   ├── extraction/
│   │   │   └── llm_extractor.py
│   │   ├── matching/
│   │   │   ├── exact.py
│   │   │   └── fuzzy.py
│   │   ├── detection/
│   │   │   ├── checks.py
│   │   │   └── materiality.py
│   │   ├── models/
│   │   │   └── schemas.py
│   │   └── services/
│   │       └── reconciler.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   └── results/
│   │       └── page.tsx
│   ├── components/
│   │   ├── upload-zone.tsx
│   │   ├── preset-chips.tsx
│   │   ├── summary-strip.tsx
│   │   ├── ocr-confidence.tsx
│   │   ├── discrepancy-table.tsx
│   │   └── clean-state.tsx
│   ├── lib/
│   │   └── api.ts
│   ├── package.json
│   └── .env.local.example
├── data/
│   ├── invoices/
│   ├── purchase_orders/
│   └── ground_truth.json
├── scripts/
│   └── run_evaluation.py
├── docs/
│   └── testing_report.md
├── .gitignore
└── README.md
```

---

## 14. Build Plan (3-day scope)

### Day 1 — Data + OCR + Extraction
- **Morning:** Filter dataset, pick 10-15 invoices, author PO JSONs, build ground_truth.json
- **Afternoon:** Pydantic models, Tesseract wrapper, PaddleOCR wrapper, OCR comparison, LLM extraction via Claude API
- **Checkpoint:** Any invoice image -> validated InvoiceData JSON from both engines

### Day 2 — Matching + Detection + API + Evaluation
- **Morning:** Exact matching, fuzzy matching, 5 deterministic checks, materiality classification, pipeline orchestrator
- **Afternoon:** FastAPI endpoints, evaluation script, testing report with real numbers
- **Checkpoint:** End-to-end pipeline works via API; testing report has precision/recall

### Day 3 — Frontend + README + Polish
- **Morning:** Next.js + shadcn setup, upload page, results page, API client
- **Afternoon:** Preset loading, full flow testing, README, loading states, error handling
- **Checkpoint:** Clickable demo + complete README + testing report

### Risk mitigations
- OCR engine installation: set up Tesseract (system) + PaddleOCR (pip) before Day 1
- Claude API latency: ~5-10 seconds per reconciliation (3 LLM calls); loading spinner in UI
- OCR accuracy: pick high-quality images during dataset filtering

---

## 15. Standing Decisions (do not relitigate)

- **OCR is primary** — every invoice goes through OCR, no text-extraction shortcut
- **Both OCR engines** — Tesseract and PaddleOCR, with accuracy comparison
- **Claude API** for all LLM tasks (extraction, fuzzy matching, materiality)
- **FastAPI** backend, **Next.js + shadcn** frontend
- **JSON files** for POs and ground truth, no database
- **POs are structured JSON** (source of truth); only invoices are OCR'd
- **No RAG, no agent, no ERP integration**
- **Dataset loaded at runtime, never committed**
- **API keys gitignored from commit #1**

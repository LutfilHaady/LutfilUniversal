# Resume Context: Invoice-PO Reconciler (In Progress)

## Project Summary

**Invoice-PO Reconciler** — an OCR-powered invoice-to-purchase-order reconciliation tool that automates the manual AP (accounts payable) matching process used in finance and procurement teams. The tool extracts structured data from invoice images using dual OCR engines, compares them line-by-line against structured PO data, detects discrepancies, and classifies each finding by financial materiality (cosmetic / minor / material / critical).

**Status:** Backend pipeline partially complete (4 of ~12 tasks done). Frontend and FastAPI layer not yet started.

---

## Problem Being Solved

In procurement, reconciling vendor invoices against purchase orders before approving payment is a high-volume, repetitive task prone to human error — and where billing fraud and overbilling slip through. This project automates **two-way matching** (invoice ↔ PO): discrepancies are detected, ranked by financial impact, and surfaced for human review, so reviewers focus only on exceptions.

**Discrepancy types detected:**
- Price mismatch (unit price differs between invoice and PO)
- Quantity mismatch (billed quantity vs. ordered quantity)
- Missing or invalid PO reference
- Duplicate invoice submissions
- Math/tax errors (line totals, subtotal, tax that don't compute)
- Extra line items on invoice (not on PO) or missing from invoice (on PO)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| LLM | Claude API (claude-sonnet-4-6) via Anthropic Python SDK |
| OCR | Tesseract (pytesseract) + PaddleOCR — dual-engine with accuracy comparison |
| Frontend (planned) | Next.js 14+, shadcn/ui, TypeScript |
| Testing | pytest, unittest.mock |
| Data validation | Pydantic BaseModel schemas throughout |

---

## Architecture

```
[Invoice image/PDF]     [Purchase Order JSON]
        |                       |
        v                       v
[Dual OCR: Tesseract + PaddleOCR]   [JSON loader → PurchaseOrderData]
  → raw text + confidence scores
        |
        v
[Claude API: OCR text → structured InvoiceData]
  (handles messy/incomplete OCR output)
        |
        v
[Line-Item Matching]
  Pass 1: exact description match (deterministic)
  Pass 2: Claude API fuzzy match fallback (for OCR typos)
        |
        v
[5 Deterministic Discrepancy Checks]
  → price mismatch, quantity mismatch, missing PO ref,
    duplicate invoice, math/tax error
        |
        v
[Claude API: materiality classification]
  → cosmetic / minor / material / critical + 1-line justification
        |
        v
[FastAPI REST API] → [Next.js + shadcn/ui frontend]
```

**Design principle:** deterministic-first. LLM used in exactly 3 places — (1) structuring raw OCR text, (2) fuzzy line-item matching fallback, (3) materiality classification.

---

## What's Built So Far

### Completed (with TDD — tests written first, then implementation)

**1. Data models (Pydantic schemas)**
- `LineItem`, `InvoiceData`, `PurchaseOrderData`, `Discrepancy`, `OcrComparison`, `ReconciliationResult`
- Full type safety, `str | None` for optional fields, float fields throughout
- 8 passing unit tests

**2. Dual OCR engine wrappers**
- `run_tesseract(image)` → `OcrResult(text, confidence)` using pytesseract
- `run_paddleocr(image)` → `OcrResult(text, confidence)` using PaddleOCR with lazy singleton engine
- `run_dual_ocr(image)` → `DualOcrResult` — runs both, picks higher-confidence result
- Auto-detects Tesseract binary path on Windows
- 4 passing unit tests

**3. LLM extraction (Claude API)**
- `extract_invoice_from_text(ocr_text) -> InvoiceData`
- Structured extraction prompt → Claude returns JSON → validated via Pydantic
- Handles code-block-wrapped JSON responses
- 1 retry on invalid JSON before raising
- 4 passing unit tests with mocked Anthropic client

**4. Data layer**
- `load_po(path) -> PurchaseOrderData` — loads PO from JSON file
- `load_ground_truth(path) -> list[PairConfig]` — loads test pair configs (invoice path, PO path, expected discrepancies, label)
- Scripts for browsing and filtering HuggingFace invoice dataset (`mychen76/invoices-and-receipts_ocr_v1`)
- 2 passing unit tests

### Planned (not yet implemented)
- Line-item matching (exact + Claude fuzzy fallback)
- 5 deterministic discrepancy checks
- Claude materiality classification
- Pipeline orchestrator (`reconcile()`)
- FastAPI endpoints: `POST /api/reconcile`, `POST /api/reconcile/preset`, `GET /api/presets`
- Evaluation script (precision/recall on seeded test pairs)
- Next.js frontend: upload page with drag-drop, results page with discrepancy table

---

## Key Technical Decisions Worth Mentioning

- **Dual OCR with accuracy comparison** — both Tesseract and PaddleOCR run on every invoice, confidence scores compared, better result used. This enables an empirical comparison report (a deliberate portfolio choice to demonstrate evaluation ability, not just "pick one").
- **LLM used narrowly** — three specific use cases, all other logic deterministic. This prevents hallucinated discrepancies and makes the tool auditable.
- **TDD throughout** — each module has tests written before implementation; failing test → pass test → commit.
- **$0.01 float tolerance** for price/quantity comparisons, preventing false positives from floating-point arithmetic.
- **Fuzzy match uses LLM** — OCR often introduces typos in product descriptions. Rather than heuristic string similarity, Claude determines if two descriptions refer to the same item.

---

## Skills Demonstrated

- Python backend development (FastAPI, Pydantic, pytesseract, PaddleOCR)
- LLM API integration (Anthropic Claude API, structured JSON output, retry logic)
- OCR pipeline design and dual-engine evaluation
- Test-driven development (pytest, mocking external APIs)
- Document processing / intelligent data extraction
- Domain understanding of finance/procurement workflows
- Clean architecture (deterministic-first, LLM as narrow tool, typed schemas throughout)

---

## Context for AI Resume Writer

- This is a **personal portfolio project**, built independently to demonstrate Python + LLM + OCR skills
- It is **not complete** — backend pipeline is ~33% done, frontend not started
- The user is applying for roles requiring Python, LLM API, and OCR skills
- Appropriate framing: "Currently building..." or "In-progress project demonstrating..."
- The design is production-quality in intent: proper error handling, type safety, TDD, modular architecture
- Strongest talking points: dual OCR comparison, deterministic-first LLM usage, TDD methodology, finance domain knowledge

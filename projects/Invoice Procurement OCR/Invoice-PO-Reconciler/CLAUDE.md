# Invoice-PO Reconciler — CLAUDE.md

## Project Overview

OCR-powered invoice-to-purchase-order reconciliation tool. Extracts data from invoice images via dual OCR engines (Tesseract + PaddleOCR), compares against structured PO data, detects discrepancies, classifies by financial materiality via Claude API, and presents findings in a web UI.

**Repo:** `Invoice-PO-Reconciler/` inside `C:\Users\lutfi\OneDrive\Desktop\Coding\Invoice Procurement OCR\`
**Purpose:** Portfolio project for OCBC veNTUre internship application (demonstrates OCR + LLM + Python skills).

## Architecture

```
Invoice Image → [Tesseract + PaddleOCR] → Raw Text → [Claude API Extraction] → InvoiceData
PO JSON → PurchaseOrderData
  ↓
[Line-Item Matching: exact → fuzzy LLM fallback]
  ↓
[5 Deterministic Checks] → [Claude API Materiality Classification]
  ↓
FastAPI REST API → Next.js + shadcn/ui Frontend
```

**Deterministic-first:** LLM used only for (1) OCR text structuring, (2) fuzzy matching fallback, (3) materiality classification.

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, pytesseract, PaddleOCR, Anthropic SDK
- **Frontend:** Next.js 14+ (App Router), shadcn/ui, TypeScript
- **LLM:** Claude API (claude-sonnet-4-6)
- **Data:** JSON files (no database)

## Project Structure

```
Invoice-PO-Reconciler/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── api/routes.py        # REST endpoints
│   │   ├── ocr/                 # tesseract.py, paddle.py, compare.py
│   │   ├── extraction/          # llm_extractor.py (Claude API)
│   │   ├── matching/            # exact.py, fuzzy.py
│   │   ├── detection/           # checks.py (5 deterministic), materiality.py
│   │   ├── models/schemas.py    # All Pydantic models
│   │   ├── services/reconciler.py  # Pipeline orchestrator
│   │   └── data_loader.py       # PO + ground truth JSON loader
│   ├── tests/                   # pytest test suite
│   └── requirements.txt
├── frontend/                    # Next.js + shadcn (not yet created)
├── data/
│   ├── invoices/                # Selected invoice images
│   ├── purchase_orders/         # Authored PO JSONs
│   └── ground_truth.json        # Expected results per pair
├── scripts/
│   └── prepare_data.py          # HuggingFace dataset browser
└── docs/
    └── superpowers/
        ├── specs/               # Design spec
        └── plans/               # Implementation plan (12 tasks)
```

## Key Commands

```bash
# Run backend tests
cd backend && python -m pytest tests/ -v

# Start backend server
cd backend && uvicorn app.main:app --reload --port 8000

# Start frontend (once created)
cd frontend && npm run dev
```

## Implementation Plan

Full plan at `docs/superpowers/plans/2026-06-21-invoice-po-reconciler.md` (12 tasks).
Progress ledger at `.superpowers/sdd/progress.md`.

## Standing Decisions (do not relitigate)

- OCR is primary — every invoice goes through OCR, no text-extraction shortcut
- Both OCR engines with accuracy comparison
- Claude API for all LLM tasks
- FastAPI backend, Next.js + shadcn frontend
- JSON files for POs/ground truth, no database
- POs are structured JSON (source of truth); only invoices are OCR'd
- No RAG, no agent, no ERP integration
- Dataset loaded at runtime, never committed
- API keys gitignored from commit #1

## Session Log Requirement

**After every coding session on this project, update `docs/session-log.md` with:**
- Date
- Tasks completed (with commit SHAs)
- Current status / next steps
- Any blockers or decisions made

This ensures future sessions can pick up without reading the full codebase.

## Known Issues

- PaddleOCR has a runtime bug on Windows (PaddlePaddle 3.3.1 oneDNN issue). Code handles it gracefully with fallback. Works on Linux/Mac.
- Only 3 of 10-15 invoice/PO pairs created. Full data curation is a manual step.

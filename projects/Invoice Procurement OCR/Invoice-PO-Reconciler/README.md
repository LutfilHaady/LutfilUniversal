# Invoice-PO Reconciler

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/fastapi-0.115+-green.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/next.js-16+-black.svg)](https://nextjs.org/)

OCR-powered invoice-to-purchase-order reconciliation tool that extracts data from invoice images, compares against structured PO data, and detects discrepancies with materiality classification.

## Overview

This tool automates the reconciliation of invoices against purchase orders by:

1. Extracting structured data from invoice images using dual OCR engines (Tesseract + PaddleOCR)
2. Comparing extracted invoice data against PO records using both exact and fuzzy matching
3. Running 5 deterministic discrepancy checks (price, quantity, PO reference, duplicate detection, math errors)
4. Classifying findings by financial materiality using Claude API
5. Presenting results through an intuitive web interface

Built with Python 3.11+, FastAPI, Next.js, Claude API, Tesseract, and PaddleOCR. Uses synthetic/sample data for portfolio demonstration.

## Architecture

```
Invoice Image → [Tesseract + PaddleOCR] → Raw Text → [Claude API Extraction] → InvoiceData
PO JSON → PurchaseOrderData
  ↓
[Line-Item Matching: exact → fuzzy LLM fallback]
  ↓
[5 Deterministic Checks] → [Claude API Materiality]
  ↓
FastAPI REST API ← → Next.js + shadcn/ui Frontend
```

**Design philosophy:** Deterministic-first with LLM fallback. Claude API is used only for (1) OCR text structuring, (2) fuzzy matching fallback, (3) materiality classification—never for the core comparison logic.

## Features

- **Dual OCR Engines:** Tesseract and PaddleOCR with automatic accuracy comparison
- **AI-Powered Extraction:** Claude API structures raw OCR text into invoice data
- **Smart Matching:** Exact matching first, fuzzy LLM fallback for ambiguous cases
- **5 Deterministic Checks:**
  - Line-item price mismatches
  - Line-item quantity mismatches
  - Missing or incorrect PO references
  - Duplicate invoice detection (by number, vendor, total, date)
  - Math errors (line totals, subtotals, taxes)
- **Materiality Classification:** Claude API classifies discrepancies by financial impact
- **Preset Pairs:** Pre-configured invoice/PO pairs for quick demos
- **Custom Upload:** Support for user-provided invoice images and PO JSON files
- **OCR Comparison Dashboard:** Visual comparison of Tesseract vs. PaddleOCR results
- **Evaluation Metrics:** Precision, recall, and F1 scores via evaluation script

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Python 3.11+, FastAPI, Pydantic v2, pytesseract, PaddleOCR, Anthropic SDK |
| **Frontend** | Next.js 16+ (App Router), shadcn/ui, React 19, TypeScript, Tailwind CSS |
| **LLM** | Claude API (claude-sonnet-4-6) |
| **Data Storage** | JSON files (no database) |

## Getting Started

### Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- Tesseract OCR installed ([installation guide](https://github.com/UB-Mannheim/tesseract/wiki))
- Anthropic API key (from [console.anthropic.com](https://console.anthropic.com))

### Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create .env file and add your Anthropic API key
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# Start the backend server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The web interface will be available at `http://localhost:3000`.

## Usage

### Web Interface

1. Open http://localhost:3000
2. Choose one of:
   - **Preset Pair:** Select a pre-configured invoice/PO pair for quick testing
   - **Custom Upload:** Upload your own invoice image (PNG/JPG) and PO JSON file
3. Review extracted data, discrepancies, and OCR comparison results

### API Endpoints

**Health Check:**
```bash
curl http://localhost:8000/api/health
```

**Reconcile via Upload:**
```bash
curl -X POST http://localhost:8000/api/reconcile \
  -F "invoice=@invoice.png" \
  -F "po=@purchase_order.json"
```

**Get Available Presets:**
```bash
curl http://localhost:8000/api/presets
```

**Reconcile via Preset:**
```bash
curl -X POST http://localhost:8000/api/reconcile/preset \
  -H "Content-Type: application/json" \
  -d '{"preset_id": "pair_001"}'
```

## Evaluation

The project includes an evaluation script that compares detected discrepancies against ground truth and computes metrics:

```bash
cd backend
python ../scripts/evaluate.py --data-dir ../data
```

Metrics include:
- **Precision:** Rate of correct detections (true positives / all detections)
- **Recall:** Coverage of actual issues (true positives / all ground truth issues)
- **F1 Score:** Harmonic mean of precision and recall

## Testing

Run the backend test suite (67+ tests, 100% passing):

```bash
cd backend
python -m pytest tests/ -v
```

Tests cover:
- API endpoints and request/response handling
- OCR engine functionality and comparison
- Invoice data extraction via Claude API
- Exact and fuzzy line-item matching
- All 5 deterministic checks
- Duplicate detection logic
- Math error detection
- Materiality classification
- Data loading and validation

## Project Structure

```
Invoice-PO-Reconciler/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI application entry point
│   │   ├── api/routes.py           # REST API endpoints
│   │   ├── ocr/
│   │   │   ├── tesseract.py        # Tesseract OCR wrapper
│   │   │   ├── paddle.py           # PaddleOCR wrapper
│   │   │   └── compare.py          # OCR accuracy comparison
│   │   ├── extraction/
│   │   │   └── llm_extractor.py    # Claude API text structuring
│   │   ├── matching/
│   │   │   ├── exact.py            # Exact line-item matching
│   │   │   └── fuzzy.py            # Fuzzy LLM fallback matching
│   │   ├── detection/
│   │   │   ├── checks.py           # 5 deterministic checks
│   │   │   └── materiality.py      # Claude API materiality classification
│   │   ├── models/schemas.py       # Pydantic v2 data models
│   │   ├── services/reconciler.py  # Pipeline orchestrator
│   │   └── data_loader.py          # PO + ground truth JSON loader
│   ├── tests/                      # pytest test suite (67+ tests)
│   └── requirements.txt            # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Home page
│   │   │   └── layout.tsx          # Root layout
│   │   ├── components/             # React components
│   │   └── lib/                    # Utility functions
│   ├── package.json                # Node dependencies
│   └── tsconfig.json               # TypeScript config
├── data/
│   ├── invoices/                   # Sample invoice images
│   ├── purchase_orders/            # Sample PO JSON files
│   └── ground_truth.json           # Expected discrepancies per pair
├── scripts/
│   └── evaluate.py                 # Evaluation script with metrics
├── CLAUDE.md                       # Developer documentation
└── README.md                       # This file
```

## Data

The project uses synthetic/sample data for portfolio demonstration:

- **Invoices:** Sample invoice images (PNG/JPG format) without real financial data
- **Purchase Orders:** Synthetic PO JSON records matched to invoices
- **Ground Truth:** Expected discrepancies for evaluation purposes

No real invoices, POs, or financial information are included in this repository.

## Known Limitations

- **PaddleOCR on Windows:** PaddlePaddle 3.3.1 has an oneDNN runtime issue on Windows. The code gracefully falls back to Tesseract. Fully functional on Linux/macOS.
- **Data Curation:** Only 3 of ~10 planned invoice/PO pairs are included. Full dataset curation is a manual, ongoing effort.

## License

MIT

## Notes

This is a portfolio project demonstrating OCR, LLM integration, Python backend development, and modern frontend architecture. It was built for an OCBC veNTUre internship application.

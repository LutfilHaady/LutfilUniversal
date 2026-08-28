---
name: invoice-po-reconciler-decisions
description: "Key design decisions for the Invoice-PO Reconciler — OCR primary, dual engines, Claude API, no DB"
metadata: 
  node_type: memory
  type: project
  originSessionId: 271dc13c-2972-43a6-984c-13975a6995c4
---

Standing decisions for the Invoice-PO Reconciler (do not relitigate). See [[invoice-po-reconciler-project]].

- **OCR is primary** — every invoice goes through OCR. No pdfplumber, no text-layer shortcut. The whole point is demonstrating OCR.
- **Both OCR engines** — Tesseract + PaddleOCR, with accuracy comparison in testing report
- **Claude API** (claude-sonnet-4-6) for all LLM tasks: extraction, fuzzy matching, materiality
- **FastAPI** backend, **Next.js + shadcn/ui** frontend
- **JSON files** for POs and ground truth — no database
- **POs are structured JSON** (source of truth); only invoices are OCR'd
- **Presets + real upload** in the UI
- OCR text → Claude API structuring (not rule-based parsing)
- No RAG, no agent, no ERP integration
- Synthetic data stated openly — real+modern+paired invoice/PO data doesn't exist publicly
- Dataset loaded at runtime, never committed (licensing hygiene)
- API keys gitignored from commit #1

**Why:** These were validated during brainstorming on 2026-06-20. See design spec at `docs/superpowers/specs/2026-06-20-invoice-po-reconciler-design.md`.

**How to apply:** When continuing implementation, follow these decisions. Don't re-propose alternatives already rejected (e.g., pdfplumber, database, single OCR engine).

---
name: invoice-po-reconciler-project
description: "Invoice-PO Reconciler project — OCR portfolio project for OCBC veNTUre, current build status and key decisions"
metadata: 
  node_type: memory
  type: project
  originSessionId: 271dc13c-2972-43a6-984c-13975a6995c4
---

Invoice-PO Reconciler is an OCR-powered invoice-to-PO reconciliation tool being built as a portfolio project for the OCBC veNTUre internship application.

**Why:** Demonstrates OCR + LLM + Python skills matching the OCBC brief. Personal project, not prior work experience.

**How to apply:**
- Repo at `C:\Users\lutfi\OneDrive\Desktop\Coding\Invoice Procurement OCR\Invoice-PO-Reconciler\`
- CLAUDE.md in repo root has full architecture, commands, and standing decisions
- Session log at `docs/session-log.md` tracks per-session progress
- Implementation plan at `docs/superpowers/plans/2026-06-21-invoice-po-reconciler.md` (12 tasks)
- Progress ledger at `.superpowers/sdd/progress.md`
- As of 2026-06-21: All 12 tasks complete, final review passed. 67 tests, frontend builds clean.
- Remaining manual work: curate 7-12 more invoice/PO pairs from HuggingFace dataset, end-to-end test with both servers running

# invoice-po-reconciler — Project Specification

> Invoice-to-purchase-order reconciliation tool. Detects discrepancies between an invoice and its corresponding purchase order, classifies them by financial materiality, and reports findings. Built as a personal project in preparation for the OCBC veNTUre internship application.

---

## 1. Purpose

Legal, finance, and accounts-payable teams spend significant manual effort reconciling vendor invoices against purchase orders — checking whether prices, quantities, and references match before approving payment. This is slow, repetitive, and error-prone at scale, and it's where invoice fraud and overbilling slip through.

This tool automates the **invoice ↔ PO matching** step (a two-way match): it extracts structured data from both documents, compares them line by line, flags discrepancies, and ranks those discrepancies by how much they actually matter financially — so a trivial rounding difference isn't treated the same as a $10,000 quantity error.

**Scope honesty:** This is a personal portfolio project built independently to demonstrate OCR + LLM-assisted document processing skills relevant to the OCBC veNTUre brief (stated skills: Python, LLM API, OCR). It is not claimed as prior work experience.

---

## 2. Problem Framing

In procurement, the industry-standard control is **three-way matching**: reconciling the purchase order (what was ordered), the goods receipt (what arrived), and the invoice (what's being billed). Discrepancies across these three documents are the primary signal for billing errors and fraud.

This project deliberately implements **two-way matching** (invoice ↔ PO only), scoping out goods-receipt matching. That's a conscious decision, not an omission — goods receipts are a third document type that would require additional data the project doesn't have, and the invoice↔PO comparison already contains the core matching and discrepancy-detection logic.

The tool implements the **invoice exception-handling** function: clean invoices pass through unflagged, while discrepancies are surfaced, categorized, and ranked for human review.

---

## 3. Discrepancy Types Detected

Each type is grounded in documented real-world invoice/procurement discrepancy categories.

| Type | Description | Detection method |
|---|---|---|
| **Price mismatch** | Unit price on invoice differs from agreed PO price | Deterministic (exact compare on matched line items) |
| **Quantity mismatch** | Quantity billed differs from quantity ordered | Deterministic (exact compare on matched line items) |
| **Missing PO reference** | Invoice has no valid PO number, or it doesn't resolve to a known PO | Deterministic (field presence + lookup) |
| **Duplicate invoice** | Same invoice submitted twice (same invoice #, or same vendor+total+date) | Deterministic (cross-reference across invoice set) |
| **Math / tax error** | Line totals, subtotal, tax, or grand total don't compute correctly | Deterministic (arithmetic validation) |

**Materiality classification** (LLM-assisted): each detected discrepancy is tagged `cosmetic / minor / material / critical` with a one-line justification, so findings can be ranked by financial significance rather than just listed.

---

## 4. Architecture

```
[Invoice + PO documents]
        |
        v
[Extraction Layer]
  - Invoice: parse structured data from dataset (primary path)
  - PO: parse from authored PO document
  - Secondary/tested: Tesseract or PaddleOCR on rendered images (documented, not primary)
        |
        v
[Structured Data: typed fields + line items]
        |
        v
[Matching Layer]
  - Exact description match first (deterministic, cheap)
  - LLM fallback only for unmatched/fuzzy line items
        |
        v
[Discrepancy Detection]
  - Deterministic checks: math, price, quantity, missing PO ref, duplicates
  - LLM-assisted: materiality classification + justification
        |
        v
[Ranked Discrepancy Report (JSON)]
        |
        v
[Next.js + shadcn UI: upload page -> results page]
```

**Key design principle:** deterministic-first. Anything that can be checked with code (arithmetic, exact comparison) is checked with code. The LLM is used only where genuine judgment is required (fuzzy line-item matching, materiality classification). This keeps the system explainable, measurable, and cheap — and it's a defensible design decision, not a default of "send everything to the LLM."

---

## 5. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend logic | Python | Matches OCBC brief; existing fluency |
| LLM | LLM API (structured JSON output) | Matches brief; used narrowly, not as a catch-all |
| OCR | Tesseract / PaddleOCR (secondary path) | Matches brief; documents a real OCR path even though primary data is pre-structured |
| PDF parsing | pdfplumber | Reliable text/table extraction on structured PDFs |
| Frontend | Next.js + shadcn/ui | Modern, presentable; reused upload patterns from prior experience |

**Explicitly excluded:**
- **RAG / vector DB** — there's no corpus to retrieve from; each comparison only needs the two documents in front of it.
- **Agentic / autonomous execution** — the tool detects and reports; it does not take autonomous actions or integrate with ERP systems.

---

## 6. Data

**Invoice source:** [`mychen76/invoices-and-receipts_ocr_v1`](https://huggingface.co/datasets/mychen76/invoices-and-receipts_ocr_v1) — a publicly available **synthetic** invoice dataset (~2,238 rows, dates 2012–2021), chosen for realistic modern formatting and itemized line-item detail.

**Why synthetic, and why this dataset:**
- A dataset that is simultaneously real, modern, and contains paired invoice+PO line-item data does not appear to exist publicly — real invoice/PO pairs live inside private ERP systems and are never published together. (Checked: UCSF/inv-cdip — real but 1980s-era and header-only; SEC EDGAR — real but contains contracts, not invoices; broader HF/Kaggle invoice sets — modern and itemized, but synthetic.)
- Synthetic data is the only approach that gives **controlled, verifiable ground truth**, which is required to measure detection accuracy.

**Purchase orders:** authored independently for each selected invoice — some as exact matches (clean pairs), most seeded with exactly one discrepancy. This makes the PO half of each pair synthetic-by-construction, which is stated openly.

**Licensing / repo hygiene:**
- The dataset has no clear redistribution license, so it is **loaded at runtime** via the `datasets` library and **never committed** to the repository.
- The repo ships code, not third-party data.

**Volume:** 10–15 invoice/PO pairs:
- 3–4 clean pairs (true negatives — needed for precision/recall)
- ~2 each of: price mismatch, quantity mismatch, missing PO ref, duplicate, math/tax error
- 1–2 multi-discrepancy pairs (harder edge cases)

**Ground truth:** `ground_truth.json` maps each pair to its seeded discrepancy (or "none"). This file is what turns the testing report into a measurement instead of an impression.

---

## 7. Build Plan (3-day scope)

### Day 1 — Data + Extraction
- Filter dataset for rows with invoice #, date, and >= 2 line items
- Hand-pick 10–15 clean candidates
- Author matching POs, seeding discrepancies per the volume plan
- Build `ground_truth.json`
- Extraction layer: invoice JSON -> internal schema; PO -> internal schema
- Secondary OCR path: render 2–3 invoices as images, run Tesseract/PaddleOCR, document where extraction degrades vs. structured data
- **Checkpoint:** clean structured JSON for every pair

### Day 2 — Matching + Detection + Testing Report
- Line-item matching: exact-first, LLM-fallback
- Deterministic discrepancy checks (math, price, quantity, missing ref, duplicate)
- LLM-assisted materiality classification
- Run pipeline against all pairs, compare to ground truth, compute precision/recall
- Write the testing report (results table, failure analysis, proposed improvements)
- **Checkpoint:** end-to-end pipeline works via script; testing report has real numbers

### Day 3 — Frontend + README
- Next.js + shadcn: upload page -> results page (see UI spec below)
- README assembled (see section 9)
- **Checkpoint:** clickable demo + complete README

---

## 8. UI Specification

Two pages. Designed to both function reliably in a live demo and screenshot cleanly for the README.

### Page 1 — Upload
- Two upload zones side by side: **Invoice** / **Purchase Order** (drag-drop + click-to-browse)
- Filename/preview confirmation on selection
- **Preset example pairs** as clickable chips ("Try: Price Mismatch", "Try: Clean Match", "Try: Duplicate Invoice") — makes the live demo reliable and guarantees good screenshots without depending on a live upload
- One primary **Reconcile** button (disabled until both inputs present)
- One line of explanatory copy (self-explanatory in a screenshot)
- *Not included:* settings, config, auth, saved-run history

### Page 2 — Results
- **Summary strip:** total discrepancies + severity breakdown ("2 Critical · 1 Material · 3 Minor") — the key screenshot element
- **Discrepancy table:** one row per finding — type, severity badge (color-coded), justification, invoice-value vs PO-value side by side
- **Clean-pair state:** explicit "No discrepancies found" success state (never just an empty table)
- "Run another" link back to upload
- *Not included:* editing/approving findings, export button, charts beyond the summary strip (optional only if time allows)

### Component mapping (shadcn)
- Upload zones -> `Card` + dropzone (or native input styled with `Button`/`Label`)
- Preset chips -> `Badge` / `Button variant="outline"`
- Summary strip -> `Card` with stat blocks, severity as colored `Badge`s
- Discrepancy table -> `Table`, severity column as conditional-color `Badge`
- Clean state -> `Alert` (success variant)

**Visual restraint:** two clean pages beat five mediocre ones. Every extra component is time stolen from the data pipeline behind it.

---

## 9. README Structure (final deliverable)

1. One-line description + tagline
2. **Problem statement** — mirrors the OCBC brief framing, in own words
3. **Architecture diagram** — the flow from section 4
4. **Data sourcing** — the synthetic-dataset + synthetic-PO framing from section 6, stated openly
5. **Key design decisions** — deterministic-vs-LLM split; structured-data-primary / OCR-secondary; two-way (not three-way) scoping; why no RAG
6. **Testing report** — summary + precision/recall table + link to full report
7. **Scope & limitations** — what's deliberately out (goods receipts, ghost-vendor detection, production OCR robustness)
8. **Roadmap / where this could expand** — framed as product analysis, referencing the four-pillar agentic procurement model (supplier management, sourcing/contracts, invoice management, purchasing); natural next steps: three-way matching, per-vendor discrepancy trend analysis, closed-loop materiality learning, ERP integration — each explicitly noted as *not yet implemented*
9. **Honest framing** — personal project, built independently in preparation for the OCBC veNTUre application

---

## 10. Standing Decisions (do not relitigate)

- **No RAG** — no corpus to retrieve from.
- **No "real invoice" claims** — dataset is synthetic; stated as such.
- **No agent / ERP-integration claims** — the tool detects and reports; it does not act autonomously.
- **No reuse of proprietary prior-internship code or architecture** — generic patterns (image -> structured JSON -> validation) are fine; specific architectures are not.
- **Dataset loaded at runtime, never committed** — licensing hygiene.
- **API keys gitignored from commit #1** — never in git history.
- **Repo:** `invoice-po-reconciler`, public.

---

## 11. Interview-Defense Notes

Things to be able to explain without notes:
- **Why diffing isn't the hard part** — the hard part is materiality classification (which changes matter) and fuzzy line-item matching (descriptions never match exactly).
- **Why deterministic-first** — arithmetic and exact comparisons don't need an LLM; using one there would be slower, costlier, and less reliable. The LLM earns its place only on genuine judgment calls.
- **Why two-way not three-way** — goods receipts are a third document type requiring data not available; the core matching logic lives in invoice↔PO.
- **Why synthetic data** — real+modern+itemized+paired doesn't exist publicly; synthetic is the only path to verifiable ground truth.
- **Where this fits in the bigger picture** — it's the invoice exception-handling pillar of a larger agentic procurement landscape; the roadmap shows the expansion path.
# Flint User Guide — Gap Analysis & Improvement Proposals
**Date:** 2026-06-29  
**Source document analysed:** `flint_user_guide_3.docx` (Downloads)  
**Reference sources:** `docs/FLINT_REFERENCE_21052026.md`, `docs/FLINT_USER_GUIDE.md`, `docs/screenshots/`  
**Status:** `docs/FLINT_USER_GUIDE.md` updated 2026-06-29 — all gaps below marked with resolution status. Outstanding work = apply remaining fixes to `flint_user_guide_3.docx` and take 5 missing screenshots.

---

## Context

The client has a Word document (`flint_user_guide_3.docx`) that is their working user manual for Flint. It is structured by role (Operator / Engineer / Admin workflows) and is more complete than the in-repo markdown guide. Version 3 was last updated 2026-06-29.

The repo also contains `docs/FLINT_USER_GUIDE.md` — a screen-by-screen guide used to power a Gemini Gem help assistant.

Both documents need to stay in sync with the live app.

---

## Screenshots inventory

Screenshots live in `docs/screenshots/`. Two generations exist:
- **Numbered series** (`01-login.png` … `16-log-step5-confirm.png`) — captured 2026-06-28
- **Unnumbered series** (`landing-page.png`, `dashboard.png`, `login.png`, `process-log.png`, `qc-wizard.png`, `alerts.png`, `batches.png`) — newer, captured 2026-06-29

| File | Ready to use? |
|------|:---:|
| `landing-page.png` | ✅ |
| `login.png` / `01-login.png` | ✅ |
| `dashboard.png` / `02-dashboard.png` | ✅ |
| `process-log.png` | ✅ (new single-page form) |
| `03-log-step1-scan.png` | ✅ |
| `04-log-step2-process.png` | ✅ |
| `05-log-step3-calibration.png` | ✅ |
| `06-log-step4-params.png` | ✅ |
| `16-log-step5-confirm.png` | ✅ (exists but **not referenced** in .docx) |
| `qc-wizard.png` / `07-qc-form.png` | ✅ |
| `08-qc-override.png` | ✅ |
| `09-recipes.png` | ✅ |
| `10-recall-map.png` / `10-recall-search.png` | ✅ |
| `11-reports.png` | ✅ |
| `12-admin-users.png` | ✅ |
| `13-admin-audit.png` | ✅ |
| `14-batches.png` / `batches.png` | ✅ |
| `15-machines.png` | ✅ |
| `alerts.png` | ✅ |
| Active Run bar (bottom of Process Log) | ❌ **Missing — needs new screenshot** |
| Scan page | ❌ **Missing — needs new screenshot** |
| Create batch / Raw material intake modal | ❌ **Missing — needs new screenshot** |
| Sub-batch detail page | ❌ **Missing — needs new screenshot** |
| Mixing workspace inline (§4 of process log) | ❌ **Missing — needs new screenshot** |

---

## Content gaps (10 items)

### GAP-01 — "Awaiting QC" missing from Batch Status table (§2)
- **Where:** Section 2, Batch Status table
- **What's wrong:** Table lists In Progress, Released, On Hold, Quarantine, Scrapped — but omits **Awaiting QC**
- **Why it matters:** Every batch enters Awaiting QC after a process step is logged. Operators will see this status constantly and have no guide explanation for it
- **Fix:** Add row to the status table:

  | Status | Meaning |
  |--------|---------|
  | Awaiting QC | Process step completed; waiting for a QC check to be run and reviewed by an Engineer |

---

### GAP-02 — Global search (Cmd+K / Ctrl+K) not mentioned
- **Where:** Not documented anywhere in the .docx
- **What's wrong:** The fastest way to find any batch, lot, recipe, or machine is completely absent
- **Why it matters:** Core UX feature; operators and engineers use it constantly
- **Fix:** Add a short paragraph to §3 Getting Started and a row in §7 Quick Reference:
  > Press **Ctrl+K** (Windows) or **Cmd+K** (Mac) anywhere in the app to open the command palette. Type a batch number, lot, recipe name, or machine — results appear live. Select any result to jump straight to its page.

---

### GAP-03 — Lots workflow absent
- **Where:** §7 Quick Reference has no row for lots; no workflow section exists
- **What's wrong:** No "Create a lot for shipping" workflow documented
- **Why it matters:** Lots are the final step before finished product leaves the facility — an Engineer-level task
- **Fix:** Add to §5 Engineer Workflows:

  **5.x Creating a Lot for Shipping**
  1. Open **Lots** from the sidebar.
  2. Start a new lot.
  3. Select the **Released** sub-batches to include.
  4. Assign unit serial numbers.
  5. Save — Flint generates the lot and assigns QR codes to each unit.

  Also add row to §7 Quick Reference: `Create a shipping lot | Lots | Engineer`

---

### GAP-04 — §4.1 Raw Material Intake omits "QC Approved from Lab?" gate
- **Where:** Section 4.1, step-by-step workflow
- **What's wrong:** Workflow skips the Y/N question that determines whether the batch registers as In Progress or On Hold
- **Why it matters:** An operator who answers No (the default) will see their batch immediately go On Hold — without explanation in the guide, this looks like an error
- **Fix:** Add as a step between "Enter the quantity received" and "Tap Submit":
  > Answer **"QC Approved from Lab?"** — select **Yes** if the lab has cleared this material; select **No** (the default) if it is still pending lab sign-off. A batch registered with **No** will be placed **On Hold** until an Engineer reviews and releases it.

---

### GAP-05 — §4.3 Process Step missing Section 5 (Confirm & Submit)
- **Where:** Section 4.3, process log description
- **What's wrong:** The process log has five numbered sections. Section 5 (Review & Submit) is not documented. Screenshot `16-log-step5-confirm.png` exists but is never referenced
- **Fix:** Add Section 5 description and wire in the existing screenshot:
  > **Section 5 — Review & Submit:** A summary of the run appears. Review the equipment, recipe, and parameter values. Tap **Submit log** to save. The batch is marked **Awaiting QC**.

---

### GAP-06 — Mixing ratio calculator not documented
- **Where:** Section 4.7 Recording Mixing Steps
- **What's wrong:** The ratio calculator — the collapsible card that reads recipe ratios and pre-fills the next material's quantity — is not mentioned at all
- **Why it matters:** This is one of the most useful operator tools; without it documented operators won't discover it
- **Fix:** Add to §4.7 after the "Add step" instruction:
  > **Ratio calculator:** expand the calculator card at the top of the mixing section. Enter your total batch size and Flint computes how much of each material you need from the recipe ratios. The quantity for the next material is automatically pre-filled in the Add step form.

---

### GAP-07 — Sub-batch detail page not documented
- **Where:** No section covers it
- **What's wrong:** The doc explains how to *create* sub-batches but never covers the sub-batch detail page — what it shows (genealogy panel, process step button, status history) or that Engineers/Admins can edit it
- **Fix:** Add a brief description after §4.6 or in §7 Quick Reference explaining what opens when you tap a sub-batch in the list

---

### GAP-08 — §2 has an unfilled diagram placeholder
- **Where:** Section 2, The Production Process
- **What's wrong:** The text reads `[DIAGRAM: process flow with the five material paths converging at Assembly — replace this placeholder]`
- **Fix:** Replace with the process-flow table (already in §4 of the existing markdown guide):

  | Material | Journey |
  |----------|---------|
  | Cathode electrode | Mixing → Coating / Oven Drying → Calendaring → Die Cut |
  | Anode electrode | Die Cut only |
  | Separator | Cutting → Slitting |
  | Casing | Slitting |
  | Electrolyte | Mixing only |
  | Final assembly | All materials → Assembly → QR code generated |

  Alternatively, commission a proper flow diagram and insert as an image.

---

### GAP-09 — Password reset flow is incomplete
- **Where:** §3 Getting Started + §6.1 Managing Users
- **What's wrong:** §3 says "contact your Admin" but never explains what the Admin does. §6.1 doesn't mention that Admins can reset passwords from the user row
- **Fix:**
  - §3: *"If you've forgotten your password, contact your Admin. They can reset it from Admin → Users."*
  - §6.1: Add step — *"To reset a user's password, click the password-reset button on their row, enter a new password, and confirm. The user can log in immediately."*

---

### GAP-10 — Maintenance checklist not documented
- **Where:** Section 6.2 Managing Equipment
- **What's wrong:** §6.2 mentions "Log maintenance" but doesn't describe the per-machine checklist feature
- **Why it matters:** Admins define the task items per machine; operators are expected to fill them in during maintenance logging
- **Fix:** Add to §6.2:
  > **Maintenance checklist:** when adding or editing a machine, Admins can define a checklist of task items (e.g. "Check oil level", "Inspect blade"). When an operator logs maintenance for that machine, each task item appears with a Done (Y/N) toggle and optional Remarks field.

---

## Formatting issues (5 items)

### FMT-01 — §4.3 process-log sections read bottom-to-top
- **What's wrong:** The five process-log sections are laid out as a visual staircase in the .docx (Section 5 at the top of the block, Section 1 at the bottom). In any linear export or reflowed view (PDF, web, mobile) this reads in reverse
- **Fix:** Reorder the section descriptions 1 → 2 → 3 → 4 → 5, top to bottom, as a numbered list

### FMT-02 — §4.5 QC input branches listed 4 → 1
- **What's wrong:** Same reverse-staircase pattern — the four branch types are presented in descending order (4, 3, 2, 1) instead of ascending (1, 2, 3, 4)
- **Fix:** Reorder to 1 → 2 → 3 → 4

### FMT-03 — §3 Getting Started has author notes in body copy
- **What's wrong:** The landing page description contains draft annotations mixed into running prose:
  > *"A brief description of the platform / Headline: 'Every batch. Every step. Fully traced.' / A green 'Log In →' button at the top right — the only action on this page / Flint Labs logo and branding at the top left / Before you log in, you'll see the Flint Labs welcome screen."*
- **Fix:** Rewrite as finished prose:
  > Before you log in, you'll see the Flint Labs welcome screen. It shows a brief description of the platform and a green **Log In →** button in the top right. Click it to proceed.

### FMT-04 — QC Override caption contains in-progress author note
- **What's wrong:** Caption reads: *"QC Override — failed batches awaiting Engineer review. (need to confirm this)"*
- **Fix:** Remove the parenthetical. Confirm the screenshot is accurate, then use: *"QC Override — failed batches awaiting Engineer review."*

### FMT-05 — §5.6 Alerts has no visual break before §6 Admin Workflows
- **What's wrong:** Section 5.6 ends mid-flow and rolls straight into the §6 header with no separator, making it appear as a continuation of Section 5
- **Fix:** Add a horizontal rule or page break between §5.6 and §6

---

## Priority order

| Priority | ID | Fix |
|:---:|---|---|
| 🔴 Must | GAP-01 | Add "Awaiting QC" to status table |
| 🔴 Must | GAP-08 | Replace diagram placeholder in §2 |
| 🔴 Must | FMT-03 | Clean up author notes in §3 landing page text |
| 🔴 Must | FMT-04 | Remove "(need to confirm this)" from QC Override caption |
| 🔴 Must | GAP-05 | Add Process Log Section 5 + wire in `16-log-step5-confirm.png` |
| 🟡 Important | GAP-02 | Add Global search (Cmd+K) |
| 🟡 Important | GAP-03 | Add Lots workflow to §5 + Quick Reference |
| 🟡 Important | GAP-04 | Add "QC Approved from Lab?" gate to §4.1 |
| 🟡 Important | GAP-06 | Add mixing ratio calculator to §4.7 |
| 🟡 Important | GAP-09 | Complete password reset flow (both sides) |
| 🟡 Important | FMT-01 | Fix §4.3 section order (bottom-to-top staircase) |
| 🟡 Important | FMT-02 | Fix §4.5 QC branch order |
| 🟡 Important | FMT-05 | Add visual break before §6 |
| 🟢 Nice to have | GAP-07 | Document sub-batch detail page |
| 🟢 Nice to have | GAP-10 | Document maintenance checklist in §6.2 |
| 🟢 Nice to have | — | Take 5 missing screenshots (Active Run bar, Scan, Create batch, Sub-batch detail, Mixing workspace) |

---

## Open design question (pending user decision)

**Should `flint_user_guide_3.docx` and `docs/FLINT_USER_GUIDE.md` be kept as two separate documents, or merged?**

- The `.docx` is role-oriented (better for operators on the floor), uses Word formatting, and is the client-facing document
- The `.md` guide is screen-oriented (better for the Gemini Gem / help assistant) and lives in the repo
- They serve different audiences and could legitimately stay separate — but they will drift unless there's a process to keep them in sync
- One option: treat the `.md` as the source of truth; generate the `.docx` from it (via Pandoc) so there's only one thing to maintain

This decision should be made before any edits are applied.

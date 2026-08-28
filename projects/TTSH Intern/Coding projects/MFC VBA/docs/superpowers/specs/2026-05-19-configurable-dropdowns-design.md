# Configurable Dropdowns Design
**Date:** 2026-05-19
**Scope:** Inflight FC Status (col A) and Staff Follow Up (col C) dropdowns in the MFC output file

---

## Problem

`AddDropdowns` in `BuildOutput.bas` hardcodes dropdown values as comma-separated `Formula1` strings. Updating the staff list or FC status options requires editing VBA — inaccessible to non-technical users.

---

## Solution Overview

Store the dropdown lists on a visible **"Config"** worksheet in the macro `.xlsm`. Non-technical users edit the sheet directly (no VBA). At run time, the macro reads those lists, writes them to a hidden **"Lists"** sheet in the output `.xlsx`, and applies range-based dropdown validation pointing at that sheet.

---

## Config Sheet Layout

Sheet name: `Config` (added to the macro `.xlsm`)

| Column A | Column B |
|----------|----------|
| **Inflight FC Status** (header, row 1) | **Staff Follow Up** (header, row 1) |
| Pending | Alice Tan |
| In Progress | Bob Lim |
| Completed | Carol Ng |
| Cancelled | *(add more rows below)* |
| On Hold | |

- Row 1: bold column headers
- Data starts at row 2; users add/remove rows freely
- A brief instruction label in cell D1 explains the sheet purpose

---

## Run-Time Flow

1. `AddDropdowns` reads `ThisWorkbook.Sheets("Config")`:
   - Column A from row 2 downward until first blank → `inflightList()` array
   - Column B from row 2 downward until first blank → `staffList()` array

2. Creates a hidden sheet named `"Lists"` in the output `.xlsx`:
   - Writes `inflightList` to `Lists!A2:AN` (N = item count)
   - Writes `staffList` to `Lists!B2:BN`
   - Sets sheet visibility to `xlSheetVeryHidden`

3. Applies `xlValidateList` to the output sheet:
   - Col A (Inflight FC Status): `Formula1 = "=Lists!$A$2:$A$" & N`
   - Col C (Staff Follow Up): `Formula1 = "=Lists!$B$2:$B$" & N`
   - Range-based reference has no 255-character limit

---

## Error Handling

| Condition | Behaviour |
|-----------|-----------|
| `Config` sheet missing from macro workbook | `MsgBox` error, exit `AddDropdowns` gracefully |
| A list column is empty (no items below header) | Skip validation for that column; leave it free-text |
| Output file already has a `Lists` sheet | Delete and recreate it fresh each run |

---

## Affected Code

| File | Change |
|------|--------|
| `BuildOutput.bas` | Rewrite `AddDropdowns` only — all other subs/functions unchanged |
| Macro `.xlsm` | Add `Config` worksheet with initial values and instruction label |

---

## Out of Scope

- Sheet protection on the Config sheet
- Syncing the Config sheet to any external file
- Any changes to columns D–O of the output file

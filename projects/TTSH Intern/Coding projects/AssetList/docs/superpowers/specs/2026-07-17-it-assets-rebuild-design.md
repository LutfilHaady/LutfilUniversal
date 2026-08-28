# IT Assets Workbook Rebuild — Design

**Date:** 2026-07-17
**Source file:** `July 2026 FC IT Assets Management list (Cost centre checked).xlsx` (stays untouched, read-only source)
**Output file:** `July 2026 FC IT Assets Management list (Cost centre checked) (Rebuild).xlsx`, same folder

## Purpose

Rebuild the IT assets workbook so a single `MASTER (All Depts)` sheet amalgamates all 5 department
sheets and auto-updates on open, without VBA (source workbook lives on SharePoint with concurrent
editors and Excel Online access — VBA and co-authoring don't mix).

This design consolidates the prior investigation session's handoff notes (structural/data-integrity
findings, verified column mapping, threaded comments) with the decisions confirmed in this session.
Full background, landmine list, and rationale live in the handoff notes already reviewed; this doc
records what was decided and what will be built.

## Architecture

Excel Tables per dept sheet (`tbl_A1L5`, `tbl_ICHPSO`, `tbl_PSOINF`, `tbl_AONCID`, `tbl_EDFC`) →
Power Query `Table.Combine` over all `tbl_*` tables → single `MASTER` sheet, refresh-on-open,
protected but insert/delete/sort/filter allowed (required for PQ refresh to add/remove rows on a
protected sheet). Built via Excel COM automation (confirmed available: Excel 16.0, pywin32 present)
in a single load→edit→save pass — this is what makes it possible to create the Power Query
programmatically (`wb.Queries.Add`), sidestepping the smart-quote paste-corruption bug that blocked
the prior session's manual M-code entry, and preserves the one legacy form control that openpyxl
can't touch (A1 L5 `Group Box 1`).

## Canonical schema (identical on all 5 dept sheets)

| # | Column | Notes |
|---|---|---|
| 1 | `Asset ID` | New scheme, decided below |
| 2 | `Dept Ref No.` | Original `No.`, preserved verbatim |
| 3 | `Asset Group` | New — preserves stacked-block structure (decided below) |
| 4 | `User` | |
| 5 | `Asset Type` | Free text, as entered |
| 6 | `Asset Category` | Formula + dropdown, 9 canonical values |
| 7 | `ITD Tag No.` | |
| 8 | `Serial No.` | Whitespace/NBSP-cleaned on import |
| 9 | `Finance Asset Tag` | |
| 10 | `Host Name` | |
| 11 | `Location` | |
| 12 | `Nickname` | |
| 13 | `Topaz Installation` | |
| 14 | `NGEMR EUD Deployment` | |
| 15 | `Deployment Date` | |
| 16 | `TDR Status` | |
| 17 | `TDR Updated Date` | |
| 18 | `Reprint Needed (Nov 2024)` | |
| 19 | `Cost Centre` | Formula, keyed on Serial No. against `Fixed Asset list!H` |
| 20 | `Status` | Formula, keyed on Serial No. against Condemned/Dirty Laptop |
| 21 | `Last Updated` | |
| 22 | `Remarks` | General |
| 23 | `TDR Remarks` | Tech-refresh notes — kept separate from `Remarks`, not merged |

Asset Category values: `Laptop`, `Tablet`, `Monitor + CPU`, `CPU`, `Printer`, `Document Scanner`,
`Topaz Signature Pad`, `Nets Machine`, `Other (Review)`.

Source-column mapping (per dept, header row 2, verified against the live workbook) and the 5
threaded comments to reinject are taken as-is from the prior session's handoff notes — not
re-derived here.

## Decisions confirmed this session

1. **Duplicate serials (9 pairs, e.g. `X5XV000555` in ICH PSO + AO+NCID)** — import all rows as-is;
   list every pair on a new `Data Issues` sheet. Do not guess which record is correct or drop either.
2. **Block structure** (e.g. PSO Office: Laptops → Scanners → Signature Pads, `No.` restarting each
   block) — add an `Asset Group` column carrying the block label instead of flattening.
3. **Asset ID scheme** — the existing `dept-No.` scheme is broken (not unique, since `No.` restarts
   per block). Replace with a new sequential per-dept ID (`A1L5-001`, `A1L5-002`, …), and keep the
   original `No.` as `Dept Ref No.` for continuity.
4. **Junk rows** (PSO Office rows 37–43 free-text notes; AO+NCID rows 53–54 placeholders with no
   asset details) — move to a `Notes` sheet, out of the asset tables, so they stop inflating counts.
5. **AO+NCID rows 38–54 (`2026-01..2026-17` block)** — possibly a re-inventory of rows 20–37 (serial
   `X5XV000534` appears in both), possibly genuinely new; only Fatris can confirm. Import both blocks
   as-is; add a `Data Issues` entry asking Fatris to confirm. Counts may be inflated until resolved.
6. **Hidden columns** (A1L5: J,M,O,R · ICHPSO: K · AONCID: L,M,O,P in the original) — unhide all in
   the rebuild; nothing hidden by accident, matches the canonical schema (no hidden columns).
7. **`Other (Review)` Asset Category rows (10 rows)** — ship with the amber flag as-is; don't block
   the rebuild on manual reclassification of edge cases.
8. **OVERVIEW sheet** — rebuild as live formulas (COUNTIFS etc.) against the new dept tables instead
   of hardcoded counts (some already known stale, e.g. ICH PSO Laptop hardcoded `1` vs actual `0`).
   TTSH AO / NCID sub-split stays manual — needs a `Sub-team` column from Fatris, out of scope here.
9. **External dependencies** — confirmed by Lutfil: nothing outside the workbook reads it (no Power
   BI report, macro, or saved filter view depends on current structure). No reminder flag needed.
10. **Legacy form control** (A1 L5 `Group Box 1`) — kept, via COM automation (confirmed available).
11. **Output** — new file, source untouched: `...(Cost centre checked) (Rebuild).xlsx`, same folder.

## Data Issues sheet (new)

Ships in the rebuilt workbook as a visible worklist, not silent problems:
- The 9 duplicate-serial pairs (§ decision 1)
- AO+NCID rows 38–54 vs 20–37 possible re-inventory, flagged for Fatris (§ decision 5)
- The `XSXV00530` (AO+NCID r48) vs `X5XV000530` (AO+NCID r22) likely-typo serial pair
- PSO Office: `Cost Centre` empty for all 41 rows (pre-existing, not introduced by rebuild)
- The 10 `Other (Review)` Asset Category rows, as a pointer list

## Build phases

1. Extract & normalise all 5 dept sheets into one in-memory structure using the verified column
   mapping; strip whitespace/NBSP, classify Asset Category, tag Asset Group, assign new Asset ID,
   split out junk rows to Notes. Assert row count in == rows accounted for (assets + notes).
2. Build the new workbook via COM: one dept sheet per department, canonical schema, real Tables
   (`ws.ListObjects.Add`), no pre-existing AutoFilter/Table collision. Reinject the 5 threaded
   comments + 4 legacy plain comments on EDFC. Keep A1 L5's form control.
3. Formulas inside the tables (not Power Query) for `Asset Category`, `Cost Centre`, `Status`, so
   they auto-fill when a user adds a row. Convert `Condemned`, `Dirty Laptop`, `Fixed Asset list` to
   Tables so lookups use structured refs.
4. Data validation dropdown on `Asset Category` (9 values) with headroom rows.
5. Power Query `MASTER` sheet created via `wb.Queries.Add`, `Table.Combine` over `tbl_*`, load to
   sheet, refresh-on-open.
6. Protect `MASTER` (allow insert/delete rows, sort, filter — required for refresh on a protected
   sheet).
7. Rebuild `OVERVIEW` as formulas against the new tables.
8. Add `Data Issues` and `Notes` sheets.
9. Verify: open via COM, assert no repair prompt; value-diff every source row into the new file;
   assert `Asset ID` uniqueness; assert zero formula errors; refresh MASTER and check row count;
   add/remove a test row in a dept table and confirm MASTER reflects it after refresh.

## Out of scope

- Resolving the 9 duplicate serials or the AO+NCID 2026-block question — needs the dept owners,
  tracked on `Data Issues` instead.
- `Sub-team` column for AO+NCID (needed to fully automate the OVERVIEW TTSH/NCID split) — needs
  Fatris to add it to their sheet; OVERVIEW ships with that one split still manual.
- Notifying staff about the header/layout change before rollout — organizational step, not a build
  step.

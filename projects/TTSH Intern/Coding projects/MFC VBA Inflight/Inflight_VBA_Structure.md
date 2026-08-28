# Inflight MFC Macro -- VBA Structure & Architecture

## Overview

The Inflight MFC macro automates the daily MFC report for the Inflight Financial
Counselling team at TTSH. It is a **separate project** forked from the NCID MFC macro,
sharing the same data pipeline architecture but with different ward filters, output
columns, and dropdown values.

The macro takes 4 Excel inputs, processes them through a series of filter and enrichment
steps, and produces a formatted `.xlsx` report with dropdowns and conditional formatting.

**Reference document:** `docs/Inflight_Macro_Context.md` contains the full workflow,
column mappings, filter logic, and dropdown values.

---

## Planned Repository Layout

| Path | Purpose | Reuse from NCID |
|------|---------|-----------------|
| `MainMacro.bas` | `GenerateMFCReport` -- orchestrates all steps in order | Fork -- different step count (discharge filter is separate) |
| `Helpers.bas` | File pickers, validation, `FindColByHeader`, `CreateConfigSheet` | Reuse as-is (update Config defaults for Inflight) |
| `CombineEFC.bas` | Stacks missed FC rows below main EFC rows | Reuse as-is |
| `ExtractDate.bas` | Reformats Admission Date, inserts "Adm Date for MFC" column | Reuse as-is |
| `FilterFCStatus.bas` | Keep Draft/Missed rows; drop completed/attempted statuses | Fork -- Inflight removes ALL discharged (including Missed FC) |
| `FilterWard.bas` | Point of Care excludelist filter (replaces NCID `FilterBedCode`) | **New** -- completely different filter mechanism |
| `EpicLookup.bas` | Bulk dictionary lookup of Bed + Admit Status from Epic | Fork -- different inserted column names ("Final Bed" not "Bed Point Of Care") |
| `FlagDuplicates.bas` | Highlights duplicate Encounter No + Patient Name rows red | Reuse as-is |
| `BuildOutput.bas` | Creates output xlsx with headers, data, formatting | Fork -- different column map (15 cols A--O, not 16) |
| `OutputWriter.bas` | Writes/formats output cells, borders, font, freeze panes | Fork -- different column count |
| `Backlog.bas` | Carry-forward cols A--D + backlog counts | Reuse with minor adjustments (column count) |
| `SummaryTable.bas` | Writes bottom summary table | Reuse as-is |
| `Dropdowns.bas` | Output dropdowns (Resolution Status, Inflight FC Status, Staff Follow Up) | Fork -- 20-item Inflight FC Status list, different Config defaults |
| `FilePickerForm.bas` | Dashboard-style file selection with live validation | Reuse as-is |
| `ProgressForm.bas` | Modeless progress-bar window shown during a run | Reuse as-is |
| `MFC_All_Modules.txt` | Concatenated deliverable -- staff pastes into Excel VBA editor | New build (generated from all `.bas` files) |
| `docs/Inflight_Macro_Context.md` | Full domain context for Inflight | New (already written) |

---

## Module Classification

### Reuse as-is (no changes needed)

| Module | Why it works unchanged |
|--------|------------------------|
| `Helpers.bas` | `FindColByHeader`, `NormHeader`, `PickFile`, `ValidateFileHeaders` are generic. `CreateConfigSheet` needs updated defaults (see Config Changes below) |
| `CombineEFC.bas` | Stacking rows is identical regardless of department |
| `ExtractDate.bas` | Admission Date format is the same in both eFC reports |
| `FlagDuplicates.bas` | Encounter No + Patient Name duplicate logic is identical |
| `SummaryTable.bas` | Same 6-row summary table structure |
| `FilePickerForm.bas` | Same 4-file input pattern |
| `ProgressForm.bas` | Generic progress bar |

### Fork with modifications

| Module | What changes |
|--------|-------------|
| `MainMacro.bas` | Step ordering: discharge filter is a separate step (step 6) before ward filter (step 7). Different step count in status bar messages. |
| `FilterFCStatus.bas` | Remove ALL discharged cases including Missed FC rows (NCID keeps discharged Missed FC). The FC Status allowlist values are the same (Draft variants + Missed FC = Yes). |
| `EpicLookup.bas` | Inserted column names change: "Final Bed" instead of "Bed Point Of Care". "Epic Admission Status" instead of "Epic Admission Status/Discharged". |
| `BuildOutput.bas` | Different output column map -- 15 columns (A--O) instead of 16 (A--P). No "Admit Status" column from eFC. "Final Bed" instead of "Point of Care Final Bed". Column indices in `colMap` array change accordingly. |
| `OutputWriter.bas` | Adjusted for 15 columns (col O is last, not col P). |
| `Backlog.bas` | Column references update (col G still Encounter Number, but last data col is O not P). |
| `Dropdowns.bas` | 20-item Inflight FC Status dropdown values. Different Config sheet defaults. |

### New modules

| Module | Purpose |
|--------|---------|
| `FilterWard.bas` | **Replaces `FilterBedCode.bas` entirely.** Filters by Point of Care column using an excludelist. Removes rows whose Point of Care matches any value in `EXCLUDED_WARDS` constant. No bed-code parsing needed. |

---

## Key Architecture Decisions

### 1. Point of Care excludelist (not bed-code allowlist)

NCID uses `Mid(bed, 2, 3)` to extract a 3-character ward code from the Epic bed string
and matches against a 12-ward allowlist. This works because NCID covers a small number
of specific wards.

Inflight covers most of the hospital. An excludelist on the **Point of Care** column
(eFC data) is more natural:

```vba
Private Const EXCLUDED_WARDS As String = "AUC,EDC,EDTC,EDX,O14,O15,3E/F,6E/F,8E,TWAS,TWDS"
```

The filter loads all data into memory, checks each row's Point of Care against the
excludelist dictionary, compacts matching rows, and writes back -- same load-filter-write
pattern as NCID's `FilterBedCode`.

### 2. Discharge filter as a separate step

In NCID, the discharge check is embedded in `FilterFCStatus` (Missed FC rows bypass it).
In Inflight, ALL discharged cases are removed regardless of Missed FC status. This is
cleaner as a separate step that runs after Epic lookup (so we can use Epic Admission Status)
and before the ward filter.

**Step sequence:**
1. Combine EFC files
2. Extract Admission Date
3. Filter FC Status (keep Draft + Missed FC rows)
4. Epic lookup (get Final Bed + Epic Admission Status)
5. **Filter discharged** (remove ALL rows where discharged)
6. Filter by Point of Care (Inflight ward excludelist)
7. Flag duplicates
8. Build output
9. Backlog summary

### 3. Output column map (15 columns, A--O)

| Output Col | Header | Source |
|------------|--------|--------|
| A | Inflight FC Status | Manual dropdown (20 values from Config) |
| B | Date Updated (DD/MM/YYYY) | Manual date picker |
| C | Staff Follow Up (if any) | Manual dropdown (Config) |
| D | Remarks | Manual |
| E | Resolution Status | Manual: Follow Up / Resolved |
| F | FC ID | EFC col A |
| G | Encounter Number | EFC col C |
| H | MRN | EFC col D |
| I | Patient Name | EFC col F |
| J | Adm Date for MFC | EFC col H (reformatted DD/MM/YYYY) |
| K | FC Status | EFC col AQ |
| L | Point of Care | EFC col K |
| M | Final Bed | Epic col H (via CSN lookup) |
| N | Admission Level Of Care | EFC col L |
| O | Epic Admission Status | Epic col E (via CSN lookup) |

**Differences from NCID output:**
- No "Admit Status" column (eFC Admission Status -- NCID col L)
- "Final Bed" replaces "Point of Care Final Bed"
- "Epic Admission Status" replaces "Epic Admission Status/Discharged"
- Total: 15 columns (A--O) vs NCID's 16 (A--P)

### 4. Emergency-only Admission Type

The eFC export is configured with Admission Type = Emergency only.
The macro does not need to filter by Admission Type post-export since the eFC report
already contains only Emergency admissions. If this changes in future, add an
Admission Type filter step similar to NCID's handling.

---

## Config Sheet Changes

The `CreateConfigSheet` sub needs updated defaults for Inflight:

### Inflight FC Status (Column A) -- 20 values
```
No Attempt
Attempted - Pending FC
FC Complete - CCF left with NOK
FC Complete - CCF signed
FC Completed @ ED
FC Declined @ ED
FC Declined @ Inflight
Discharged -- MCAF
Discharged - No MCAF
Uncontactable NOK with MCAF
Transfer to NCID/Renci
Planned Transfer
C Class with MediFund Activated
Nursing Home Case / No NOK
Deceased
Received unsigned CCF/FC/ReFC
Non-Inflight Case
Explained CCF but Declined FC form
LOG Template
Others (to indicate in Remarks)
```

### Staff Follow Up (Column B)
Placeholder names -- replace with actual Inflight team member names after setup.

---

## FilterWard.bas -- Specification

**Purpose:** Remove rows whose Point of Care is in the Inflight excludelist.

**Input:** Working sheet after Epic lookup (has "Point Of Care" column from eFC).

**Algorithm:**
1. Locate "Point Of Care" column by header (`FindColByHeader`)
2. Build excludelist dictionary from `EXCLUDED_WARDS` constant
3. Load entire sheet into memory (one read)
4. Count rows whose Point of Care is NOT in the excludelist
5. Build compacted array of kept rows
6. Write back (one write) + delete tail rows (one delete)

**Constant:**
```vba
Private Const EXCLUDED_WARDS As String = "AUC,EDC,EDTC,EDX,O14,O15,3E/F,6E/F,8E,TWAS,TWDS"
```

**Matching:** Case-insensitive, trimmed. A row is REMOVED if its Point of Care value
(after `UCase(Trim(...))`) matches any entry in the excludelist dictionary.
Blank Point of Care values are also removed.

**Performance:** Same load-filter-write pattern as NCID's `FilterBedCode`.
Total Excel interactions: 1 read + 1 write + 1 delete.

---

## FilterDischarge.bas -- Specification

**Purpose:** Remove all rows where the patient has been discharged.

**Input:** Working sheet after Epic lookup (has both eFC "Admission Status" and
"Epic Admission Status" columns).

**Algorithm:**
1. Locate "Epic Admission Status" column by header (preferred)
2. If not found, fall back to "Admission Status" (eFC column)
3. Load entire sheet into memory
4. Remove rows where the status value = "Discharged" (case-insensitive)
5. Write back + delete tail

**Key difference from NCID:** NCID's `FilterFCStatus` preserves Missed FC rows even when
discharged. Inflight removes ALL discharged rows unconditionally.

---

## EpicLookup.bas -- Changes from NCID

| Aspect | NCID | Inflight |
|--------|------|----------|
| Bed column name | "Bed Point Of Care" | "Final Bed" |
| Insert position | Before "Point Of Care" | After "Point Of Care" (or at end) |
| Admit Status column name | "Epic Admission Status/Discharged" | "Epic Admission Status" |
| Lookup logic | Identical | Identical |

The insert-before-Point-Of-Care approach in NCID was done so the bed column sits next to
Point of Care in the working sheet. For Inflight, "Final Bed" can be inserted after
Point of Care or appended at the end -- the exact position does not matter since
`BuildOutput` resolves all columns by header.

---

## BuildOutput.bas -- Changes from NCID

### Column map (11 data columns instead of 11, but different mapping)

```vba
' Inflight output: cols F--O (10 data columns)
Dim colMap(1 To 10) As Long
colMap(1)  = srcFCID       ' F
colMap(2)  = srcEncNo      ' G
colMap(3)  = srcMRN        ' H
colMap(4)  = srcPatName    ' I
colMap(5)  = srcAdmDate    ' J  (Adm Date for MFC)
colMap(6)  = srcFCStat     ' K  (FC Status)
colMap(7)  = srcPOC        ' L  (Point of Care)
colMap(8)  = srcBed        ' M  (Final Bed)
colMap(9)  = srcAdmLevel   ' N  (Admission Level Of Care)
colMap(10) = srcEpicStat   ' O  (Epic Admission Status)
```

**Removed from NCID:** `srcAdmStat` (eFC Admission Status) is not in the Inflight output.

### Source columns resolved by header

| Working Sheet Header | Variable | Output Col |
|---------------------|----------|------------|
| FC ID | srcFCID | F |
| Encounter No | srcEncNo | G |
| MRN | srcMRN | H |
| Patient Name | srcPatName | I |
| Adm Date for MFC | srcAdmDate | J |
| FC Status | srcFCStat | K |
| Point Of Care | srcPOC | L |
| Final Bed | srcBed | M |
| Admission Level Of Care | srcAdmLevel | N |
| Epic Admission Status | srcEpicStat | O |

### Output headers

```vba
Dim headers(1 To 15) As String
headers(1)  = "Inflight FC Status"
headers(2)  = "Date Updated (DD/MM/YYYY)"
headers(3)  = "Staff Follow Up (if any)"
headers(4)  = "Remarks"
headers(5)  = "Resolution Status"
headers(6)  = "FC ID"
headers(7)  = "Encounter Number"
headers(8)  = "MRN"
headers(9)  = "Patient Name"
headers(10) = "Adm Date for MFC"
headers(11) = "FC Status"
headers(12) = "Point of Care"
headers(13) = "Final Bed"
headers(14) = "Admission Level Of Care"
headers(15) = "Epic Admission Status"
```

### Formatting adjustments
- Table range: `A1:O{lastRow}` (not P)
- Column autofit: `A:O` (not A:P)
- Conditional formatting range: `A2:O{lastRow}`

---

## Architecture Conventions (same as NCID)

These invariants carry over unchanged:

- **Resolve columns by header, never by hardcoded index.** Use `FindColByHeader(ws, "Header Name")`.
- **Load-process-write in bulk.** Read a range into a Variant array, process in memory, write back.
- **No hardcoded file paths.** All file selection via `Application.FileDialog`.
- **One responsibility per module.** Orchestration stays in `MainMacro`.
- **`Option Explicit` in every module.**
- **Guard `FindColByHeader` returns.** Always check for 0 before using the column index.
- **No `IIf()` with array access.** Use explicit `If col > 0 Then` guards.
- **Use `Encounter No` for `lastRow`.** FC ID is blank in missed FC rows.

---

## Dual-Source Maintenance

Same as NCID: the code exists in individual `.bas` files (dev source) and in
`MFC_All_Modules.txt` (staff deliverable). Every change must be applied to both.

---

## Implementation Sequence

Recommended order for building the Inflight macro:

1. **Set up repo** -- copy reusable modules from NCID
2. **Modify `CreateConfigSheet`** -- 20-item Inflight FC Status defaults
3. **Write `FilterWard.bas`** -- Point of Care excludelist (new)
4. **Write `FilterDischarge.bas`** -- discharge removal step (new)
5. **Modify `EpicLookup.bas`** -- rename inserted columns
6. **Modify `FilterFCStatus.bas`** -- remove discharge bypass for Missed FC
7. **Modify `BuildOutput.bas`** -- 15-column output map
8. **Modify `Dropdowns.bas`** -- 20-item dropdown
9. **Modify `MainMacro.bas`** -- updated step sequence
10. **Update `Backlog.bas`** -- adjust column references if needed
11. **Generate `MFC_All_Modules.txt`** -- concatenate all modules
12. **Test with real data** -- ask user to compile and run

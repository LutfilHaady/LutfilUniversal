# MFC Report Macro — Full Context & Code Reference

## Purpose
Automate the manual Excel-based MFC (Missed Financial Counselling) report generation workflow for the Financial Counselling team at Tan Tock Seng Hospital (TTSH).

---

## Inputs
4 Excel files selected by the user through a single **file selection dashboard**
(the `FilePickerForm` UserForm), which shows all 4 slots at once with live `✓ Valid` /
`✗ Invalid` / `○` status and lets the user pick files in any order:

1. **EFC export WITHOUT missed FC cases** — main EFC file
2. **EFC export WITH missed FC cases** — missed FC file
3. **Epic Census Report** — patient bed and admission status
4. **Previous MFC Report** — for backlog tracking

---

## How to Export Each Input File

### Epic Census Report
1. Log into Epic. Click the Epic icon > **Reports > ADT report > Census reports > Census Snapshot Report**. (Pin it for easier access next time.)
2. Click the **Display** tab and select the required columns. Click **Run**.
3. Click **"…"** and select **Export**. Save to a local drive or K drive — you **cannot** export directly to OneDrive.
   - Save path: `K:\Inpatient Ops Financial Counselling\Inflight FC\INFLIGHT-REPORT\INFC <YEAR> FOLDER`
   - File password: `123`

### EFC Reports (both files)
Both EFC reports are exported from **eFC > Reports > Inflight Financial Counselling Report**.

**Settings for both reports:**
- Admission Type: `Emergency` and `Elective Inpa` (for NCID)
- Visit/Admission Date: flip to previous month; select from **1 day after present date** to **present date**
  - Example: present date is 05.03.2026 → select 06.02.2026 – 05.03.2026

**1st report — WITH Missed FC:**
- Tick **"Missed FC"** → click **Submit request**

**2nd report — WITHOUT Missed FC:**
- Untick **"Missed FC"** → click **Submit request** again

### Previous MFC Report
The previous day's (or week's) saved MFC output file. Used only for backlog comparison. No export needed — just locate the file from its save location.

---

## EFC File Column Structure (both EFC files have identical columns)

| Column | Header |
|--------|--------|
| A | FC ID |
| B | Institution |
| C | Encounter No |
| D | MRN |
| E | Residential Type |
| F | Patient Name |
| G | Admission Type |
| H | Admission Date |
| I | Admission Status |
| J | Specialty |
| K | Point Of Care |
| L | Admission Level Of Care |
| M | Accomodation Code |
| N | NeFR Consent Status |
| O | NeFR Consent Status Date |
| P | At-Risk Status |
| Q | Created By |
| R | Created On |
| S | Last Updated By |
| T | Last Updated On |
| U | Performed FC in the past X days |
| V | 1st FC Create User |
| W | 1st FC Create Date |
| X | 1st FC ETBS (Likely) |
| Y | 1st FC ETBS (Complex) |
| Z | 1st FC Estimated Likely OOP (SGD) |
| AA | 1st FC Estimated Complex OOP (SGD) |
| AB | 1st FC LOS |
| AC | 1st FC Specialty |
| AD | 1st Incurred Charges |
| AE | Latest FC Create User |
| AF | Latest FC Create Date |
| AG | Latest FC ETBS (Likely) |
| AH | Latest FC ETBS (Complex) |
| AI | Latest FC Estimated Likely OOP (SGD) |
| AJ | Latest FC Estimated Complex OOP (SGD) |
| AK | Latest FC LOS |
| AL | Latest FC Specialty |
| AM | Latest Incurred Charges |
| AN | Surgical Code |
| AO | Missed FC |
| AP | Re-FC to be performed |
| AQ | FC Status |
| AR | Exceed Estimated Bill size (SGD) - 1st FC |
| AS | Exceed Estimated Bill size (%) - 1st FC |
| AT | Exceed Estimated Bill size (SGD) - Latest FC |
| AU | Exceed Estimated Bill size (%) - Latest FC |
| AV | Bill size variance desc - 1st FC |
| AW | Bill size variance desc - Latest FC |

### Key EFC Data Notes
- **Encounter No (Column C)** — stored as TEXT in EFC. Example: `100241111111`
- **Admission Date (Column H)** — format: `MM/DD/YYYY HH:MM:SS AM/PM`. Example: `12/18/2025 9:31:33 AM`
- **FC Status (Column AQ)** — filter keeps only: `Draft`, `Draft (ETBS Generated)`, `Draft (CCF Generated)` — AND only when `Admission Status` is `Actualised` or `Planned`
- **Missed FC (Column AO)** — rows where `Missed FC = "Yes"` are always kept regardless of FC Status or Admission Status
- **Patient Name (Column F)** — stored in ALL CAPS

---

## Epic File Column Structure

| Column | Header |
|--------|--------|
| A | MRN |
| B | Patient |
| C | Admission Date |
| D | Patient Class |
| E | Admit Status |
| F | CSN |
| G | Phone |
| H | Bed |

### Key Epic Data Notes
- **CSN (Column F)** — stored as NUMBER in Epic. Converted to string (`CStr()`) before matching against EFC Encounter No
- **Admit Status (Column E)** — values are exactly: `Discharged` or `Admission`
- **Bed (Column H)** — example format: `T07E18N`. The ward code is `Mid(bed, 2, 3)` (1-based positions 2–4), e.g. `T07E18N` → `07E`. A row is kept only if its ward code is in the NCID allowlist (see NCID Ward Reference). There may or may not be a trailing character.
- Epic file typically has ~20,000 rows
- All Epic columns are located by header name via `FindColByHeader`

---

## Output File Structure
New `.xlsx` file named: `MFC DD.MM.YYYY TO DD.MM.YYYY`
Date range: current system run date (first) and the date exactly one month ago (second).
Sheet name: `MFC Report`

| Column | Header | Source |
|--------|--------|--------|
| A | Inflight FC Status | Manual — dropdown (from Config sheet); **carried forward** from previous MFC for returning Encounter Numbers |
| B | Date Updated (DD/MM/YYYY) | Manual — date picker (last 31 dates, DD/MM/YYYY format); **carried forward** from previous MFC for returning Encounter Numbers |
| C | Staff Follow Up (if any) | Manual — dropdown (from Config sheet); **carried forward** from previous MFC for returning Encounter Numbers |
| D | Remarks | Manual; **carried forward** from previous MFC for returning Encounter Numbers |
| E | Resolution Status | Manual — dropdown: `Follow Up` / `Resolved`; backlog rows pre-filled as `Follow Up` |
| F | FC ID | EFC Column A (blank for Missed FC rows) |
| G | Encounter Number | EFC Column C |
| H | MRN | EFC Column D |
| I | Patient Name | EFC Column F |
| J | Adm Date for MFC | EFC Column H reformatted to DD/MM/YYYY |
| K | FC Status | EFC Column AQ (blank for Missed FC rows) |
| L | Admit Status | EFC Column I |
| M | Point of Care | EFC Column K |
| N | Point of Care Final Bed | Epic Column H (matched via Encounter No = CSN) |
| O | Admission Level Of Care | EFC Column L |
| P | Epic Admission Status/Discharged | Epic Column E (matched via Encounter No = CSN) |

### Output Save Location
The macro prompts the user to select a save folder via a folder picker dialog. Recommended save path:
`K:\Inpatient Ops Financial Counselling\NCID FC\NCID MFC`

### Output Formatting
- Font: **Aptos Narrow, size 11** across the full table (A1:P{lastRow})
- Inner borders: thin dark grey between all cells
- Outer border: medium weight black around the table boundary
- Col B: formatted as `DD/MM/YYYY` with date validation dropdown (last 31 dates) — triggers Excel 365 calendar-style picker on click
- Col E: dropdown `Follow Up / Resolved`; conditional formatting colours entire rows — **pale gold** for `Follow Up`, **soft sage green** for `Resolved`. Conditional formatting takes priority over the red duplicate highlight.
- Col G (Encounter Number): number format `"0"` (no decimals)
- Col J (Adm Date for MFC): number format `"@"` (text, prevents date re-interpretation)
- Header row height: 30
- Freeze pane below row 1

### Dropdown Configuration
Dropdowns for columns A and C are driven by the macro workbook's **Config sheet** (created via `CreateConfigSheet` in Helpers.bas). Lists are written into a hidden `Lists` sheet inside the output workbook at runtime. Edit the Config sheet directly to update those lists.

- **Column A — Inflight FC Status**: values from "Inflight FC Status" column on Config sheet → written to `Lists!A`
- **Column C — Staff Follow Up (if any)**: values from "Staff Follow Up" column on Config sheet → written to `Lists!B`
- **Column B — Date Updated**: last 31 dates (today down) → written to `Lists!C`
- **Column E — Resolution Status**: fixed inline list `Follow Up, Resolved` — not configurable via Config

---

## Workflow Steps

Steps run in this exact order inside `GenerateMFCReport`.

1. **Open & validate input files** — the `FilePickerForm` dashboard opens and shows all 4 file slots at once. The user clicks `Browse...` on each slot in any order; each file is validated immediately and its slot shows `✓ Valid` or `✗ Invalid`. Each EFC file validated for `FC ID`, `Encounter No`, `FC Status`, `Missed FC`. Epic validated for `CSN`, `Bed`, `Admit Status`, `Patient`. Previous MFC accepted unconditionally. Guards shown inline in the form: duplicate file path check (second EFC slot shows `✗ Same file`) + non-blocking row-count similarity warning between the two EFC files. The `Generate Report` button is enabled only when all 4 slots are `✓ Valid`; `Cancel` closes any opened workbooks and aborts.
2. **Combine EFC files** — paste all data rows (values only, no formats/formulas) from the missed FC file below the last row of the main EFC file. Uses dynamic `lastColMissed` so any column count works.
3. **Extract Admission Date** — finds "Admission Date" by header, reformats from `MM/DD/YYYY HH:MM:SS AM/PM` to `DD/MM/YYYY` string. Inserts new column "Adm Date for MFC" immediately after "Admission Date". Uses `Encounter No` for `lastRow` (not FC ID, which is blank in missed FC rows). All column positions resolved by `FindColByHeader`.
4. **Filter FC Status** — `Function FilterFCStatus(...) As Boolean`. Keeps rows where:
   - `Missed FC = "Yes"` (always kept, regardless of Admission Status), **OR**
   - FC Status ∈ {`Draft`, `Draft (ETBS Generated)`, `Draft (CCF Generated)`} **AND** Admission Status ∈ {`Actualised`, `Planned`}
   
   Draft rows with `Admission Status = Discharged` are dropped (patient has left the ward). Uses `Encounter No` for `lastRow`. Returns `False` (aborts macro) if FC Status column not found or no rows match. Has `On Error GoTo ErrHandler` to restore `Calculation` and `ScreenUpdating` on crash. Runs **before** Epic lookup to reduce row count first.
5. **XLOOKUP from Epic** — `LookupEpicData`. Locates all columns by header. Inserts "Bed Point Of Care" immediately before "Point Of Care" (dynamic position). Appends "Epic Admission Status/Discharged" after the last EFC column. Loads Epic into two `Scripting.Dictionary` objects keyed by CSN string. Resolves EFC Encounter No in one in-memory pass. Writes results in two bulk range assignments.
6. **Filter Bed** — `FilterBedCode`. Finds "Bed Point Of Care" by header. Builds ward allowlist dictionary from `NCID_WARDS` constant. Keeps rows where `Mid(bed, 2, 3)` (1-based chars 2–4) matches an NCID ward code. Drops blanks, `"none"`, or beds shorter than 4 chars. Uses `Encounter No` for `lastRow`. Has `On Error GoTo ErrHandler`.
7. **Flag duplicates** — `FlagDuplicateRows`. Finds "Encounter No" and "Patient Name" by header. Highlights red every row (including first occurrence) where Encounter No + Patient Name combination appears more than once. Staff decide manually which to delete.
8. **Build output** — `BuildMFCOutput`. Resolves all 11 source columns by header via `FindColByHeader`. Validates all are present. Captures red duplicate flags before switching workbooks. Prompts for save folder. Creates new workbook with single sheet "MFC Report". Writes headers A–P, copies data to cols F–P via `colMap` array, applies red highlight, adds dropdowns (via hidden Lists sheet), formats sheet, saves. Returns the output `Workbook` (or `Nothing` on cancel/error). Has `On Error GoTo CleanExit`.
9. **Backlog summary** — `BacklogSummary`. Compares **Encounter Numbers** (col G) against the previous MFC report. Looks up previous report's "Encounter Number" or "Encounter No" column by header. Skips rows whose Resolution Status = "Resolved" in the previous report. For each match: writes "Follow Up" to col E (Resolution Status) and carries forward cols A/B/C/D (Inflight FC Status, Date Updated, Staff Follow Up, Remarks). Writes all carry-forward data in two bulk array writes. Then, sorts the data rows descending by Resolution Status (Column E) so that all backlog cases (marked "Follow Up" / amber) are grouped at the top. Finally, calls `WriteSummaryTable` to write a 6-row summary table 3 rows below the last data row. Saves the workbook after writing.

---

## Working Sheet Column Map After All Inserts

All modules use `FindColByHeader` — column positions below are the ground truth but the code does not depend on them being exact.

| Step | Action | Result |
|------|--------|--------|
| Original EFC | — | 49 columns (A–AW) |
| ExtractAdmissionDate | Insert at col after "Admission Date" (col 8) | 50 columns. Cols ≥ 9 shift +1 |
| FilterFCStatus | Rows deleted only | No column change |
| LookupEpicData | Insert before "Point Of Care" (col 12 after prior insert) | 51 columns. "Point Of Care" and cols to its right shift +1 |
| LookupEpicData | Append "Epic Admission Status/Discharged" after last col | 52 columns |

**Typical final column positions (used by BuildOutput as source columns):**

| Working Sheet Col | Content | Origin |
|-------------------|---------|--------|
| 1 | FC ID | EFC col A — never shifts |
| 3 | Encounter No | EFC col C — never shifts |
| 4 | MRN | EFC col D — never shifts |
| 6 | Patient Name | EFC col F — never shifts |
| 8 | Admission Date | EFC col H — never shifts |
| 9 | Adm Date for MFC | Inserted by ExtractAdmissionDate |
| 10 | Admission Status | EFC col I — was 9, +1 |
| 12 | Bed Point Of Care | Inserted by LookupEpicData (Epic col H) |
| 13 | Point Of Care | EFC col K — was 11, +2 |
| 14 | Admission Level Of Care | EFC col L — was 12, +2 |
| 45 | FC Status | EFC col AQ — was 43, +2 |
| 52 | Epic Admission Status/Discharged | Appended by LookupEpicData (Epic col E) |

> **Note:** `BuildMFCOutput` resolves all source columns by `FindColByHeader`, not by hardcoded position. The column numbers above reflect the typical case; adding columns to the EFC report will not break the macro.

---

## Filter Logic

### FC Status filter (`FilterFCStatus`)
Keep rows where **any** of the following is true:

1. `Missed FC = "Yes"` — always kept regardless of Admission Status
2. FC Status ∈ {`Draft`, `Draft (ETBS Generated)`, `Draft (CCF Generated)`}  
   **AND** Admission Status ∈ {`Actualised`, `Planned`}

Drop all other rows. Draft rows with `Admission Status = "Discharged"` are dropped — the patient has left the ward. Missed FC rows are kept even when discharged so staff can follow up.

Uses `Encounter No` for `lastRow` because `FC Status` is blank in missed FC rows and would silently truncate the scan if used instead.

Returns `False` and aborts the macro if the FC Status column is not found, or if zero rows match the filter.

### Bed filter (`FilterBedCode`)
Extract the ward code `Mid(bed, 2, 3)` (1-based positions 2–4; e.g. `T07E18N` → `07E`).
Keep rows whose ward code is in the NCID allowlist:

```
14F, 12E, 11E, 08E, 09F, 08F, 07F, 07E, 06F, 11F, 03E, 05F
```

Single-digit floors are zero-padded (`7E` → `07E`) to match the bed-string format.
Drop all other rows including blanks, `"none"`, or bed codes shorter than 4 characters.
The allowlist lives in one `Private Const NCID_WARDS` in `FilterRows.bas`; editing it retargets the filter to another department.

### Duplicate flag (`FlagDuplicateRows`)
Rows where **Encounter Number + Patient Name** combination appears more than once (case-insensitive) are highlighted red, including the first occurrence.
Staff manually decide which duplicate to delete.

---

## NCID Ward Reference

The bed filter matches `Mid(bed, 2, 3)` against the allowlist below.

| Ward | Ward code | Type | Disciplines |
|------|-----------|------|-------------|
| 14F | 14F | NCID BAU | RTB (Dermatology + ID overflow) |
| 12E | 12E | NCID BAU | DERM, IDS |
| 11E | 11E | NCID BAU | IDS (isolation rooms) |
| 8E | 08E | NCID BAU | IDS (COVID-19) |
| 9F | 09F | TTSH@NCID | GMD, GRM, ORT |
| 8F | 08F | TTSH@NCID | GMD, IDS, DER (A-Class) |
| 7F | 07F | TTSH@NCID | GMD, GRM (CPO) |
| 7E | 07E | TTSH@NCID | GMD, GRM (MRSA) |
| 6F | 06F | TTSH@NCID | GMD, GRM (MRSA) |
| 11F | 11F | TTSH@NCID | Vascular Surgery |
| 3E | 03E | OICU/HD | Mixed discipline |
| 5F | 05F | TTSH@NCID | — |

Rows whose ward code is not in this allowlist — including blanks, `"none"`, or codes shorter than 4 characters — are deleted.

---

## Duplicate Row Handling

After the bed filter, the macro highlights in red every row where the **Encounter Number + Patient Name** combination appears more than once — including the first occurrence. All red rows are carried over to the output file.

**Staff action required:** manually review red rows and delete the true duplicate (typically the older or less complete record). The macro does not auto-delete duplicates.

---

## Backlog Summary

After building the output file, `BacklogSummary` compares **Encounter Numbers** (col G) in the output against the **previous MFC report**.

### Backlog detection
A row is flagged as backlog if its Encounter Number:
- **appears** in the previous report's "Encounter Number" (or "Encounter No") column, **AND**
- was **not** marked `Resolved` in the previous report's Resolution Status column

Backlog rows have `"Follow Up"` written to col E (Resolution Status) — conditional formatting turns them amber automatically.

After applying the backlog status, all data rows in the output sheet are sorted descending by Column E so that the amber backlog rows are grouped together at the top of the report, followed by the white (new) rows.

> Matching is by Encounter Number, not Patient Name. The same patient can have multiple different encounters (re-admissions are new cases, not backlog), and names are not unique identifiers.

### Carry-forward of manual columns
For every output row whose Encounter Number matched a **non-Resolved** row in the previous report, the macro copies:

| Output col | Header | Previous report column looked up by |
|------------|--------|--------------------------------------|
| A | Inflight FC Status | `"Inflight FC Status"` |
| B | Date Updated | `"Date Updated (DD/MM/YYYY)"` or `"Date Updated"` |
| C | Staff Follow Up (if any) | `"Staff Follow Up (if any)"` or `"Staff Follow Up"` |
| D | Remarks | `"Remarks"` |

Each column is looked up by header independently. An absent column in the previous file is silently skipped. Written in two bulk array writes (cols A–D in one write, col E in another).

### Summary sub-table
Written 3 rows below the last data row, cols A–B:

| Row | Label | Value |
|-----|-------|-------|
| Header | MFC Report Summary | — (merged A:B, blue header) |
| +1 | Total Cases | Calculated by macro |
| +2 | Backlog | Calculated by macro (non-Resolved carry-forwards) |
| +3 | To Follow Up on CCF | **Blank — staff fills in** (yellow). Manual only |
| +4 | Today's Cases | Live formula: `Total Cases − Backlog` |
| +5 | EL Admissions | **Blank — staff fills in** (yellow) from daily email |

Both yellow cells have tooltip comments. The file is saved after the summary table is written.

---

## Downtime Procedures

### EFC completely unavailable
1. Use **Epic Ward Manager** to check FC completion status ward by ward.
   - Only FC completed in eFC eForms with status "Completed" or "Acknowledged by other means" will show as completed in Epic.
2. For in-progress cases, search by patient MRN/CSN in the **eFC dashboard** to view FC status. Complete FC with patient if needed. FC done via eForm will flow automatically to Epic.
3. If downtime FC module or scanned hardcopy was used, **manually amend** FC completion status in Epic (these do not sync automatically).

### EFC partially available
1. In Inflight FC Report, leave **Admission Type blank**, set date range up to 1 month, click Submit.
2. The report includes all admission types — filter to keep **EM** (Emergency) and **EL** (Elective) only.
3. Combine with Epic Census report as normal.
4. For missed FC (CSNs without FC ID) — use the eFC dashboard:
   - Filter by admission type, date range, and **Admission Status = "Actualised"**
   - Export to Excel
   - Filter CSNs without an FC ID — these are the missed FC cases requiring follow-up
   - Repeat for elective admissions if required

---

## Module Structure

| Module | Sub / Function | Responsibility |
|--------|---------------|----------------|
| MainMacro | `Sub GenerateMFCReport` | Orchestrates all 9 steps in order; handles Cleanup on abort |
| Helpers | `Function PickFile` | File picker dialog, returns open Workbook |
| Helpers | `Function PickAndValidateFile` | File picker with structure validation loop (Retry/Cancel) |
| Helpers | `Function ValidateFileHeaders` | Validates EFC, Epic, and previous MFC column structures |
| Helpers | `Function FindColByHeader` | Finds a column by header name (whitespace-tolerant, case-insensitive via `NormHeader`) |
| Helpers | `Private Function NormHeader` | Normalises header: collapses line breaks, NBSP, tabs, multi-spaces; upper-cases |
| Helpers | `Sub CreateConfigSheet` | One-time setup: creates Config sheet with Inflight FC Status + Staff Follow Up lists |
| CombineEFC | `Sub CombineEFCFiles` | Stacks missed FC rows (values only) below main EFC; dynamic column count |
| ExtractDate | `Sub ExtractAdmissionDate` | Finds "Admission Date" by header, reformats MM/DD/YYYY → DD/MM/YYYY, inserts new column after it |
| ExtractDate | `Private Function FormatAdmDate` | Handles both numeric date serials (US locale) and text strings (SG locale) |
| FilterRows | `Function FilterFCStatus` | Keeps Draft rows (Actualised/Planned) + Missed FC = Yes rows; returns Boolean; has ErrHandler |
| FilterRows | `Sub FilterBedCode` | Keeps rows where `Mid(bed,2,3)` is in NCID allowlist dictionary; has ErrHandler |
| EpicLookup | `Sub LookupEpicData` | Inserts "Bed Point Of Care" before "Point Of Care" and "Epic Admission Status/Discharged" after last col; all columns by header; Dictionary lookup |
| FlagDuplicates | `Sub FlagDuplicateRows` | Finds Encounter No + Patient Name by header; highlights duplicate combos red |
| BuildOutput | `Function BuildMFCOutput` | Creates output xlsx (A–P); resolves source cols by header; validates all present; has CleanExit handler |
| BuildOutput | `Private Function ValidateSourceColumns` | Checks all 11 required source columns; lists missing ones in MsgBox |
| BuildOutput | `Private Sub CaptureRedFlags` | Reads red-row flags from working sheet before switching workbooks |
| BuildOutput | `Private Sub WriteOutputHeaders` | Writes and formats 16 column headers (A–P) |
| BuildOutput | `Private Sub WriteOutputData` | Bulk-copies data to cols F–P; applies red duplicate highlight |
| BuildOutput | `Private Sub FormatOutputSheet` | Aptos Narrow font, borders, row height, autofit, freeze pane |
| BuildOutput | `Private Sub SaveOutputFile` | Saves with Retry/auto-rename logic for locked files |
| BuildOutput | `Public Sub BacklogSummary` | Compares Encounter Numbers vs previous MFC; carries forward cols A–D; writes summary table; saves |
| BuildOutput | `Private Sub LoadPreviousMFC` | Loads previous MFC into `prevEncs` and `carryFwd` dictionaries; all columns by header |
| BuildOutput | `Private Sub ApplyCarryForward` | Writes Follow Up flags and carry-forward data in two bulk array writes |
| BuildOutput | `Private Sub WriteSummaryTable` | Writes 6-row coloured summary table below data |
| BuildOutput | `Private Sub AddDropdowns` | Orchestrates all dropdowns: calls SetupResolutionDropdown, CreateListsSheet, ApplyConfigDropdowns |
| BuildOutput | `Private Sub SetupResolutionDropdown` | Col B date format, col E Resolution dropdown, row conditional formatting (amber/green) |
| BuildOutput | `Private Function CreateListsSheet` | Creates hidden Lists sheet; writes last 31 dates to col C; applies date picker to col B |
| BuildOutput | `Private Sub ApplyConfigDropdowns` | Reads Config sheet lists, writes to Lists cols A/B, applies dropdowns to output cols A and C |
| BuildOutput | `Private Function ReadConfigColumn` | Bulk-reads a Config column into a 1-based String array; single ReDim Preserve |

---

## Performance Design

All modules that process large data use the same pattern to minimise Excel interactions:

1. **Read**: load entire column or sheet into a Variant array in one operation
2. **Process**: all logic runs in memory (VBA arrays, Scripting.Dictionary)
3. **Write**: write results back to the sheet in one bulk operation

**FilterRows (load-filter-write):** instead of building a Union of row references (O(n²) COM calls for 20,000 rows), both filter functions load the full sheet into memory, compact matching rows into a new array, write back, and delete the tail in one call. Total Excel interactions: 1 read + 1 write + 1 delete.

**EpicLookup:** builds two `Scripting.Dictionary` objects (keyed by CSN string) from the Epic sheet, then resolves all EFC rows in a single in-memory pass. Results written in two bulk range assignments.

**BuildOutput / BacklogSummary:** carry-forward data is accumulated in arrays and written in two bulk writes (cols A–D in one, col E in another) instead of up to 5 × rowCount individual cell writes.

**FilterFCStatus runs before LookupEpicData:** FC Status and Admission Status filtering does not need Epic data. Running it first reduces the row count — typically from ~5,000+ combined EFC rows to only the Draft/Missed subset — before the Epic lookup runs, making the lookup significantly faster.

---

## Rules
- Use helper functions for any repeated logic
- Keep each module focused on one responsibility
- Add clear comments to each Sub and Function
- No hardcoded file paths
- All file selection done via FileDialog prompts
- All data processing done in memory arrays where possible for performance
- EFC has thousands of rows, Epic has ~20,000 rows — optimise accordingly
- Do not guess column positions — use `FindColByHeader`; never hardcode column numbers in logic code

---

## Complete Code

> The authoritative source for all module code is **`MFC_All_Modules.txt`** in the project root.
> Copy each section from that file into the corresponding VBA module. The code below is intentionally omitted here to avoid drift — always use `MFC_All_Modules.txt`.
### Macro Header Instructions
`ba
============================================================
MFC REPORT MACRO - ALL MODULES
Copy each section into a separate VBA module in the VBA Editor.
The module name is shown in the header of each section.
============================================================
``r

### MODULE: Helpers.bas
`ba
Attribute VB_Name = "Helpers"
Option Explicit

' Opens a file picker dialog and returns the selected file as an open Workbook.
' Returns Nothing if the user cancels.
Public Function PickFile(title As String) As Workbook
    Dim fd As FileDialog
    Set fd = Application.FileDialog(msoFileDialogFilePicker)
    fd.title = title
    fd.Filters.Clear
    fd.Filters.Add "Excel Files", "*.xlsx; *.xlsm; *.xls"

    If fd.Show = -1 Then
        Set PickFile = Workbooks.Open(fd.SelectedItems(1))
    Else
        MsgBox "No file selected -- macro cancelled."
        Set PickFile = Nothing
    End If
End Function

' Validates that the selected workbook sheet 1 has specific columns matching the target report type.
Public Function ValidateFileHeaders(wb As Workbook, fileType As String) As Boolean
    Dim ws As Worksheet
    Set ws = wb.Sheets(1)
    
    Dim isValid As Boolean
    isValid = False
    
    Select Case UCase(fileType)
        Case "EFC"
            ' Check for critical unique EFC columns: "FC ID", "Encounter No", "Missed FC", "FC Status"
            If FindColByHeader(ws, "FC ID") > 0 And _
               FindColByHeader(ws, "Encounter No") > 0 And _
               FindColByHeader(ws, "FC Status") > 0 And _
               FindColByHeader(ws, "Missed FC") > 0 Then
                isValid = True
            End If
            
        Case "EPIC"
            ' Check for critical unique Epic columns: "CSN", "Bed", "Admit Status", "Patient"
            If FindColByHeader(ws, "CSN") > 0 And _
               FindColByHeader(ws, "Bed") > 0 And _
               FindColByHeader(ws, "Admit Status") > 0 And _
               FindColByHeader(ws, "Patient") > 0 Then
                isValid = True
            End If
            
        Case "PREV_MFC"
            ' Allow any file for the previous MFC report since older manually-done
            ' reports have varying structures (e.g. combined EFC sheets).
            isValid = True
    End Select
    
    ValidateFileHeaders = isValid
End Function

' Prompts the user to pick a file, and loops until a valid file structure is provided or the user cancels.
Public Function PickAndValidateFile(title As String, fileType As String, expectedDesc As String) As Workbook
    Dim wb As Workbook
    Dim answer As VbMsgBoxResult

    Do
        Set wb = PickFile(title)
        If wb Is Nothing Then
            Set PickAndValidateFile = Nothing
            Exit Function
        End If

        If ValidateFileHeaders(wb, fileType) Then
            Set PickAndValidateFile = wb
            Exit Function
        End If

        answer = MsgBox("Wrong file selected for " & expectedDesc & "." & vbNewLine & _
                        "Please pick the correct file.", _
                        vbRetryCancel + vbCritical, "Wrong File")
        wb.Close SaveChanges:=False
        If answer = vbCancel Then
            Set PickAndValidateFile = Nothing
            Exit Function
        End If
    Loop
End Function

' Searches row 1 of ws for a column whose header matches headerName.
' Matching is case-insensitive and whitespace-tolerant: line breaks
' (Alt+Enter / wrapped headers), non-breaking spaces, and runs of spaces
' are all normalised to a single space before comparison. This lets a header
' typed as "Date Updated" + line break + "(DD/MM/YYYY)" still match the
' search string "Date Updated (DD/MM/YYYY)".
' Returns the 1-based column index, or 0 if not found.
Public Function FindColByHeader(ws As Worksheet, headerName As String) As Long
    Dim lastCol As Long
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Dim target As String
    target = NormHeader(headerName)

    Dim c As Long
    For c = 1 To lastCol
        If NormHeader(CStr(ws.Cells(1, c).Value)) = target Then
            FindColByHeader = c
            Exit Function
        End If
    Next c

    FindColByHeader = 0
End Function

' Normalises a header string for tolerant comparison:
'   - converts line breaks (Chr 10 / 13) and non-breaking spaces (Chr 160) to spaces
'   - collapses any run of spaces to a single space
'   - trims ends and upper-cases
Private Function NormHeader(s As String) As String
    Dim t As String
    t = CStr(s)
    t = Replace(t, Chr(10), " ")
    t = Replace(t, Chr(13), " ")
    t = Replace(t, Chr(160), " ")
    t = Replace(t, vbTab, " ")
    Do While InStr(t, "  ") > 0
        t = Replace(t, "  ", " ")
    Loop
    NormHeader = UCase(Trim(t))
End Function

' Creates the Config worksheet in this workbook if it does not already exist.
' Run this once via Alt+F8 before using GenerateMFCReport for the first time.
' After running, update the "Staff Follow Up" column with your team's actual names.
Public Sub CreateConfigSheet()
    Dim ws                      As Worksheet
    Dim inflightDefaults(1 To 5) As String
    Dim i                        As Long

    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("Config")
    On Error GoTo 0

    If Not ws Is Nothing Then
        MsgBox "Config sheet already exists. Edit it directly to update the dropdown lists.", _
               vbInformation, "Config"
        Exit Sub
    End If

    Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    ws.Name = "Config"

    ' Column A header ? Inflight FC Status
    With ws.Cells(1, 1)
        .Value = "Inflight FC Status"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ' Column B header ? Staff Follow Up
    With ws.Cells(1, 2)
        .Value = "Staff Follow Up"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ' Tooltip-style comments on the headers guide users without cluttering the sheet
    On Error Resume Next
    ws.Cells(1, 1).Comment.Delete
    ws.Cells(1, 2).Comment.Delete
    ws.Cells(1, 1).AddComment "Edit the list below -- one item per row." & vbNewLine & _
                               "Do not rename or delete this header."
    ws.Cells(1, 2).AddComment "Edit the list below -- one item per row." & vbNewLine & _
                               "Do not rename or delete this header."
    On Error GoTo 0

    ' Default Inflight FC Status values
    inflightDefaults(1) = "Pending"
    inflightDefaults(2) = "In Progress"
    inflightDefaults(3) = "Completed"
    inflightDefaults(4) = "Cancelled"
    inflightDefaults(5) = "On Hold"

    For i = 1 To 5
        ws.Cells(i + 1, 1).Value = inflightDefaults(i)
    Next i

    ' Placeholder staff names ? update with real names after running this sub
    ws.Cells(2, 2).Value = "Staff A"
    ws.Cells(3, 2).Value = "Staff B"
    ws.Cells(4, 2).Value = "Staff C"

    ws.Columns("A:B").AutoFit

    MsgBox "Config sheet created." & vbNewLine & vbNewLine & _
           "Next step: go to the 'Config' tab and replace the Staff Follow Up " & _
           "placeholder names with your team's actual names.", _
           vbInformation, "Config Created"

End Sub
``r

### MODULE: MainMacro.bas
`ba
Attribute VB_Name = "MainMacro"
Option Explicit

' ============================================================
' MainMacro.bas
'
' Entry point. Orchestrates the full MFC report generation:
'   1. Open and validate 4 input files (with similarity guard for EFC pair)
'   2. Combine EFC files
'   3. Extract + reformat Admission Date  -- MUST precede LookupEpicData
'   4. Filter: keep Draft FC Status rows (+ Missed FC rows) -- runs before Epic for speed
'   5. XLOOKUP Bed and Admit Status from Epic
'   6. Filter: keep rows whose ward code (Mid(bed,2,3)) is an NCID ward
'   7. Flag duplicate Encounter No + Patient Name combinations
'   8. Build output .xlsx (cols A-P)
'   9. Compare against previous MFC, highlight backlog, write summary table
' ============================================================

Sub GenerateMFCReport()

    Dim wbMain   As Workbook   ' EFC without missed FC cases
    Dim wbMissed As Workbook   ' EFC with missed FC cases
    Dim wbEpic   As Workbook   ' Epic Census report
    Dim wbPrev   As Workbook   ' Previous MFC report (for backlog)
    Dim wbOutput As Workbook   ' New output MFC file

    Dim wsMainEFC   As Worksheet
    Dim wsMissedEFC As Worksheet
    Dim wsEpic      As Worksheet

    ' --- Step 1: Select all 4 input files via dashboard ---
    Application.StatusBar = "Step 1/9: Select input files..."
    Dim picker As New FilePickerForm
    If Not picker.ShowFilePicker() Then GoTo Cleanup

    Set wbMain   = picker.SelectedMain
    Set wbMissed = picker.SelectedMissed
    Set wbEpic   = picker.SelectedEpic
    Set wbPrev   = picker.SelectedPrev

    Set wsMainEFC   = wbMain.Sheets(1)
    Set wsMissedEFC = wbMissed.Sheets(1)
    Set wsEpic      = wbEpic.Sheets(1)

    ' --- Step 2: Stack missed FC rows below main EFC rows ---
    Application.StatusBar = "Step 2/9: Combining EFC files..."
    CombineEFCFiles wsMainEFC, wsMissedEFC

    ' --- Step 3: Reformat Admission Date, insert "Adm Date for MFC" column ---
    ' This shifts "Admission Status" and everything to its right by +1.
    ' LookupEpicData finds all column positions by header, so order matters only
    ' insofar as "Point Of Care" must exist before LookupEpicData runs.
    Application.StatusBar = "Step 3/9: Extracting and reformatting admission dates..."
    ExtractAdmissionDate wsMainEFC

    ' --- Step 4: Filter FC Status BEFORE Epic lookup ---
    ' The FC Status filter does not need Epic data, so running it here
    ' reduces the working row count from ~20,000 to only the Draft rows
    ' before the Epic lookup runs. This makes the lookup roughly 3x faster
    ' and avoids processing rows that would be discarded anyway.
    Application.StatusBar = "Step 4/9: Filtering FC Status..."
    If Not FilterFCStatus(wsMainEFC) Then GoTo Cleanup

    ' --- Step 5: XLOOKUP Bed and Admit Status from Epic ---
    ' Inserts "Bed Point Of Care" before "Point Of Care" and appends
    ' "Epic Admission Status/Discharged" after the last EFC column.
    ' Now only processes the filtered (Draft) rows, not the full 20,000.
    Application.StatusBar = "Step 5/9: Looking up Bed and Admit Status from Epic (~20,000 rows)..."
    LookupEpicData wsMainEFC, wsEpic

    ' --- Step 6: Delete rows whose ward code is not in the NCID allowlist ---
    ' Must run after LookupEpicData -- the Bed column comes from Epic.
    Application.StatusBar = "Step 6/9: Filtering by bed code (NCID wards only)..."
    FilterBedCode wsMainEFC

    ' --- Step 7: Highlight duplicate Encounter No + Patient Name rows red ---
    Application.StatusBar = "Step 7/9: Flagging duplicate rows..."
    FlagDuplicateRows wsMainEFC

    ' --- Step 8: Create and save the output .xlsx ---
    Application.StatusBar = "Step 8/9: Building output report..."
    Set wbOutput = BuildMFCOutput(wsMainEFC)
    If wbOutput Is Nothing Then GoTo Cleanup

    ' --- Step 9: Compare against previous MFC, highlight backlog, write summary ---
    ' The previous MFC workbook has several tabs; the report we compare against is
    ' the tab named "MFC" (the 3rd sheet). Hardcoded for the pilot -- if the tab is
    ' ever renamed or moved, update the sheet name below.
    Application.StatusBar = "Step 9/9: Comparing against previous MFC report..."
    Dim totalCases   As Long
    Dim backlogCount As Long
    Dim wsPrev As Worksheet
    On Error Resume Next
    Set wsPrev = wbPrev.Sheets("MFC Report")
    If wsPrev Is Nothing Then Set wsPrev = wbPrev.Sheets("MFC")
    If wsPrev Is Nothing Then
        If wbPrev.Sheets.Count >= 3 Then
            Set wsPrev = wbPrev.Sheets(3)
        Else
            Set wsPrev = wbPrev.Sheets(1)
        End If
    End If
    On Error GoTo 0
    BacklogSummary wbOutput.Sheets(1), wsPrev, totalCases, backlogCount

    Application.StatusBar = False
    MsgBox "MFC Report generated successfully!" & vbNewLine & vbNewLine & _
           "Total Cases   : " & totalCases & vbNewLine & _
           "Backlog       : " & backlogCount & vbNewLine & _
           "Today's Cases : " & (totalCases - backlogCount) & vbNewLine & vbNewLine & _
           "Next Steps:" & vbNewLine & _
           "1. Check RED rows -- review and delete duplicates" & vbNewLine & _
           "2. Fill YELLOW cells -- enter CCF and EL counts in the summary table", _
           vbInformation, "MFC Report Done"

Cleanup:
    Application.StatusBar = False
    ' Close all input workbooks without saving -- they were opened read-only
    ' for processing and must not be saved in their mutated state.
    ' OERN handles the case where two variables reference the same workbook
    ' (e.g. if the duplicate-file guard fired after both were already opened).
    On Error Resume Next
    If Not wbMain   Is Nothing Then wbMain.Close   SaveChanges:=False
    If Not wbMissed Is Nothing Then wbMissed.Close SaveChanges:=False
    If Not wbEpic   Is Nothing Then wbEpic.Close   SaveChanges:=False
    If Not wbPrev   Is Nothing Then wbPrev.Close   SaveChanges:=False
    On Error GoTo 0
    ' wbOutput is intentionally left open so staff can view and edit the report.

End Sub
``r

### MODULE: CombineEFC.bas
`ba
Attribute VB_Name = "CombineEFC"
Option Explicit

' Appends all data rows from the missed-FC EFC file below the last row
' of the main EFC file, using paste-values to avoid carrying over formats or formulas.
Sub CombineEFCFiles(wsMainEFC As Worksheet, wsMissedEFC As Worksheet)

    Dim lastRowMain As Long
    Dim lastRowMissed As Long

    lastRowMain   = wsMainEFC.Cells(wsMainEFC.Rows.Count, 3).End(xlUp).Row
    lastRowMissed = wsMissedEFC.Cells(wsMissedEFC.Rows.Count, 3).End(xlUp).Row
    If lastRowMissed < 2 Then Exit Sub  ' Missed FC file has no data rows -- nothing to append

    Dim lastColMissed As Long
    lastColMissed = wsMissedEFC.Cells(1, wsMissedEFC.Columns.Count).End(xlToLeft).Column

    wsMissedEFC.Range(wsMissedEFC.Cells(2, 1), wsMissedEFC.Cells(lastRowMissed, lastColMissed)).Copy
    wsMainEFC.Range("A" & lastRowMain + 1).PasteSpecial xlPasteValues

    Application.CutCopyMode = False

End Sub
``r

### MODULE: ExtractDate.bas
`ba
Attribute VB_Name = "ExtractDate"
Option Explicit

' ============================================================
' ExtractDate.bas
'
' Reads EFC "Admission Date" column (found by header name).
' Format in source: MM/DD/YYYY HH:MM:SS AM/PM
'
' Inserts a new column immediately after "Admission Date" containing
' the date reformatted as a DD/MM/YYYY text string, header "Adm Date for MFC".
'
' This shifts "Admission Status" and everything to its right by +1.
' EpicLookup also finds its insert positions by header, so call order
' between ExtractAdmissionDate and LookupEpicData still matters only
' insofar as EpicLookup looks for "Point Of Care" after this insert.
' ============================================================

' Finds "Admission Date" by header, reformats all values,
' inserts new column immediately after it, then writes back in one bulk operation.
Public Sub ExtractAdmissionDate(ws As Worksheet)

    Dim admDateCol As Long
    admDateCol = FindColByHeader(ws, "Admission Date")
    If admDateCol = 0 Then
        MsgBox "Error: EFC file is missing 'Admission Date'." & vbNewLine & _
               "Check your EFC export.", vbExclamation, "Missing Column"
        Exit Sub
    End If

    ' Use "Encounter No" for lastRow: always filled for both main EFC and missed FC rows.
    ' FC ID (col 1) is blank for missed FC rows and would silently truncate the scan.
    Dim encNoCol As Long
    encNoCol = FindColByHeader(ws, "Encounter No")
    Dim lastRow As Long
    If encNoCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encNoCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, admDateCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Sub

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' --- Step 1: Read entire Admission Date column into a memory array ---
    Dim rawDates As Variant
    rawDates = ws.Range(ws.Cells(1, admDateCol), ws.Cells(lastRow, admDateCol)).Value

    ' --- Step 2: Build output array with reformatted dates ---
    Dim outDates() As Variant
    ReDim outDates(1 To lastRow, 1 To 1)
    outDates(1, 1) = "Adm Date for MFC"

    Dim i As Long
    For i = 2 To lastRow
        outDates(i, 1) = FormatAdmDate(rawDates(i, 1))
    Next i

    ' --- Step 3: Insert blank column immediately after "Admission Date" ---
    Dim insertCol As Long
    insertCol = admDateCol + 1
    ws.Columns(insertCol).Insert Shift:=xlToRight

    ' --- Step 4: Format new column as text BEFORE writing ---
    ' Prevents Excel from re-interpreting "18/12/2025" as a date serial
    ws.Columns(insertCol).NumberFormat = "@"

    ' --- Step 5: Write header + all dates in one bulk write ---
    ws.Range(ws.Cells(1, insertCol), ws.Cells(lastRow, insertCol)).Value = outDates

    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True

End Sub

' Converts one Admission Date cell value to a DD/MM/YYYY string.
'
' Handles two cases depending on the user's Windows locale:
'   - Numeric / vbDate: Excel auto-parsed the cell as a date serial on open
'     (happens when locale is MM/DD, e.g. US settings).
'   - String: cell was stored as text "MM/DD/YYYY HH:MM:SS AM/PM"
'     (happens when locale is DD/MM, e.g. Singapore settings ? Excel cannot
'     recognise MM/DD format and leaves the value as plain text).
Private Function FormatAdmDate(cellVal As Variant) As String

    ' Return empty string for blank cells
    If IsEmpty(cellVal) Or CStr(cellVal) = "" Then
        FormatAdmDate = ""
        Exit Function
    End If

    ' Case 1: Excel date serial (VarType vbDouble or vbDate) ? convert via CDate
    If VarType(cellVal) = vbDouble Or VarType(cellVal) = vbDate Then
        FormatAdmDate = Format(CDate(cellVal), "DD/MM/YYYY")
        Exit Function
    End If

    ' Case 2: Text string ? parse "MM/DD/YYYY HH:MM:SS AM/PM" manually
    Dim strVal As String
    strVal = Trim(CStr(cellVal))

    ' Isolate the date portion before the first space
    Dim spacePos As Long
    spacePos = InStr(strVal, " ")
    If spacePos > 0 Then strVal = Left(strVal, spacePos - 1)

    ' Split into parts: (0)=MM, (1)=DD, (2)=YYYY
    Dim parts() As String
    parts = Split(strVal, "/")
    If UBound(parts) < 2 Then
        FormatAdmDate = CStr(cellVal)   ' Unexpected format ? pass through unchanged
        Exit Function
    End If

    ' Pad to 2 digits and reassemble as DD/MM/YYYY
    Dim mm As String, dd As String, yyyy As String
    mm   = Right("0" & Trim(parts(0)), 2)
    dd   = Right("0" & Trim(parts(1)), 2)
    yyyy = Trim(parts(2))

    FormatAdmDate = dd & "/" & mm & "/" & yyyy

End Function
``r

### MODULE: FilterRows.bas
`ba
Attribute VB_Name = "FilterRows"
Option Explicit

' ============================================================
' FilterRows.bas
'
' FilterFCStatus ? keeps only the three allowed Draft FC statuses.
' FilterBedCode  ? keeps only rows whose ward code (Mid(bed,2,3)) is an NCID ward.
'
' PERFORMANCE: Both subs use a load-filter-write strategy instead of
' building a Union range row-by-row. For 20,000 rows, a Union loop
' makes thousands of COM calls and can take 30-60 seconds. The
' load-filter-write approach reads the entire sheet once into a Variant
' array, compacts matching rows in memory, writes back in one bulk
' operation, then deletes the leftover tail in one call ? total
' Excel interactions: 2 reads + 1 write + 1 delete.
' ============================================================

Private Const FC_DRAFT      As String = "Draft"
Private Const FC_DRAFT_ETBS As String = "Draft (ETBS Generated)"
Private Const FC_DRAFT_CCF  As String = "Draft (CCF Generated)"

Private Const ADM_ACTUALISED As String = "Actualised"
Private Const ADM_PLANNED    As String = "Planned"

' NCID ward allowlist for the bed filter. A bed is kept when characters at
' 0-based positions 1,2,3 of the bed string -- i.e. Mid(bed, 2, 3) -- match one
' of these ward codes. Example: "T07E18N" -> "07E".
' Single-digit floors are zero-padded because bed strings carry the leading zero.
' To retarget this filter to another department, edit this one constant.
Private Const NCID_WARDS As String = "14F,12E,11E,08E,09F,08F,07F,07E,06F,11F,03E,05F"

' Keeps rows where:
'   - Missed FC = "Yes" (always kept regardless of Admission Status), OR
'   - FC Status is one of the three Draft values AND Admission Status is "Actualised" or "Planned"
' Draft rows with Admission Status = "Discharged" are dropped -- the patient has left the ward.
' Missed FC rows are always kept so staff can follow up even after discharge.
' Runs BEFORE LookupEpicData so the Epic lookup only processes relevant rows.
Public Function FilterFCStatus(ws As Worksheet) As Boolean

    On Error GoTo ErrHandler

    Dim fcCol As Long
    fcCol = FindColByHeader(ws, "FC Status")
    If fcCol = 0 Then
        MsgBox "Error: EFC file is missing the 'FC Status' column." & vbNewLine & _
               "Check your EFC export.", vbExclamation, "Missing Column"
        FilterFCStatus = False
        Exit Function
    End If
    FilterFCStatus = True

    ' Missed FC column -- rows marked "Yes" pass through regardless of Admission Status.
    Dim missedFCCol As Long
    missedFCCol = FindColByHeader(ws, "Missed FC")

    ' Admission Status column -- Draft rows are only kept if Actualised or Planned.
    Dim admStatCol As Long
    admStatCol = FindColByHeader(ws, "Admission Status")

    ' Use Encounter No for lastRow -- it is filled in both the main EFC and the
    ' missed-FC file, unlike FC Status which is blank in missed-FC rows.
    Dim encNoCol As Long
    encNoCol = FindColByHeader(ws, "Encounter No")

    Dim lastRow As Long
    Dim lastCol As Long
    If encNoCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encNoCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, fcCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Function
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' --- Step 1: Load entire working sheet into memory (one read) ---
    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Step 2: Count matching rows (needed to size the output array) ---
    Dim keepCount As Long
    Dim i As Long
    Dim fcVal As String
    Dim missedVal As String
    Dim admStatVal As String
    For i = 2 To lastRow
        fcVal      = UCase(Trim(CStr(allData(i, fcCol))))
        missedVal  = ""
        admStatVal = ""
        If missedFCCol > 0 Then missedVal  = UCase(Trim(CStr(allData(i, missedFCCol))))
        If admStatCol  > 0 Then admStatVal = UCase(Trim(CStr(allData(i, admStatCol))))
        If missedVal = "YES" Then
            keepCount = keepCount + 1
        ElseIf (fcVal = UCase(FC_DRAFT) Or fcVal = UCase(FC_DRAFT_ETBS) Or fcVal = UCase(FC_DRAFT_CCF)) _
               And (admStatVal = UCase(ADM_ACTUALISED) Or admStatVal = UCase(ADM_PLANNED)) Then
            keepCount = keepCount + 1
        End If
    Next i

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "No active cases found. All rows were filtered out" & vbNewLine & _
               "-- check your EFC date range.", vbExclamation, "No Data"
        FilterFCStatus = False
        Exit Function
    End If

    ' --- Step 3: Build a compacted array of only the matching rows ---
    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long
    Dim j As Long
    For i = 2 To lastRow
        fcVal      = UCase(Trim(CStr(allData(i, fcCol))))
        missedVal  = ""
        admStatVal = ""
        If missedFCCol > 0 Then missedVal  = UCase(Trim(CStr(allData(i, missedFCCol))))
        If admStatCol  > 0 Then admStatVal = UCase(Trim(CStr(allData(i, admStatCol))))
        If missedVal = "YES" Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        ElseIf (fcVal = UCase(FC_DRAFT) Or fcVal = UCase(FC_DRAFT_ETBS) Or fcVal = UCase(FC_DRAFT_CCF)) _
               And (admStatVal = UCase(ADM_ACTUALISED) Or admStatVal = UCase(ADM_PLANNED)) Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    ' --- Step 4: Write filtered rows back starting at row 2 (one write) ---
    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    ' --- Step 5: Delete the now-empty tail rows below the new last data row ---
    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        ws.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "FC Status / Admission Status filter complete: kept " & keepCount & " rows."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Function

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during FC Status filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    FilterFCStatus = False

End Function

' Keeps only rows whose bed code maps to an NCID ward.
' Ward code = Mid(bed, 2, 3) (0-based positions 1,2,3), matched against NCID_WARDS.
' Rows with a blank, short, or "none" bed code are removed.
' Must run AFTER LookupEpicData (the Bed column is populated by Epic lookup).
Public Sub FilterBedCode(ws As Worksheet)

    On Error GoTo ErrHandler

    Dim bedCol As Long
    bedCol = FindColByHeader(ws, "Bed Point Of Care")
    If bedCol = 0 Then
        MsgBox "Error: 'Bed Point Of Care' column missing." & vbNewLine & _
               "The Epic lookup may have failed.", vbExclamation, "Missing Column"
        Exit Sub
    End If

    ' Build the ward allowlist into a dictionary once (case-insensitive keys).
    Dim wardSet As Object
    Set wardSet = CreateObject("Scripting.Dictionary")
    Dim wardArr() As String
    wardArr = Split(NCID_WARDS, ",")
    Dim w As Long
    For w = LBound(wardArr) To UBound(wardArr)
        wardSet(UCase(Trim(wardArr(w)))) = True
    Next w

    ' Use "Encounter No" for lastRow: always filled for both main EFC and missed FC rows.
    ' FC ID (col 1) is blank for missed FC rows and would silently truncate the scan.
    Dim encNoCol As Long
    encNoCol = FindColByHeader(ws, "Encounter No")

    Dim lastRow As Long
    Dim lastCol As Long
    If encNoCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encNoCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, bedCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Sub
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' --- Step 1: Load entire working sheet into memory (one read) ---
    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Step 2: Count rows whose ward code is in the NCID allowlist ---
    Dim keepCount As Long
    Dim i As Long
    Dim bedVal As String
    Dim wardCode As String
    For i = 2 To lastRow
        bedVal = Trim(CStr(allData(i, bedCol)))
        wardCode = ""
        If Len(bedVal) >= 4 And LCase(bedVal) <> "none" Then wardCode = UCase(Mid(bedVal, 2, 3))
        If wardSet.Exists(wardCode) Then keepCount = keepCount + 1
    Next i

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "No NCID ward matches found." & vbNewLine & _
               "Check the Epic Census Report date.", vbExclamation, "No Data"
        Exit Sub
    End If

    ' --- Step 3: Build compacted array of matching rows ---
    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long
    Dim j As Long
    For i = 2 To lastRow
        bedVal = Trim(CStr(allData(i, bedCol)))
        wardCode = ""
        If Len(bedVal) >= 4 And LCase(bedVal) <> "none" Then wardCode = UCase(Mid(bedVal, 2, 3))
        If wardSet.Exists(wardCode) Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    ' --- Step 4: Write filtered rows back (one write) ---
    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    ' --- Step 5: Delete tail rows (one delete) ---
    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        ws.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "Bed code filter complete: kept " & keepCount & " rows."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Sub

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during bed filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"

End Sub
``r

### MODULE: EpicLookup.bas
`ba
Attribute VB_Name = "EpicLookup"
Option Explicit

' Inserts two new columns into wsMainEFC, then bulk-loads Epic into
' Scripting.Dictionary objects (keyed by CSN) and resolves each EFC Encounter No
' in one pass ? avoiding per-row worksheet reads for ~20,000 Epic rows.
'
' All column positions are resolved by header name so neither report
' breaks if extra columns are added.
'
' Column inserts (run AFTER ExtractAdmissionDate):
'   "Bed Point Of Care"               ? inserted before "Point Of Care"
'   "Epic Admission Status/Discharged" ? appended after the last EFC column
Sub LookupEpicData(wsMainEFC As Worksheet, wsEpic As Worksheet)

    Dim lastRowEFC  As Long
    Dim lastRowEpic As Long
    Dim i As Long
    Dim csn As String
    Dim encounterNo As String

    Dim dictBed   As Object
    Dim dictAdmit As Object
    Set dictBed   = CreateObject("Scripting.Dictionary")
    Set dictAdmit = CreateObject("Scripting.Dictionary")

    ' --- Locate Epic columns by header ---
    Dim epicCSNCol   As Long
    Dim epicBedCol   As Long
    Dim epicAdmitCol As Long
    epicCSNCol   = FindColByHeader(wsEpic, "CSN")
    epicBedCol   = FindColByHeader(wsEpic, "Bed")
    epicAdmitCol = FindColByHeader(wsEpic, "Admit Status")

    If epicCSNCol = 0 Or epicBedCol = 0 Or epicAdmitCol = 0 Then
        MsgBox "Error: Epic file is missing required columns:" & vbNewLine & _
               IIf(epicCSNCol = 0, "  - CSN" & vbNewLine, "") & _
               IIf(epicBedCol = 0, "  - Bed" & vbNewLine, "") & _
               IIf(epicAdmitCol = 0, "  - Admit Status" & vbNewLine, "") & _
               "Check your Epic export.", _
               vbExclamation, "Missing Column"
        Exit Sub
    End If

    ' --- Locate EFC columns by header (before any insertions) ---
    Dim efcEncNoCol As Long
    Dim pocCol      As Long
    efcEncNoCol = FindColByHeader(wsMainEFC, "Encounter No")
    pocCol      = FindColByHeader(wsMainEFC, "Point Of Care")

    If efcEncNoCol = 0 Or pocCol = 0 Then
        MsgBox "Error: EFC file is missing columns needed for Epic lookup:" & vbNewLine & _
               IIf(efcEncNoCol = 0, "  - Encounter No" & vbNewLine, "") & _
               IIf(pocCol = 0, "  - Point Of Care" & vbNewLine, ""), _
               vbExclamation, "Missing Column"
        Exit Sub
    End If

    lastRowEFC  = wsMainEFC.Cells(wsMainEFC.Rows.Count, efcEncNoCol).End(xlUp).Row
    lastRowEpic = wsEpic.Cells(wsEpic.Rows.Count, epicCSNCol).End(xlUp).Row

    ' --- Insert "Bed Point Of Care" immediately before "Point Of Care" ---
    ' pocCol is the insert position; "Point Of Care" shifts to pocCol + 1.
    ' efcEncNoCol is before pocCol so it is unaffected by this insert.
    Dim lastColEFC As Long
    lastColEFC = wsMainEFC.Cells(1, wsMainEFC.Columns.Count).End(xlToLeft).Column
    wsMainEFC.Columns(pocCol).Insert Shift:=xlToRight
    wsMainEFC.Cells(1, pocCol).Value = "Bed Point Of Care"
    lastColEFC = lastColEFC + 1  ' shifted by insert above

    ' --- Append "Epic Admission Status/Discharged" after the last column ---
    Dim epicStatCol As Long
    epicStatCol = lastColEFC + 1
    wsMainEFC.Cells(1, epicStatCol).Value = "Epic Admission Status/Discharged"

    ' --- Load Epic data into memory (only up to the rightmost needed column) ---
    Dim epicLastCol As Long
    epicLastCol = Application.WorksheetFunction.Max(epicCSNCol, epicBedCol, epicAdmitCol)
    Dim epicData As Variant
    epicData = wsEpic.Range(wsEpic.Cells(1, 1), wsEpic.Cells(lastRowEpic, epicLastCol)).Value

    ' --- Pre-load Epic CSN, Bed and Admit Status into dictionaries ---
    For i = 2 To lastRowEpic
        csn = CStr(epicData(i, epicCSNCol))
        dictBed(csn)   = epicData(i, epicBedCol)
        dictAdmit(csn) = epicData(i, epicAdmitCol)
    Next i

    ' --- Load EFC data into memory after both insertions ---
    Dim efcData As Variant
    efcData = wsMainEFC.Range(wsMainEFC.Cells(1, 1), wsMainEFC.Cells(lastRowEFC, epicStatCol)).Value

    ' --- Prepare output arrays ? sized to data rows only (excludes header) ---
    Dim bedOut()   As Variant
    Dim admitOut() As Variant
    ReDim bedOut(1 To lastRowEFC - 1, 1 To 1)
    ReDim admitOut(1 To lastRowEFC - 1, 1 To 1)

    ' --- Lookup and store results in output arrays ---
    ' i - 1 maps sheet row i (starting at 2) to array index starting at 1.
    ' efcEncNoCol is before pocCol so its index in efcData is unchanged.
    For i = 2 To lastRowEFC
        encounterNo = CStr(efcData(i, efcEncNoCol))
        If dictBed.exists(encounterNo) Then
            bedOut(i - 1, 1)   = dictBed(encounterNo)
            admitOut(i - 1, 1) = dictAdmit(encounterNo)
        Else
            bedOut(i - 1, 1)   = ""
            admitOut(i - 1, 1) = ""
        End If
    Next i

    ' --- Write results back to sheet in one go ---
    wsMainEFC.Range(wsMainEFC.Cells(2, pocCol), wsMainEFC.Cells(lastRowEFC, pocCol)).Value           = bedOut
    wsMainEFC.Range(wsMainEFC.Cells(2, epicStatCol), wsMainEFC.Cells(lastRowEFC, epicStatCol)).Value = admitOut

End Sub
``r

### MODULE: FlagDuplicates.bas
`ba
Attribute VB_Name = "FlagDuplicates"
Option Explicit

' ============================================================
' FlagDuplicates.bas
'
' Highlights in red every row (including the first occurrence)
' where the combination of Encounter No + Patient Name appears
' more than once in the working sheet.
' Staff review and decide manually which duplicate to delete.
'
' Encounter No and Patient Name are located by header name so the sub
' remains correct if columns are added to the EFC report.
'
' Strategy:
'   1. Load both columns into memory arrays (two reads).
'   2. Count composite key occurrences using a Dictionary (O(n) in memory).
'   3. Collect duplicate rows into a Union range (O(n) in memory).
'   4. Apply red fill + white font to the Union in one operation.
' ============================================================

Public Sub FlagDuplicateRows(ws As Worksheet)

    Dim encCol  As Long
    Dim nameCol As Long
    encCol  = FindColByHeader(ws, "Encounter No")
    nameCol = FindColByHeader(ws, "Patient Name")

    If encCol = 0 Or nameCol = 0 Then
        MsgBox "Error: Missing columns for duplicate check:" & vbNewLine & _
               IIf(encCol = 0, "  - Encounter No" & vbNewLine, "") & _
               IIf(nameCol = 0, "  - Patient Name" & vbNewLine, ""), _
               vbExclamation, "Missing Column"
        Exit Sub
    End If

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then Exit Sub

    Application.ScreenUpdating = False

    ' --- Step 1: Load Encounter No and Patient Name columns into memory ---
    Dim encData  As Variant
    Dim nameData As Variant
    encData  = ws.Range(ws.Cells(2, encCol),  ws.Cells(lastRow, encCol)).Value
    nameData = ws.Range(ws.Cells(2, nameCol), ws.Cells(lastRow, nameCol)).Value

    ' --- Step 2: Count occurrences of each composite key ---
    Dim keyCounts As Object
    Set keyCounts = CreateObject("Scripting.Dictionary")
    keyCounts.CompareMode = vbTextCompare  ' Case-insensitive matching

    Dim i As Long
    Dim key As String

    For i = 1 To UBound(encData, 1)
        ' Pipe separator prevents accidental collisions across fields
        key = Trim(CStr(encData(i, 1))) & "|" & UCase(Trim(CStr(nameData(i, 1))))
        If keyCounts.Exists(key) Then
            keyCounts(key) = keyCounts(key) + 1
        Else
            keyCounts(key) = 1
        End If
    Next i

    ' --- Step 3: Collect all duplicate rows into a single Union range ---
    Dim dupRange As Range

    For i = 1 To UBound(encData, 1)
        key = Trim(CStr(encData(i, 1))) & "|" & UCase(Trim(CStr(nameData(i, 1))))
        If keyCounts(key) > 1 Then
            ' Array index i ? sheet row i + 1 (data starts at row 2)
            If dupRange Is Nothing Then
                Set dupRange = ws.Rows(i + 1)
            Else
                Set dupRange = Union(dupRange, ws.Rows(i + 1))
            End If
        End If
    Next i

    ' --- Step 4: Apply formatting to all duplicate rows in one operation ---
    If Not dupRange Is Nothing Then
        dupRange.Interior.Color = RGB(255, 0, 0)
        dupRange.Font.Color     = RGB(255, 255, 255)
    End If

    Application.ScreenUpdating = True

End Sub
``r

### MODULE: BuildOutput.bas
`ba
Attribute VB_Name = "BuildOutput"
Option Explicit

' ============================================================
' BuildOutput.bas
'
' BuildMFCOutput  -- Creates the final .xlsx (cols A-O).
'                   Returns the new Workbook so MainMacro can
'                   pass it to BacklogSummary.
' BacklogSummary  -- Compares Encounter Numbers against previous MFC,
'                   flags backlog rows, carries forward manual cols A/B/C,
'                   writes the summary table.
'
' Working sheet column positions after all inserts vary depending on the EFC
' report structure. All columns are resolved at runtime via FindColByHeader.
'
' Output layout (A-P):
'   A  Inflight FC Status              Manual -- dropdown
'   B  Date Updated (DD/MM/YYYY)       Manual
'   C  Staff Follow Up (if any)        Manual -- dropdown
'   D  Remarks                         Manual
'   E  Resolution Status               Manual -- dropdown: Follow Up / Resolved
'   F  FC ID
'   G  Encounter Number
'   H  MRN
'   I  Patient Name
'   J  Adm Date for MFC
'   K  FC Status
'   L  Admit Status
'   M  Point of Care
'   N  Point of Care Final Bed         (= Bed Point Of Care)
'   O  Admission Level Of Care
'   P  Epic Admission Status/Discharged
' ============================================================


' Creates the MFC output .xlsx from the filtered, flagged working sheet.
' Returns the new Workbook on success, or Nothing if the user cancels.
Public Function BuildMFCOutput(ws As Worksheet) As Workbook

    On Error GoTo CleanExit

    ' --- Locate all source columns by header ---
    Dim srcFCID     As Long : srcFCID     = FindColByHeader(ws, "FC ID")
    Dim srcEncNo    As Long : srcEncNo    = FindColByHeader(ws, "Encounter No")
    Dim srcMRN      As Long : srcMRN      = FindColByHeader(ws, "MRN")
    Dim srcPatName  As Long : srcPatName  = FindColByHeader(ws, "Patient Name")
    Dim srcAdmDate  As Long : srcAdmDate  = FindColByHeader(ws, "Adm Date for MFC")
    Dim srcAdmStat  As Long : srcAdmStat  = FindColByHeader(ws, "Admission Status")
    Dim srcBed      As Long : srcBed      = FindColByHeader(ws, "Bed Point Of Care")
    Dim srcPOC      As Long : srcPOC      = FindColByHeader(ws, "Point Of Care")
    Dim srcAdmLevel As Long : srcAdmLevel = FindColByHeader(ws, "Admission Level Of Care")
    Dim srcFCStat   As Long : srcFCStat   = FindColByHeader(ws, "FC Status")
    Dim srcEpicStat As Long : srcEpicStat = FindColByHeader(ws, "Epic Admission Status/Discharged")

    If srcFCID = 0 Or srcEncNo = 0 Or srcMRN = 0 Or srcPatName = 0 Or _
       srcAdmDate = 0 Or srcAdmStat = 0 Or srcBed = 0 Or srcPOC = 0 Or _
       srcAdmLevel = 0 Or srcFCStat = 0 Or srcEpicStat = 0 Then
        MsgBox "BuildMFCOutput: Required column not found in working sheet." & vbNewLine & _
               IIf(srcFCID = 0, "  - FC ID" & vbNewLine, "") & _
               IIf(srcEncNo = 0, "  - Encounter No" & vbNewLine, "") & _
               IIf(srcMRN = 0, "  - MRN" & vbNewLine, "") & _
               IIf(srcPatName = 0, "  - Patient Name" & vbNewLine, "") & _
               IIf(srcAdmDate = 0, "  - Adm Date for MFC" & vbNewLine, "") & _
               IIf(srcAdmStat = 0, "  - Admission Status" & vbNewLine, "") & _
               IIf(srcBed = 0, "  - Bed Point Of Care" & vbNewLine, "") & _
               IIf(srcPOC = 0, "  - Point Of Care" & vbNewLine, "") & _
               IIf(srcAdmLevel = 0, "  - Admission Level Of Care" & vbNewLine, "") & _
               IIf(srcFCStat = 0, "  - FC Status" & vbNewLine, "") & _
               IIf(srcEpicStat = 0, "  - Epic Admission Status/Discharged" & vbNewLine, ""), _
               vbExclamation, "Column Not Found"
        Set BuildMFCOutput = Nothing
        Exit Function
    End If

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, srcEncNo).End(xlUp).Row
    If lastRow < 2 Then
        MsgBox "BuildMFCOutput: No data rows found in working sheet.", vbExclamation, "No Data"
        Set BuildMFCOutput = Nothing
        Exit Function
    End If

    Dim dataRows As Long
    dataRows = lastRow - 1

    ' --- Step 1: Load working sheet into memory (up to the rightmost needed column) ---
    Dim wsData As Variant
    Dim wsLastCol As Long
    wsLastCol = Application.WorksheetFunction.Max( _
        srcFCID, srcEncNo, srcMRN, srcPatName, srcAdmDate, _
        srcAdmStat, srcBed, srcPOC, srcAdmLevel, srcFCStat, srcEpicStat)
    wsData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, wsLastCol)).Value
    ' wsData(row, col): row 1 = header, rows 2..lastRow = data

    ' --- Step 2: Capture red highlight flags before leaving the working sheet ---
    ' FlagDuplicateRows coloured entire duplicate rows red. We read col 1 of each
    ' data row as a proxy -- it will be RGB(255,0,0) for any duplicate row.
    Dim rowIsRed() As Boolean
    ReDim rowIsRed(1 To dataRows)
    Dim r As Long
    For r = 1 To dataRows
        rowIsRed(r) = (ws.Cells(r + 1, 1).Interior.Color = RGB(255, 0, 0))
    Next r

    ' --- Step 3: Build file-name date strings from today's system date ---
    Dim today As Date
    Dim currentDateStr As String
    Dim oneMonthAgoStr As String
    today = Date
    currentDateStr = Format(today, "DD.MM.YYYY")
    oneMonthAgoStr = Format(DateAdd("m", -1, today), "DD.MM.YYYY")

    ' --- Step 4: Prompt user for the save folder ---
    Dim savePath As String
    With Application.FileDialog(msoFileDialogFolderPicker)
        .Title = "Select folder to save MFC Report"
        If .Show = False Then
            Set BuildMFCOutput = Nothing
            Exit Function
        End If
        savePath = .SelectedItems(1)
    End With

    Dim fileName As String
    fileName = "MFC " & currentDateStr & " TO " & oneMonthAgoStr & ".xlsx"
    Dim fullPath As String
    fullPath = savePath & "\" & fileName

    Application.ScreenUpdating = False

    ' --- Step 5: Create new workbook with one sheet ---
    Dim outWb As Workbook
    Set outWb = Workbooks.Add

    Application.DisplayAlerts = False
    Do While outWb.Sheets.Count > 1
        outWb.Sheets(outWb.Sheets.Count).Delete
    Loop
    Application.DisplayAlerts = True

    Dim outWs As Worksheet
    Set outWs = outWb.Sheets(1)
    outWs.Name = "MFC Report"

    ' --- Step 6: Write column headers A-O ---
    Dim headers(1 To 16) As String
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
    headers(12) = "Admit Status"
    headers(13) = "Point of Care"
    headers(14) = "Point of Care Final Bed"
    headers(15) = "Admission Level Of Care"
    headers(16) = "Epic Admission Status/Discharged"

    Dim headerRow(1 To 1, 1 To 16) As String
    Dim c As Long
    For c = 1 To 16
        headerRow(1, c) = headers(c)
    Next c
    With outWs.Range("A1:P1")
        .Value = headerRow
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ' --- Step 7: Build output data array for cols F-P (11 columns) ---
    ' colMap(j) = source column in wsData for output column F + j - 1
    Dim colMap(1 To 11) As Long
    colMap(1)  = srcFCID      ' F
    colMap(2)  = srcEncNo     ' G
    colMap(3)  = srcMRN       ' H
    colMap(4)  = srcPatName   ' I
    colMap(5)  = srcAdmDate   ' J
    colMap(6)  = srcFCStat    ' K
    colMap(7)  = srcAdmStat   ' L
    colMap(8)  = srcPOC       ' M
    colMap(9)  = srcBed       ' N
    colMap(10) = srcAdmLevel  ' O
    colMap(11) = srcEpicStat  ' P

    Dim outData() As Variant
    ReDim outData(1 To dataRows, 1 To 11)

    Dim i As Long, j As Long
    For i = 1 To dataRows
        For j = 1 To 11
            outData(i, j) = wsData(i + 1, colMap(j))  ' i+1 skips header row in wsData
        Next j
    Next i

    ' --- Step 7.5: Pre-format columns to prevent Excel auto-conversion ---
    ' Encounter Number (col G = 7): display as whole number, no decimals
    outWs.Range(outWs.Cells(2, 7), outWs.Cells(lastRow, 7)).NumberFormat = "0"
    ' Adm Date for MFC (col J = 10): store as text, prevent date reformatting
    outWs.Range(outWs.Cells(2, 10), outWs.Cells(lastRow, 10)).NumberFormat = "@"

    ' Bulk write to output sheet cols F-P (cols 6-16), rows 2 to lastRow
    outWs.Range(outWs.Cells(2, 6), outWs.Cells(lastRow, 16)).Value = outData

    ' --- Step 8: Carry over red duplicate highlight ---
    ' Collect flagged rows into a Union range, then format in one operation.
    Dim redRange As Range
    For i = 1 To dataRows
        If rowIsRed(i) Then
            If redRange Is Nothing Then
                Set redRange = outWs.Rows(i + 1)
            Else
                Set redRange = Union(redRange, outWs.Rows(i + 1))
            End If
        End If
    Next i
    If Not redRange Is Nothing Then
        redRange.Interior.Color = RGB(255, 0, 0)
        redRange.Font.Color     = RGB(255, 255, 255)
    End If

    ' --- Step 9: Add validation dropdowns ---
    AddDropdowns outWs, lastRow

    ' --- Step 10: Font, borders, freeze header row, autofit ---
    ' Font is applied before AutoFit so column widths reflect Aptos Narrow.
    Dim tableRange As Range
    Set tableRange = outWs.Range(outWs.Cells(1, 1), outWs.Cells(lastRow, 16))

    tableRange.Font.Name = "Aptos Narrow"
    tableRange.Font.Size = 11

    ' Inner grid lines (thin dark grey)
    With tableRange.Borders(xlInsideVertical)
        .LineStyle = xlContinuous
        .Weight    = xlThin
        .Color     = RGB(89, 89, 89)
    End With
    With tableRange.Borders(xlInsideHorizontal)
        .LineStyle = xlContinuous
        .Weight    = xlThin
        .Color     = RGB(89, 89, 89)
    End With

    ' Outer border (medium weight black -- clear table boundary)
    tableRange.BorderAround LineStyle:=xlContinuous, Weight:=xlMedium, Color:=RGB(0, 0, 0)

    outWs.Rows(1).RowHeight = 30
    outWs.Columns("A:P").AutoFit
    outWs.Range("A2").Select
    ActiveWindow.FreezePanes = True

    ' --- Step 11: Save; retry with a new name if the file is already open or locked ---
    Dim saveErr As Long
    Dim answer As VbMsgBoxResult
    Dim baseName As String
    Dim counter As Long
    Dim errMsg As String

    Do
        Application.DisplayAlerts = False
        On Error Resume Next
        outWb.SaveAs Filename:=fullPath, FileFormat:=xlOpenXMLWorkbook
        saveErr = Err.Number
        Err.Clear
        On Error GoTo CleanExit
        Application.DisplayAlerts = True

        If saveErr = 0 Then Exit Do

        answer = MsgBox("This file is already open and cannot be overwritten:" & vbNewLine & _
                        fileName & vbNewLine & vbNewLine & _
                        "Close the file and click Retry to overwrite it." & vbNewLine & _
                        "Or click Continue (Cancel) to save a new copy automatically.", _
                        vbRetryCancel + vbExclamation, "File Already Open")

        If answer = vbCancel Then
            baseName = savePath & "\MFC " & currentDateStr & " TO " & oneMonthAgoStr
            counter = 1
            Do
                fullPath = baseName & " (" & counter & ").xlsx"
                fileName = "MFC " & currentDateStr & " TO " & oneMonthAgoStr & " (" & counter & ").xlsx"
                counter = counter + 1
            Loop While Dir(fullPath) <> ""
        End If
    Loop

    Application.ScreenUpdating = True
    Set BuildMFCOutput = outWb
    Exit Function

CleanExit:
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    errMsg = IIf(Err.Number <> 0, "BuildMFCOutput: Error " & Err.Number & " - " & Err.Description, "")
    On Error Resume Next
    If Not outWb Is Nothing Then outWb.Close SaveChanges:=False
    On Error GoTo 0
    Set BuildMFCOutput = Nothing
    If Len(errMsg) > 0 Then MsgBox errMsg, vbCritical

End Function


' Compares Encounter Numbers in the output sheet against the previous MFC report.
' Backlog rows (same Encounter Number, not Resolved in previous report) are written
' as "Follow Up" in col E -- conditional formatting turns those rows orange.
' Staff mark rows "Resolved" in col E when done; next run skips those Encounter Nos.
' Also carries forward the manual columns A/B/C/D (Inflight FC Status, Date Updated,
' Staff Follow Up, Remarks) from non-Resolved previous rows into the matching new rows.
' outTotalCases and outBacklogCount are returned to MainMacro for the summary dialog.
Public Sub BacklogSummary(outWs As Worksheet, prevWs As Worksheet, _
                           ByRef outTotalCases As Long, ByRef outBacklogCount As Long)

    Const ENC_COL As Long = 7   ' Col G -- Encounter Number in output
    Const RES_COL As Long = 5   ' Col E -- Resolution Status in output

    Dim prevLastRow  As Long
    Dim prevEncs     As Object
    Dim prevData     As Variant
    Dim i            As Long
    Dim pEnc         As String
    Dim outLastRow   As Long
    Dim outData      As Variant
    Dim totalCases   As Long
    Dim backlogCount As Long
    Dim curEnc       As String

    ' --- Step 1: Load previous MFC Encounter Numbers into a dictionary ---
    ' Only include rows NOT already marked Resolved in the previous report.
    Dim prevEncCol    As Long
    Dim prevStatusCol As Long
    prevEncCol    = FindColByHeader(prevWs, "Encounter Number")
    If prevEncCol = 0 Then prevEncCol = FindColByHeader(prevWs, "Encounter No")
    If prevEncCol = 0 Then
        MsgBox "BacklogSummary: 'Encounter Number' column not found in the previous MFC report." & vbNewLine & _
               "Backlog comparison skipped -- all cases treated as new.", _
               vbExclamation, "Column Not Found"
    End If

    prevStatusCol = FindColByHeader(prevWs, "Resolution Status")  ' col E in output

    ' Manual columns to carry forward (located by header; 0 = absent in older files)
    Dim prevInflightCol As Long
    Dim prevDateCol     As Long
    Dim prevStaffCol    As Long
    Dim prevRemarksCol  As Long
    prevInflightCol = FindColByHeader(prevWs, "Inflight FC Status")
    prevDateCol     = FindColByHeader(prevWs, "Date Updated (DD/MM/YYYY)")
    If prevDateCol = 0 Then prevDateCol = FindColByHeader(prevWs, "Date Updated")
    prevStaffCol    = FindColByHeader(prevWs, "Staff Follow Up (if any)")
    If prevStaffCol = 0 Then prevStaffCol = FindColByHeader(prevWs, "Staff Follow Up")
    prevRemarksCol  = FindColByHeader(prevWs, "Remarks")

    Set prevEncs = CreateObject("Scripting.Dictionary")

    ' carryFwd: Encounter Number -> Array(inflight, dateUpdated, staffFollowUp)
    Dim carryFwd As Object
    Set carryFwd = CreateObject("Scripting.Dictionary")

    If prevEncCol > 0 Then
        prevLastRow = prevWs.Cells(prevWs.Rows.Count, prevEncCol).End(xlUp).Row

        If prevLastRow >= 2 Then
            Dim prevLastCol As Long
            prevLastCol = Application.WorksheetFunction.Max(prevEncCol, _
                IIf(prevStatusCol > 0, prevStatusCol, 1), _
                IIf(prevInflightCol > 0, prevInflightCol, 1), _
                IIf(prevDateCol > 0, prevDateCol, 1), _
                IIf(prevStaffCol > 0, prevStaffCol, 1), _
                IIf(prevRemarksCol > 0, prevRemarksCol, 1))
            prevData = prevWs.Range(prevWs.Cells(2, 1), prevWs.Cells(prevLastRow, prevLastCol)).Value

            Dim prevStat As String
            For i = 1 To UBound(prevData, 1)
                pEnc = Trim(CStr(prevData(i, prevEncCol)))
                If pEnc <> "" And Not prevEncs.Exists(pEnc) Then
                    prevStat = ""
                    If prevStatusCol > 0 Then prevStat = UCase(Trim(CStr(prevData(i, prevStatusCol))))
                    If prevStat <> "RESOLVED" Then
                        prevEncs(pEnc) = True
                        ' Build carry-forward values with explicit guards.
                        ' IIf() is NOT short-circuit -- it evaluates both branches,
                        ' so IIf(col>0, prevData(i,col), "") would read prevData(i,0)
                        ' when a column is absent and raise error 9 (subscript out of range).
                        Dim cfInflight As Variant, cfDate As Variant
                        Dim cfStaff As Variant, cfRemarks As Variant
                        cfInflight = "": cfDate = "": cfStaff = "": cfRemarks = ""
                        If prevInflightCol > 0 Then cfInflight = prevData(i, prevInflightCol)
                        If prevDateCol > 0 Then cfDate = prevData(i, prevDateCol)
                        If prevStaffCol > 0 Then cfStaff = prevData(i, prevStaffCol)
                        If prevRemarksCol > 0 Then cfRemarks = prevData(i, prevRemarksCol)
                        carryFwd(pEnc) = Array(cfInflight, cfDate, cfStaff, cfRemarks)
                    End If
                End If
            Next i
        End If
    End If

    ' --- Step 2: Scan output, count totals, write "Follow Up" to backlog rows ---
    ' Conditional formatting on col E turns those rows orange automatically.
    outLastRow = outWs.Cells(outWs.Rows.Count, ENC_COL).End(xlUp).Row
    outData = outWs.Range(outWs.Cells(2, ENC_COL), outWs.Cells(outLastRow, ENC_COL)).Value

    Dim resCol As Long
    resCol = FindColByHeader(outWs, "Resolution Status")
    If resCol = 0 Then resCol = RES_COL

    Application.ScreenUpdating = False
    Dim cf As Variant
    For i = 1 To UBound(outData, 1)
        curEnc = Trim(CStr(outData(i, 1)))
        If curEnc <> "" Then
            totalCases = totalCases + 1
            If prevEncs.Exists(curEnc) Then
                backlogCount = backlogCount + 1
                outWs.Cells(i + 1, resCol).Value = "Follow Up"
            End If
            ' Carry forward manual cols A/B/C/D from the matching non-Resolved prev row
            If carryFwd.Exists(curEnc) Then
                cf = carryFwd(curEnc)
                outWs.Cells(i + 1, 1).Value = cf(0)  ' Inflight FC Status
                outWs.Cells(i + 1, 2).Value = cf(1)  ' Date Updated
                outWs.Cells(i + 1, 3).Value = cf(2)  ' Staff Follow Up
                outWs.Cells(i + 1, 4).Value = cf(3)  ' Remarks
            End If
        End If
    Next i
    Application.ScreenUpdating = True

    ' --- Step 3: Write summary sub-table two rows below last data row ---
    WriteSummaryTable outWs, outLastRow + 3, totalCases, backlogCount

    outWs.Parent.Save  ' Persist summary table before returning to MainMacro

    outTotalCases   = totalCases
    outBacklogCount = backlogCount

End Sub


' Writes a 6-row coloured summary table at startRow (cols A:B).
' Staff fill in the "To Follow Up on CCF" and "EL Admissions" value cells.
' Today's Cases is a live formula: Total Cases - Backlog (cases not in prev MFC).
Private Sub WriteSummaryTable(outWs As Worksheet, startRow As Long, _
                               totalCases As Long, backlogCount As Long)

    Const COL_LBL As Long = 1  ' Col A -- label
    Const COL_VAL As Long = 2  ' Col B -- value

    Dim r0 As Long : r0 = startRow      ' header
    Dim r1 As Long : r1 = startRow + 1  ' Total Cases
    Dim r2 As Long : r2 = startRow + 2  ' Backlog
    Dim r3 As Long : r3 = startRow + 3  ' To Follow Up on CCF
    Dim r4 As Long : r4 = startRow + 4  ' Today's Cases
    Dim r5 As Long : r5 = startRow + 5  ' EL Admissions

    ' --- Header row ---
    With outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r0, COL_VAL))
        .Merge
        .Value = "MFC Report Summary"
        .Font.Bold = True
        .Font.Color = RGB(255, 255, 255)
        .Interior.Color = RGB(31, 73, 125)
        .HorizontalAlignment = xlCenter
    End With

    ' --- Labels and row backgrounds ---
    Dim lbls(1 To 5)     As String
    Dim dataRows(1 To 5) As Long
    Dim bgColors(1 To 5) As Long

    lbls(1) = "Total Cases"          : dataRows(1) = r1 : bgColors(1) = RGB(217, 226, 239)  ' light blue-grey
    lbls(2) = "Backlog"              : dataRows(2) = r2 : bgColors(2) = RGB(255, 255, 255)  ' white
    lbls(3) = "To Follow Up on CCF"  : dataRows(3) = r3 : bgColors(3) = RGB(255, 255, 153)  ' light yellow -- staff fills in
    lbls(4) = "Today's Cases"        : dataRows(4) = r4 : bgColors(4) = RGB(217, 226, 239)
    lbls(5) = "EL Admissions"        : dataRows(5) = r5 : bgColors(5) = RGB(255, 255, 153)  ' light yellow -- staff fills in

    Dim i As Long
    For i = 1 To 5
        With outWs.Cells(dataRows(i), COL_LBL)
            .Value = lbls(i)
            .Font.Bold = True
            .Interior.Color = bgColors(i)
        End With
        outWs.Cells(dataRows(i), COL_VAL).Interior.Color = bgColors(i)
    Next i

    ' --- Values ---
    outWs.Cells(r1, COL_VAL).Value = totalCases
    outWs.Cells(r2, COL_VAL).Value = backlogCount
    ' To Follow Up on CCF (r3) is left blank -- staff enter this manually.
    ' Today's Cases: live formula -- new cases = Total Cases - Backlog
    outWs.Cells(r4, COL_VAL).Formula = "=" & outWs.Cells(r1, COL_VAL).Address(True, True) & _
                                        "-" & outWs.Cells(r2, COL_VAL).Address(True, True)

    ' --- Cell notes to prompt staff for the manual cells ---
    On Error Resume Next
    outWs.Cells(r3, COL_VAL).Comment.Delete
    outWs.Cells(r5, COL_VAL).Comment.Delete
    On Error GoTo 0
    outWs.Cells(r3, COL_VAL).AddComment "Enter the number of cases to follow up on CCF"
    outWs.Cells(r5, COL_VAL).AddComment "Enter EL Admissions count from email"

    ' --- Borders on the full 6-row table ---
    With outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r5, COL_VAL)).Borders
        .LineStyle = xlContinuous
        .Weight = xlThin
        .Color = RGB(89, 89, 89)
    End With
    outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r5, COL_VAL)).BorderAround _
        LineStyle:=xlContinuous, Weight:=xlMedium, Color:=RGB(0, 0, 0)

    ' Font to match main table
    With outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r5, COL_VAL)).Font
        .Name = "Aptos Narrow"
        .Size = 11
    End With

    outWs.Columns(COL_LBL).AutoFit

End Sub


' Applies the Resolution Status dropdown and row conditional formatting (always),
' then reads dropdown lists from the Config sheet for cols A and C (Config-dependent).
'
' Resolution Status (col E) uses an inline two-value list so it works even when
' Config is missing. Conditional formatting on A:P colours entire rows:
'   Follow Up -> amber/orange   Resolved -> green
' Conditional formatting overrides direct cell fills, so it takes visual priority
' over the red duplicate highlight applied by FlagDuplicateRows.
Private Sub AddDropdowns(outWs As Worksheet, lastRow As Long)

    If lastRow < 2 Then Exit Sub

    Const RES_COL  As Long = 5   ' Col E -- Resolution Status
    Const LAST_COL As Long = 16  ' Col P -- last output column (for CF range)

    ' --- Always: Date Updated (col B) -- DD/MM/YYYY display format ---
    ' The clickable dropdown of recent dates is applied further below, once the
    ' hidden Lists sheet exists. The number format here ensures any typed or
    ' picked date still displays as DD/MM/YYYY.
    Const DATE_COL As Long = 2
    outWs.Range(outWs.Cells(2, DATE_COL), outWs.Cells(lastRow, DATE_COL)).NumberFormat = "DD/MM/YYYY"

    ' --- Always: Resolution Status dropdown (col E) ---
    With outWs.Range(outWs.Cells(2, RES_COL), outWs.Cells(lastRow, RES_COL)).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
             Operator:=xlBetween, Formula1:="Follow Up,Resolved"
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With

    ' --- Always: Row conditional formatting driven by col E ---
    ' $E2 -- absolute column E, row adjusts per row in the applied range.
    Dim cf As FormatCondition
    With outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, LAST_COL)).FormatConditions
        .Delete
        Set cf = .Add(Type:=xlExpression, Formula1:="=$E2=""Follow Up""")
        cf.Interior.Color = RGB(255, 229, 153)  ' pale gold
        cf.Font.Color     = RGB(0, 0, 0)
        cf.StopIfTrue     = True
        Set cf = .Add(Type:=xlExpression, Formula1:="=$E2=""Resolved""")
        cf.Interior.Color = RGB(169, 209, 142)  ' soft sage green
        cf.Font.Color     = RGB(0, 0, 0)
        cf.StopIfTrue     = True
    End With

    ' --- Always: create the hidden Lists sheet (holds all dropdown source values) ---
    ' Created once here so the date dropdown works even if the Config sheet is
    ' missing. Cols: A = Inflight FC Status, B = Staff Follow Up, C = recent dates.
    Dim outWb   As Workbook
    Dim listsWs As Worksheet
    Set outWb = outWs.Parent

    On Error Resume Next
    Set listsWs = outWb.Sheets("Lists")
    On Error GoTo 0
    If Not listsWs Is Nothing Then
        Application.DisplayAlerts = False
        listsWs.Delete
        Application.DisplayAlerts = True
    End If
    Set listsWs = outWb.Sheets.Add(After:=outWb.Sheets(outWb.Sheets.Count))
    listsWs.Name = "Lists"
    listsWs.Visible = xlSheetVeryHidden

    ' --- Always: Date Updated (col B) dropdown of recent dates ---
    ' Write the last DATE_DAYS+1 dates into Lists col C, most recent first so
    ' "today" sits at the top of the dropdown. Real date serials (not text) so
    ' the picked value is a true date and displays via the DD/MM/YYYY format.
    Const DATE_DAYS As Long = 30
    Dim d As Long
    For d = 0 To DATE_DAYS
        listsWs.Cells(d + 2, 3).Value = Date - d
    Next d
    listsWs.Range(listsWs.Cells(2, 3), listsWs.Cells(DATE_DAYS + 2, 3)).NumberFormat = "DD/MM/YYYY"

    With outWs.Range(outWs.Cells(2, DATE_COL), outWs.Cells(lastRow, DATE_COL)).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
             Operator:=xlBetween, Formula1:="=Lists!$C$2:$C$" & (DATE_DAYS + 2)
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With

    ' --- Config-dependent: Inflight FC Status (col A) and Staff Follow Up (col C) ---
    Dim cfgWs As Worksheet
    On Error Resume Next
    Set cfgWs = ThisWorkbook.Sheets("Config")
    On Error GoTo 0

    If cfgWs Is Nothing Then
        MsgBox "AddDropdowns: 'Config' sheet not found in the macro workbook." & vbNewLine & _
               "Run CreateConfigSheet (Alt+F8) first, then re-run the macro.", _
               vbExclamation, "Config Missing"
        Exit Sub
    End If

    ' Locate list columns by header name so inserting columns in Config doesn't break reads
    Dim inflightCol As Long
    Dim staffCol    As Long
    inflightCol = FindColByHeader(cfgWs, "Inflight FC Status")
    staffCol    = FindColByHeader(cfgWs, "Staff Follow Up")

    ' Read both lists from Config
    Dim inflightCount As Long
    Dim staffCount    As Long
    Dim inflightList() As String
    Dim staffList()   As String
    If inflightCol > 0 Then inflightList = ReadConfigColumn(cfgWs, inflightCol, inflightCount)
    If staffCol    > 0 Then staffList    = ReadConfigColumn(cfgWs, staffCol,    staffCount)

    If inflightCount = 0 And staffCount = 0 Then
        MsgBox "AddDropdowns: Both dropdown lists in the Config sheet are empty." & vbNewLine & _
               "Add values under 'Inflight FC Status' and/or 'Staff Follow Up' on the Config tab.", _
               vbExclamation, "Config Lists Empty"
        Exit Sub
    End If

    ' The hidden Lists sheet was already created above (col C holds the recent-date
    ' list). Reuse it -- write the Config-driven dropdown lists into cols A and B.

    ' Write inflight list to Lists col A (starting row 2)
    Dim r As Long
    For r = 1 To inflightCount
        listsWs.Cells(r + 1, 1).Value = inflightList(r)
    Next r

    ' Write staff list to Lists col B (starting row 2)
    For r = 1 To staffCount
        listsWs.Cells(r + 1, 2).Value = staffList(r)
    Next r

    ' Apply range-based validation -- col A: Inflight FC Status
    If inflightCount > 0 Then
        With outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, 1)).Validation
            .Delete
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
                 Operator:=xlBetween, _
                 Formula1:="=Lists!$A$2:$A$" & (inflightCount + 1)
            .IgnoreBlank = True
            .InCellDropdown = True
            .ShowError = False
        End With
    End If

    ' Apply range-based validation -- col C: Staff Follow Up
    If staffCount > 0 Then
        With outWs.Range(outWs.Cells(2, 3), outWs.Cells(lastRow, 3)).Validation
            .Delete
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
                 Operator:=xlBetween, _
                 Formula1:="=Lists!$B$2:$B$" & (staffCount + 1)
            .IgnoreBlank = True
            .InCellDropdown = True
            .ShowError = False
        End With
    End If

End Sub

' Reads non-blank string values from a single column of ws starting at row 2,
' stopping at the first blank cell. Returns a 1-based String array and sets count.
' Returns a 1-slot placeholder array when count = 0; callers must check count before iterating.
Private Function ReadConfigColumn(ws As Worksheet, colIdx As Long, ByRef count As Long) As String()

    Dim items()   As String
    Dim cellVal   As String
    Dim r         As Long
    ReDim items(1 To 1)
    count = 0
    r = 2

    cellVal = Trim(CStr(ws.Cells(r, colIdx).Value))
    Do While cellVal <> ""
        count = count + 1
        ReDim Preserve items(1 To count)
        items(count) = cellVal
        r = r + 1
        cellVal = Trim(CStr(ws.Cells(r, colIdx).Value))
    Loop

    ReadConfigColumn = items

End Function
``r

### MODULE: FilePickerForm.frm
`ba
VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} FilePickerForm 
   Caption         =   "MFC Report — Select Input Files"
   ClientHeight    =   5500
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   7500
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "FilePickerForm"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' Public properties to return the selected workbooks
Public SelectedMain As Workbook
Public SelectedMissed As Workbook
Public SelectedEpic As Workbook
Public SelectedPrev As Workbook
Public Cancelled As Boolean

' Module-level folder tracking
Private m_lastFolder As String

' Event-enabled controls
Private WithEvents m_btnMain As MSForms.CommandButton
Private WithEvents m_btnMissed As MSForms.CommandButton
Private WithEvents m_btnEpic As MSForms.CommandButton
Private WithEvents m_btnPrev As MSForms.CommandButton
Private WithEvents m_btnGenerate As MSForms.CommandButton
Private WithEvents m_btnCancel As MSForms.CommandButton

' Label controls (to update status/filenames)
Private m_lblMainFile As MSForms.Label
Private m_lblMainStatus As MSForms.Label

Private m_lblMissedFile As MSForms.Label
Private m_lblMissedStatus As MSForms.Label

Private m_lblEpicFile As MSForms.Label
Private m_lblEpicStatus As MSForms.Label

Private m_lblPrevFile As MSForms.Label
Private m_lblPrevStatus As MSForms.Label

Private m_lblWarning As MSForms.Label

' Status flags
Private m_validMain As Boolean
Private m_validMissed As Boolean
Private m_validEpic As Boolean
Private m_validPrev As Boolean

Public Function ShowFilePicker() As Boolean
    Cancelled = True
    Set SelectedMain = Nothing
    Set SelectedMissed = Nothing
    Set SelectedEpic = Nothing
    Set SelectedPrev = Nothing
    m_lastFolder = ""
    
    m_validMain = False
    m_validMissed = False
    m_validEpic = False
    m_validPrev = False

    Me.Show vbModal
    
    ShowFilePicker = Not Cancelled
End Function

Private Sub UserForm_Initialize()
    ' Set up form size and styling
    Me.Caption = "MFC Report — Select Input Files"
    Me.Width = 510
    Me.Height = 370
    Me.Font.Name = "Tahoma"
    Me.Font.Size = 9.5

    ' Row 1: EFC Main
    CreateLabel "lblEFCMain", "EFC Report (without Missed FC)", 20, 15, 460, 15, True
    Set m_btnMain = CreateButton("btnMain", "Browse...", 20, 32, 70, 22)
    Set m_lblMainFile = CreateLabel("lblEFCMainFile", "(not selected)", 100, 35, 280, 15, False)
    Set m_lblMainStatus = CreateLabel("lblEFCMainStatus", "○", 390, 35, 90, 15, False)
    m_lblMainStatus.Font.Bold = True

    ' Row 2: EFC Missed
    CreateLabel "lblEFCMissed", "EFC Report (with Missed FC)", 20, 70, 460, 15, True
    Set m_btnMissed = CreateButton("btnMissed", "Browse...", 20, 87, 70, 22)
    Set m_lblMissedFile = CreateLabel("lblEFCMissedFile", "(not selected)", 100, 90, 280, 15, False)
    Set m_lblMissedStatus = CreateLabel("lblEFCMissedStatus", "○", 390, 90, 90, 15, False)
    m_lblMissedStatus.Font.Bold = True

    ' Row count warning label
    Set m_lblWarning = CreateLabel("lblWarning", "", 20, 122, 460, 25, False)
    m_lblWarning.ForeColor = RGB(180, 80, 0) ' Dark Orange
    m_lblWarning.Font.Bold = True
    m_lblWarning.Visible = False

    ' Row 3: Epic Census
    CreateLabel "lblEpic", "Epic Census Report", 20, 155, 460, 15, True
    Set m_btnEpic = CreateButton("btnEpic", "Browse...", 20, 172, 70, 22)
    Set m_lblEpicFile = CreateLabel("lblEpicFile", "(not selected)", 100, 175, 280, 15, False)
    Set m_lblEpicStatus = CreateLabel("lblEpicStatus", "○", 390, 175, 90, 15, False)
    m_lblEpicStatus.Font.Bold = True

    ' Row 4: Previous MFC
    CreateLabel "lblPrev", "Previous MFC Report", 20, 210, 460, 15, True
    Set m_btnPrev = CreateButton("btnPrev", "Browse...", 20, 227, 70, 22)
    Set m_lblPrevFile = CreateLabel("lblPrevFile", "(not selected)", 100, 230, 280, 15, False)
    Set m_lblPrevStatus = CreateLabel("lblPrevStatus", "○", 390, 230, 90, 15, False)
    m_lblPrevStatus.Font.Bold = True

    ' Bottom Buttons
    Set m_btnGenerate = CreateButton("btnGenerate", "Generate Report", 240, 285, 110, 26)
    m_btnGenerate.Enabled = False
    Set m_btnCancel = CreateButton("btnCancel", "Cancel", 365, 285, 110, 26)
End Sub

Private Function CreateLabel(name As String, caption As String, left As Single, top As Single, width As Single, height As Single, bold As Boolean) As MSForms.Label
    Dim lbl As MSForms.Label
    Set lbl = Me.Controls.Add("Forms.Label.1", name, True)
    lbl.left = left
    lbl.top = top
    lbl.width = width
    lbl.height = height
    lbl.caption = caption
    If bold Then lbl.Font.Bold = True
    Set CreateLabel = lbl
End Function

Private Function CreateButton(name As String, caption As String, left As Single, top As Single, width As Single, height As Single) As MSForms.CommandButton
    Dim btn As MSForms.CommandButton
    Set btn = Me.Controls.Add("Forms.CommandButton.1", name, True)
    btn.left = left
    btn.top = top
    btn.width = width
    btn.height = height
    btn.caption = caption
    Set CreateButton = btn
End Function

Private Function PickFileWithFolder(title As String) As Workbook
    Dim fd As FileDialog
    Set fd = Application.FileDialog(msoFileDialogFilePicker)
    fd.title = title
    fd.Filters.Clear
    fd.Filters.Add "Excel Files", "*.xlsx; *.xlsm; *.xls"

    If m_lastFolder <> "" Then fd.InitialFileName = m_lastFolder & "\"

    If fd.Show = -1 Then
        Dim filePath As String
        filePath = fd.SelectedItems(1)
        m_lastFolder = Left(filePath, InStrRev(filePath, "\") - 1)
        Set PickFileWithFolder = Workbooks.Open(filePath)
    Else
        Set PickFileWithFolder = Nothing
    End If
End Function

Private Sub UpdateValidationStatus()
    ' Clear warning
    m_lblWarning.caption = ""
    m_lblWarning.Visible = False

    ' Duplicate EFC check
    If Not SelectedMain Is Nothing And Not SelectedMissed Is Nothing Then
        If UCase(SelectedMain.FullName) = UCase(SelectedMissed.FullName) Then
            m_lblWarning.caption = "⚠ Same file selected for both EFC reports!"
            m_lblWarning.Visible = True
            m_validMissed = False
            m_lblMissedStatus.caption = "✗ Same file"
            m_lblMissedStatus.ForeColor = RGB(255, 0, 0)
        Else
            ' Check row counts
            Dim mainRows As Long, missedRows As Long
            mainRows = SelectedMain.Sheets(1).Cells(SelectedMain.Sheets(1).Rows.Count, 3).End(xlUp).Row - 1
            missedRows = SelectedMissed.Sheets(1).Cells(SelectedMissed.Sheets(1).Rows.Count, 3).End(xlUp).Row - 1
            If mainRows > 0 And missedRows > 0 Then
                If mainRows = missedRows Then
                    m_lblWarning.caption = "⚠ Both EFC files have the same row count (" & mainRows & "). Verify exports."
                    m_lblWarning.Visible = True
                ElseIf missedRows > mainRows Then
                    m_lblWarning.caption = "⚠ Missed FC file has MORE rows than main file. Verify order."
                    m_lblWarning.Visible = True
                End If
            End If
        End If
    End If

    ' Enable Generate button if all slots are valid
    m_btnGenerate.Enabled = (m_validMain And m_validMissed And m_validEpic And m_validPrev)
End Sub

Private Sub m_btnMain_Click()
    Dim wb As Workbook
    Set wb = PickFileWithFolder("Select EFC Report WITHOUT Missed FC")
    If Not wb Is Nothing Then
        If Not SelectedMain Is Nothing Then
            On Error Resume Next
            SelectedMain.Close SaveChanges:=False
            On Error GoTo 0
        End If
        Set SelectedMain = wb
        m_lblMainFile.caption = wb.Name
        If ValidateFileHeaders(wb, "EFC") Then
            m_validMain = True
            m_lblMainStatus.caption = "✓ Valid"
            m_lblMainStatus.ForeColor = RGB(0, 128, 0)
        Else
            m_validMain = False
            m_lblMainStatus.caption = "✗ Invalid"
            m_lblMainStatus.ForeColor = RGB(255, 0, 0)
        End If
        UpdateValidationStatus()
    End If
End Sub

Private Sub m_btnMissed_Click()
    Dim wb As Workbook
    Set wb = PickFileWithFolder("Select EFC Report WITH Missed FC")
    If Not wb Is Nothing Then
        If Not SelectedMissed Is Nothing Then
            On Error Resume Next
            SelectedMissed.Close SaveChanges:=False
            On Error GoTo 0
        End If
        Set SelectedMissed = wb
        m_lblMissedFile.caption = wb.Name
        If ValidateFileHeaders(wb, "EFC") Then
            m_validMissed = True
            m_lblMissedStatus.caption = "✓ Valid"
            m_lblMissedStatus.ForeColor = RGB(0, 128, 0)
        Else
            m_validMissed = False
            m_lblMissedStatus.caption = "✗ Invalid"
            m_lblMissedStatus.ForeColor = RGB(255, 0, 0)
        End If
        UpdateValidationStatus()
    End If
End Sub

Private Sub m_btnEpic_Click()
    Dim wb As Workbook
    Set wb = PickFileWithFolder("Select Epic Census Report")
    If Not wb Is Nothing Then
        If Not SelectedEpic Is Nothing Then
            On Error Resume Next
            SelectedEpic.Close SaveChanges:=False
            On Error GoTo 0
        End If
        Set SelectedEpic = wb
        m_lblEpicFile.caption = wb.Name
        If ValidateFileHeaders(wb, "EPIC") Then
            m_validEpic = True
            m_lblEpicStatus.caption = "✓ Valid"
            m_lblEpicStatus.ForeColor = RGB(0, 128, 0)
        Else
            m_validEpic = False
            m_lblEpicStatus.caption = "✗ Invalid"
            m_lblEpicStatus.ForeColor = RGB(255, 0, 0)
        End If
        UpdateValidationStatus()
    End If
End Sub

Private Sub m_btnPrev_Click()
    Dim wb As Workbook
    Set wb = PickFileWithFolder("Select Previous MFC Report")
    If Not wb Is Nothing Then
        If Not SelectedPrev Is Nothing Then
            On Error Resume Next
            SelectedPrev.Close SaveChanges:=False
            On Error GoTo 0
        End If
        Set SelectedPrev = wb
        m_lblPrevFile.caption = wb.Name
        If ValidateFileHeaders(wb, "PREV_MFC") Then
            m_validPrev = True
            m_lblPrevStatus.caption = "✓ Valid"
            m_lblPrevStatus.ForeColor = RGB(0, 128, 0)
        Else
            m_validPrev = False
            m_lblPrevStatus.caption = "✗ Invalid"
            m_lblPrevStatus.ForeColor = RGB(255, 0, 0)
        End If
        UpdateValidationStatus()
    End If
End Sub

Private Sub m_btnGenerate_Click()
    Cancelled = False
    Me.Hide
End Sub

Private Sub m_btnCancel_Click()
    Cancelled = True
    ' Close opened files
    On Error Resume Next
    If Not SelectedMain Is Nothing Then SelectedMain.Close SaveChanges:=False
    If Not SelectedMissed Is Nothing Then SelectedMissed.Close SaveChanges:=False
    If Not SelectedEpic Is Nothing Then SelectedEpic.Close SaveChanges:=False
    If Not SelectedPrev Is Nothing Then SelectedPrev.Close SaveChanges:=False
    On Error GoTo 0
    Me.Hide
End Sub

Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    If CloseMode = vbFormControlMenu Then
        Cancel = 1
        m_btnCancel_Click
    End If
End Sub
``r


# Inflight MFC Report Macro -- Full Context & Reference

## Purpose
Automate the manual Excel-based MFC (Missed Financial Counselling) daily report
generation workflow for the **Inflight Financial Counselling** team at Tan Tock Seng
Hospital (TTSH). The macro takes four Excel inputs (two eFC exports, an Epic Census
export, and the previous MFC daily list), filters and enriches the data, and produces
a formatted `.xlsx` report.

This is the Inflight counterpart to the NCID MFC macro. The Inflight team covers the
main hospital wards (levels 3--13, ICH, Renci, MIC), while NCID covers the infectious
diseases wards. The data pipeline is structurally identical -- the differences are in
which wards are kept, which columns appear in the output, and the Inflight FC Status
dropdown values.

---

## Inputs
4 Excel files selected by the user through a file selection dashboard:

1. **EFC export WITHOUT Missed FC** -- main EFC file (has FC ID numbers)
2. **EFC export WITH Missed FC** -- missed FC file (no FC ID numbers)
3. **Epic Census Snapshot Report** -- patient bed and admission status
4. **Previous MFC daily list** -- for backlog tracking and carry-forward

---

## How to Export Each Input File

### EFC Reports (both files)
Both EFC reports are exported from **eFC > Reports > Inflight Financial Counselling**.

**Settings for both reports:**
- Visit/Admission Date: one-month date range (e.g. 06.08.2025 to 06.09.2025)
- Admission Type: **Emergency** only

**1st report -- WITH Missed FC (no FC IDs):**
- Tick **"Missed FC"** > click **Submit Request**
- This report will NOT show FC ID numbers

**2nd report -- WITHOUT Missed FC (has FC IDs):**
- Leave **"Missed FC"** blank > click **Submit Request**
- This report WILL show FC ID numbers

After each report is generated:
1. Click the refresh button
2. Once it shows as "Downloaded", click "Open", then extract the report
3. Save to the MFC daily report folder in OneDrive, renamed by date range

**Leave the first report open** -- you need to combine both reports into one sheet.

### Combining the Two EFC Reports (manual process automated by macro)
1. From the 2nd report, copy all data rows below the last row of the 1st report
2. The combined sheet will have rows with FC IDs (from report 2) and rows without (from report 1)
3. Fix Encounter No formatting: the eFC stores CSN as text, which needs conversion
   to a numeric format (=C2*1, then Format > Number > 0 decimal places)

**The macro automates this entire combine-and-format step.**

### Epic Census Snapshot Report
1. Log into Epic > Hyperdrive PRD
2. Navigate to **Census Snapshot Report**
3. Under **Display > Available Columns**, add:
   - CSN (EPT) (811)
   - Hospital Bed
4. Under **Criteria**, set the date range (one month, matching the eFC range)
5. Run the report
6. Export via the "..." menu > Export > Permit all access
7. Save to K drive: `K:\Inpatient Ops Financial Counselling\Inflight FC\INFLIGHT-REPORT\INFC <YEAR> FOLDER`
   - Password: `123`

After saving, fix the CSN format:
- Highlight CSN column > change from General to Number > Format Cells > 0 decimal places

**The macro automates the CSN format fix during the Epic lookup step.**

### Previous MFC Daily List
The previous day's (or week's) saved MFC output file. Used for backlog comparison
and carry-forward of manual columns. No export needed -- just locate the file.

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
- **Encounter No (Column C)** -- stored as TEXT in EFC. Example: `100241111111`
- **Admission Date (Column H)** -- format: `MM/DD/YYYY HH:MM:SS AM/PM`. Example: `12/18/2025 9:31:33 AM`
- **FC Status (Column AQ)** -- filter keeps only Draft variants; drops all completed/attempted statuses
- **Missed FC (Column AO)** -- rows where `Missed FC = "Yes"` are always kept regardless of FC Status
- **Patient Name (Column F)** -- stored in ALL CAPS
- **Point Of Care (Column K)** -- ward name used for the Inflight ward filter (excludelist)
- **Admission Type (Column G)** -- Inflight uses Emergency only

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
- **CSN (Column F)** -- stored as NUMBER in Epic. Converted to string (`CStr()`) before matching against EFC Encounter No
- **Admit Status (Column E)** -- values include: `Discharged`, `Admission`, `Planned`
- **Bed (Column H)** -- example format: `T07E18N`. Used directly as "Final Bed" in the output
- Epic file typically has ~20,000 rows
- All columns located by header name via `FindColByHeader`

---

## Output File Structure
New `.xlsx` file named: `MFC DD.MM.YYYY TO DD.MM.YYYY`
Date range: current system date (first) and one month ago (second).
Sheet name: `MFC Report`

### Output Column Layout

| Column | Header | Source |
|--------|--------|--------|
| A | Inflight FC Status | Manual -- dropdown (20 Inflight-specific values); **carried forward** from previous MFC |
| B | Date Updated (DD/MM/YYYY) | Manual -- date picker; **carried forward** |
| C | Staff Follow Up (if any) | Manual -- dropdown; **carried forward** |
| D | Remarks | Manual; **carried forward** |
| E | Resolution Status | Manual -- dropdown: `Follow Up` / `Resolved` |
| F | FC ID | EFC Column A (blank for Missed FC rows) |
| G | Encounter Number | EFC Column C |
| H | MRN | EFC Column D |
| I | Patient Name | EFC Column F |
| J | Adm Date for MFC | EFC Column H reformatted to DD/MM/YYYY |
| K | FC Status | EFC Column AQ (blank for Missed FC rows) |
| L | Point of Care | EFC Column K |
| M | Final Bed | Epic Column H (matched via Encounter No = CSN) |
| N | Admission Level Of Care | EFC Column L |
| O | Epic Admission Status | Epic Column E (matched via Encounter No = CSN) |

### Output Save Location
The macro prompts the user to select a save folder via a folder picker dialog.

### Output Formatting
- Font: **Aptos Narrow, size 11** across the full table
- Inner borders: thin dark grey between all cells
- Outer border: medium weight black around the table boundary
- Col B: formatted as `DD/MM/YYYY` with date validation dropdown (last 31 dates)
- Col E: dropdown `Follow Up / Resolved`; conditional formatting colours rows --
  **pale gold** for `Follow Up`, **soft sage green** for `Resolved`
- Col G (Encounter Number): number format `"0"` (no decimals)
- Col J (Adm Date for MFC): number format `"@"` (text, prevents date re-interpretation)
- Header row height: 30
- Freeze pane below row 1

### Dropdown Configuration
- **Column A -- Inflight FC Status**: 20 values (see Inflight FC Status Dropdown Values below)
- **Column B -- Date Updated**: last 31 dates (today down)
- **Column C -- Staff Follow Up**: team member names from Config sheet
- **Column E -- Resolution Status**: fixed inline list `Follow Up, Resolved`

---

## Workflow Steps

Steps run in this exact order inside the main macro:

1. **Open & validate input files** -- file selection dashboard; each file validated
   on selection. EFC files validated for required headers (FC ID, Encounter No, FC Status,
   Missed FC). Epic validated for CSN, Bed, Admit Status, Patient. Previous MFC accepted
   unconditionally.

2. **Combine EFC files** -- paste all data rows (values only) from the missed FC file
   below the last row of the main EFC file. Dynamic column count.

3. **Extract Admission Date** -- find "Admission Date" by header, reformat from
   `MM/DD/YYYY HH:MM:SS AM/PM` to `DD/MM/YYYY` string. Insert new column "Adm Date for MFC"
   immediately after "Admission Date".

4. **Filter FC Status** -- keep rows where:
   - `Missed FC = "Yes"` (always kept), OR
   - FC Status is a Draft variant (`Draft`, `Draft (ETBS Generated)`, `Draft (CCF Generated)`)
   
   Delete all other rows (Completed, Attempted-*, Acknowledge By Other Means, etc.).
   Runs before Epic lookup to reduce row count.

5. **XLOOKUP from Epic** -- bulk dictionary lookup of Final Bed and Epic Admission Status
   from Epic Census by matching Encounter No to CSN. Insert "Final Bed" column and
   "Epic Admission Status" column into the working sheet.

6. **Filter discharged cases** -- remove rows where Epic Admission Status = "Discharged"
   (or eFC Admission Status = "Discharged"). Discharged patients have left the ward.

7. **Filter by Point of Care (Inflight wards)** -- remove rows whose Point of Care
   matches the excludelist (see Inflight Ward Filter below). Keep only rows for wards
   the Inflight team covers.

8. **Flag duplicates** -- highlight in red every row where Encounter No + Patient Name
   combination appears more than once. Staff review and delete the duplicate.

9. **Build output** -- create new workbook with "MFC Report" sheet. Write headers A--O,
   copy data, apply formatting, dropdowns, and conditional formatting.

10. **Backlog summary** -- compare Encounter Numbers against previous MFC daily list.
    Carry forward manual columns (A--D) for backlog rows. Write summary table.

---

## Filter Logic

### FC Status Filter
Delete rows with these FC Status values:
- Completed
- Attempted-Unable to complete
- Acknowledge By Other Means
- Attempted-Virtual FC Completed, pending signature
- Attempted-Patient/NOK declines to sign

Keep rows where:
- `Missed FC = "Yes"` (always kept regardless of other status), OR
- FC Status is a Draft variant: `Draft`, `Draft (ETBS Generated)`, `Draft (CCF Generated)`

Uses `Encounter No` for `lastRow` because FC Status is blank in missed FC rows.

### Discharge Filter
After Epic lookup, remove all rows where the patient has been discharged.
Check Epic Admission Status = "Discharged" (and/or eFC Admission Status = "Discharged").

**Note:** Unlike NCID, the Inflight workflow removes ALL discharged cases including
Missed FC rows. The Inflight team does not follow up on discharged patients.

### Inflight Ward Filter (Point of Care excludelist)
Filter is based on the **Point of Care** column (eFC Column K), NOT on bed codes.

**Exclude these Point of Care values:**

| Excluded Ward | Reason |
|---------------|--------|
| AUC | Not covered by Inflight |
| EDC | Emergency Dept |
| EDTC | Emergency Dept |
| EDX | Emergency Dept |
| O14 | Not covered |
| O15 | Not covered |
| 3E/F | Not covered |
| 6E/F | Not covered |
| 8E | Not covered (NCID ward) |
| TWAS | Not covered |
| TWDS | Not covered |

**Inflight team covers these wards (keep):**
- Level 3 (excluding 3E/F)
- Level 5, 6 (excluding 6E/F), 7, 8 (excluding 8E), 9, 10, 11, 12, 13
- ICH 7, 8, 9 G & H
- Renci
- MIC

**Approach:** The macro uses an excludelist rather than an allowlist. Any Point of Care
not in the exclude list is kept. This differs from NCID which uses a bed-code allowlist
(`Mid(bed, 2, 3)` against 12 specific ward codes).

### Duplicate Flag
Rows where **Encounter No + Patient Name** combination appears more than once
(case-insensitive) are highlighted red, including the first occurrence.
Staff review and remove the true duplicate.

---

## Inflight FC Status Dropdown Values

The Inflight FC Status dropdown (Column A) has 20 values. These are the manual tracking
statuses used by the Inflight team for daily case management:

1. No Attempt
2. Attempted - Pending FC
3. FC Complete - CCF left with NOK
4. FC Complete - CCF signed
5. FC Completed @ ED
6. FC Declined @ ED
7. FC Declined @ Inflight
8. Discharged -- MCAF
9. Discharged - No MCAF
10. Uncontactable NOK with MCAF
11. Transfer to NCID/Renci
12. Planned Transfer
13. C Class with MediFund Activated
14. Nursing Home Case / No NOK
15. Deceased
16. Received unsigned CCF/FC/ReFC
17. Non-Inflight Case
18. Explained CCF but Declined FC form
19. LOG Template
20. Others (to indicate in Remarks)

---

## Backlog Summary

After building the output file, the backlog summary compares **Encounter Numbers** (col G)
in the output against the previous MFC daily list.

### Backlog Detection
A row is flagged as backlog if its Encounter Number:
- **appears** in the previous report's Encounter Number column, AND
- was **not** marked `Resolved` in the previous report's Resolution Status column

Backlog rows have `"Follow Up"` written to col E -- conditional formatting turns them amber.

### Carry-forward of Manual Columns
For every output row whose Encounter Number matched a non-Resolved row in the previous
report, the macro copies:

| Output Col | Header | Previous report column |
|------------|--------|------------------------|
| A | Inflight FC Status | Inflight FC Status |
| B | Date Updated | Date Updated (DD/MM/YYYY) |
| C | Staff Follow Up | Staff Follow Up (if any) |
| D | Remarks | Remarks |

### Summary Table
Written 3 rows below the last data row:

| Row | Label | Value |
|-----|-------|-------|
| Header | MFC Report Summary | -- (merged, blue header) |
| +1 | Total Cases | Calculated by macro |
| +2 | Backlog | Calculated (non-Resolved carry-forwards) |
| +3 | To Follow Up on CCF | **Blank -- staff fills in** (yellow) |
| +4 | Today's Cases | Live formula: Total Cases - Backlog |
| +5 | EL Admissions | **Blank -- staff fills in** (yellow) |

---

## Key Differences from NCID

| Aspect | NCID | Inflight |
|--------|------|----------|
| eFC Report path | Inflight Financial Counselling (same) | Inflight Financial Counselling (same) |
| Admission Type | Emergency + Elective Inpa | Emergency only |
| Ward filter method | Bed code allowlist: `Mid(bed,2,3)` | Point of Care excludelist |
| Ward filter values | 12 NCID ward codes | 11 excluded wards |
| Discharged Missed FC | Kept (staff follow up) | Removed (all discharged deleted) |
| Output columns | 16 (A--P) | 15 (A--O) |
| Output col differences | Has "Admit Status" (eFC), "Point of Care Final Bed" | Has "Final Bed", no separate "Admit Status" |
| Inflight FC Status values | 5 generic | 20 Inflight-specific |
| Codebase | Standalone NCID repo | Separate standalone repo (forked) |

---

## Operational Notes from SW

- Inflight team should **prioritize cases with an FC ID first** -- these are at risk of falling through
- Any returned hardcopy CCF forms must be signed and stamped "Received" by PSA before scanning
- Cases should be divided equally amongst the team after generating the daily report
- Staff copy "Last Updated By" from the eFC report temporarily to identify follow-up assignments;
  this is a manual step outside the macro's scope

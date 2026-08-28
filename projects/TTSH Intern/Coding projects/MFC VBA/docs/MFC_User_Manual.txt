# Tan Tock Seng Hospital (TTSH)
# Missed Financial Counselling (MFC) Report Generator: End-User Manual

This manual provides step-by-step instructions for the Financial Counselling (FC) team at TTSH on how to prepare files, run the automated MFC Report Generator macro, handle outputs, resolve errors, and perform downtime procedures.

---

## 1. Introduction & Workflow Overview

The MFC Report Generator is an Excel-based macro utility designed to automate the daily compilation of the Missed Financial Counselling (MFC) report. Previously, this process required multiple manual operations, including complex `XLOOKUP` formulas, custom filtering, and duplicate identification. 

The macro automates the following steps:
1. **File Selection & Verification**: Opens a single dashboard to select and validate all four source files at once.
2. **Data Merging**: Combines the main eFC report with the Missed eFC report.
3. **Date Extraction**: Extracts and formats admission dates.
4. **Status Filtering**: Removes discharged or irrelevant financial counselling records.
5. **Epic Census Integration**: Matches encounter numbers against the Epic database to retrieve bed locations and real-time admission status.
6. **Ward Filtering**: Automatically filters for NCID-specific wards.
7. **Duplicate Detection**: Flags patients with duplicate active records in red.
8. **Backlog Carry-Forward**: Compares the new data against the previous run's report and carries forward active statuses, update dates, remarks, and staff assignments.
9. **Reporting & Formatting**: Creates a beautifully formatted final sheet, complete with interactive dropdowns, date pickers, conditional row colors, and a summary table.

---

## 2. One-Time Configuration Setup

Before running the macro for the first time, or whenever staff lists or status lists change, you must verify the dropdown configurations. These live in the **Config** sheet of the macro workbook itself.

### Verifying or Re-creating the Config Sheet
If the **Config** sheet is deleted or missing from your macro workbook, you can initialize a fresh one:
1. Open the macro workbook.
2. Press **Alt + F8** (or Option + F8 on Mac) to open the macro list.
3. Select `CreateConfigSheet` and click **Run**.
4. A new sheet named **Config** will appear with default lists.

### Configuring Staff Names & Statuses
The macro uses the values in the **Config** sheet to build the dropdown menus in the final output report:
* **Column A (Inflight FC Status)**: List of statuses (e.g., *Pending*, *In Progress*, *Completed*, *Cancelled*, *On Hold*).
* **Column B (Staff Follow Up)**: List of staff names (e.g., *Staff A*, *Staff B*, *Staff C*). **You must replace these placeholder names with your current team roster.**

> [!IMPORTANT]
> Always edit the dropdown lists in the **Config** sheet of the **macro workbook**, not in the generated output files. The macro copies these lists into each new report it creates.

---

## 3. Daily File Preparation & Export Guide

To run the report, you must first export three fresh files from eFC and Epic, and locate the previous run's MFC report. 

### File 1: eFC Export (WITH Missed FC)
1. Log in to the **eFC portal**.
2. Navigate to **Reports** > **Inflight Financial Counselling Report**.
3. Apply the following settings:
   * **Admission Type**: Select both `Emergency` and `Elective Inpa` (to capture NCID cases).
   * **Visit/Admission Date**: Flip to the previous month. Select from **1 day after the present date** to the **present date**.
     * *Example*: If today is `05.03.2026`, select date range `06.02.2026` to `05.03.2026`.
4. **Tick** the checkbox for **Missed FC**.
5. Click **Submit request** and download the resulting file.

### File 2: eFC Export (WITHOUT Missed FC)
1. Go back to the **Inflight Financial Counselling Report** page.
2. Maintain the identical settings (Admission Type, Date Range) as File 1.
3. **Untick** the checkbox for **Missed FC**.
4. Click **Submit request** and download this second file.

### File 3: Epic Census Snapshot Report
1. Log in to **Epic**.
2. Navigate to the Epic menu > **Reports** > **ADT Reports** > **Census Reports** > **Census Snapshot Report**.
   * *Tip*: Pin this report for quick access.
3. Click the **Display** tab and ensure the following columns are selected:
   * `MRN`
   * `Patient`
   * `Admission Date`
   * `Patient Class`
   * `Admit Status`
   * `CSN`
   * `Phone`
   * `Bed`
4. Click **Run** to generate the snapshot.
5. Click the three dots (**…**) in the corner of the report and select **Export**.
6. Save the file to your local drive or K drive folder.
   * *Note*: Do not export directly to OneDrive as it can block macro file access.
   * **Recommended Path**: `K:\Inpatient Ops Financial Counselling\Inflight FC\INFLIGHT-REPORT\INFC <YEAR> FOLDER\`
   * **File Password**: Save/protect the sheet with the password `123`.

### File 4: Previous MFC Report
Locate the previous day's (or week's) saved MFC output file. This is the output file that contains the running log of inflight statuses and follow-up notes. You do not need to export this; simply know its location.

### NCID Ward Allowlist Reference
The automated report only keeps cases belonging to the following NCID wards. If performing manual downtime procedures (Section 12), you must check these wards:

| Ward | Ward Code | Type | Disciplines / Notes |
| :---: | :---: | --- | --- |
| **14F** | `14F` | NCID BAU | RTB (Dermatology + ID overflow) |
| **12E** | `12E` | NCID BAU | DERM, IDS |
| **11E** | `11E` | NCID BAU | IDS (isolation rooms) |
| **8E** | `08E` | NCID BAU | IDS (COVID-19) |
| **9F** | `09F` | TTSH@NCID | GMD, GRM, ORT |
| **8F** | `08F` | TTSH@NCID | GMD, IDS, DER (A-Class) |
| **7F** | `07F` | TTSH@NCID | GMD, GRM (CPO) |
| **7E** | `07E` | TTSH@NCID | GMD, GRM (MRSA) |
| **6F** | `06F` | TTSH@NCID | GMD, GRM (MRSA) |
| **11F** | `11F` | TTSH@NCID | Vascular Surgery |
| **3E** | `03E` | OICU/HD | Mixed discipline |
| **5F** | `05F` | TTSH@NCID | — |

---

## 4. Running the Macro Step-by-Step

Follow these steps to compile the reports:

1. Open the **MFC Macro Workbook** (the Excel workbook containing the VBA code and the **Config** sheet).
2. Press **Alt + F8** to bring up the macro window.
3. Select `GenerateMFCReport` and click **Run**.
4. The macro launches the **File Selection dashboard** — a single window showing all four file slots at once. For each slot, click **Browse...** and pick the matching file (you can do them in any order):
   * **EFC Report (without Missed FC)** → File 2
   * **EFC Report (with Missed FC)** → File 1
   * **Epic Census Report** → File 3
   * **Previous MFC Report** → File 4

   As soon as you pick a file, the macro validates it and the slot shows **✓ Valid** (green) or **✗ Invalid** (red). If you picked the wrong file, just click **Browse...** again on that same slot to replace it — there is no need to restart. If both EFC files look suspicious (identical row counts, or the "with Missed FC" file has fewer rows), an amber advisory warning appears between the two EFC rows; it does **not** block you. See Section 10.1 for all dashboard indicators.
   * The **Generate Report** button stays greyed out until all four slots show **✓ Valid**. Click it to proceed, or click **Cancel** to abort (any files you opened are closed automatically).
5. **Choose Save Directory**: The macro then opens a folder picker. Choose the folder where you want to save the final report.
   * *Recommended Path*: `K:\Inpatient Ops Financial Counselling\NCID FC\NCID MFC\`
6. **Execution**: The macro processes the files. You can track progress in Excel's bottom-left **Status Bar** (e.g., *"Step 3/9: Extracting and reformatting admission dates...", "Step 5/9: Looking up Bed and Admit Status from Epic..."*).
7. **Success**: Once completed, the final compiled workbook opens on your screen and saves automatically. A confirmation popup shows the **Total Cases**, **Backlog**, and **Today's Cases** counts, followed by a short **Next Steps** checklist:
   1. Check **RED** rows — review and delete duplicates (see Section 7).
   2. Fill **YELLOW** cells — enter the CCF and EL counts in the summary table (see Section 9).

   The source workbooks close in the background.

---

## 5. Output File Walkthrough

The output file is named automatically using the date range chosen during export:
`MFC <Start Date> TO <End Date>.xlsx` (e.g., `MFC 06.02.2026 TO 05.03.2026.xlsx`).

The report contains a single sheet named **MFC Report**, containing the following columns:

| Column | Header | Description / Source | Action Required |
|:---:|---|---|---|
| **A** | **Inflight FC Status** | Dropdown list. Carries forward from previous report if case was open. | **Review/Update** |
| **B** | **Date Updated (DD/MM/YYYY)** | Calendar date-picker field. Carries forward from previous report. | **Update when status changes** |
| **C** | **Staff Follow Up (if any)** | Dropdown list of team members. Carries forward. | **Assign to staff** |
| **D** | **Remarks** | Free-text comments box. Carries forward. | **Enter notes** |
| **E** | **Resolution Status** | Dropdown options: `Follow Up` / `Resolved` / `Clear`. | **Set to Resolved when done; use Clear to dismiss a duplicate row** |
| **F** | **FC ID** | eFC Counselling Record ID. Blank for Missed FC. | None (Auto) |
| **G** | **Encounter Number** | Case Encounter / CSN. Format is locked to text/number. | None (Auto) |
| **H** | **MRN** | Medical Record Number. | None (Auto) |
| **I** | **Patient Name** | Full patient name in uppercase. | None (Auto) |
| **J** | **Adm Date for MFC** | Cleaned admission date in `DD/MM/YYYY` text format. | None (Auto) |
| **K** | **FC Status** | Status from eFC (Draft, Draft (ETBS), etc.). | None (Auto) |
| **L** | **Admit Status** | Original admission status from eFC. | None (Auto) |
| **M** | **Point of Care** | Admission ward location from eFC. | None (Auto) |
| **N** | **Point of Care Final Bed** | Current live bed/ward location from Epic Census. | None (Auto) |
| **O** | **Admission Level Of Care** | Level of care (General, ICU, etc.) from eFC. | None (Auto) |
| **P** | **Epic Admission Status/Discharged** | Current live patient status (`Admission` or `Discharged`). | None (Auto) |

---

## 6. Data Entry & Manual Procedures

While the macro handles collation, the Financial Counselling team must manually maintain columns A through E to track case workflow.

### Using the Dropdown Menus
* **Inflight FC Status (Column A)**: Select the current stage of the financial counselling.
* **Staff Follow Up (Column C)**: Select the team member assigned to handle this case.
* **Resolution Status (Column E)**: Select whether the case requires active tracking (`Follow Up`), is completed (`Resolved`), or is a reviewed duplicate that should be visually cleared (`Clear`).

### Date Updated (Column B)
When you click on a cell in Column B, a calendar picker will pop up in compatible Excel 365 environments. You can select the date the case was updated. This column validates that dates entered fall within the last 31 days.

### Automatic Row Highlighting (Conditional Formatting)
The sheet applies color coding based on Column E (Resolution Status) to help you spot active cases at a glance:
* **Amber / Pale Gold**: Rows where Column E is set to `Follow Up`. These are pending actions.
* **Soft Sage Green**: Rows where Column E is set to `Resolved`. These are closed.
* **White (no highlight)**: Rows where Column E is set to `Clear`. This overrides the red duplicate highlight — use it to acknowledge a reviewed duplicate without deleting the row.

---

## 7. Handling Duplicates (Red Highlighting)

The macro screens all compiled rows and flags duplicate patient entries:
* **Identification**: If the exact same **Encounter Number + Patient Name** combination appears more than once in the data, the entire row is highlighted in **Red**.
* **Reason**: This occurs when a patient has multiple EFC entries (e.g., both a draft financial counselling document and a "Missed FC" row) or duplicate records in EFC exports.
* **Required Staff Action**: 
  1. Inspect the highlighted red rows.
  2. Compare details (such as whether one row has a valid `FC ID` while the other is blank).
  3. **Option A — Delete the redundant row**: Delete the row you do not need (typically the row with a blank FC ID) and keep the active Draft FC record. Save the file.
  4. **Option B — Clear the highlight**: If you want to keep both rows (or simply acknowledge the duplicate without deleting), select `Clear` from the **Resolution Status (Column E)** dropdown on the row you are keeping. The red highlight will turn white immediately.

> [!WARNING]
> The macro does not automatically delete duplicate records to prevent accidental loss of important information. Staff must review the highlighted rows and either delete the redundant row or use `Clear` to dismiss the highlight.

---

## 8. Backlog & Carry-Forward Logic

To save time, the macro compares Encounter Numbers against the previous day's report.

### How Carry-Forward Works:
1. The macro reads the **Previous MFC Report** selected at startup.
2. It identifies all rows in the previous report where **Resolution Status** was **not** `Resolved` (i.e. they were marked as `Follow Up`).
3. If any of those active encounter numbers appear in the new report, the macro automatically copies their values from the previous day's report into the new report for:
   * **Inflight FC Status** (Column A)
   * **Date Updated** (Column B)
   * **Staff Follow Up** (Column C)
   * **Remarks** (Column D)
4. The carried-forward cases are pre-filled with `Follow Up` in Column E and turn **Amber** automatically.

---

## 9. Reading & Updating the Summary Table

At the bottom of the **MFC Report** sheet (exactly three rows below your last patient record), the macro generates an executive summary table:

| Row | Label | Value | Description / Instructions |
|:---:|---|:---:|---|
| **1** | **MFC Report Summary** | — | Table header. |
| **2** | **Total Cases** | *Numeric* | The total count of NCID cases found today. (Calculated automatically) |
| **3** | **Backlog** | *Numeric* | Count of unresolved cases carried over from the previous report. (Calculated automatically) |
| **4** | **To Follow Up on CCF** | *Yellow Cell* | **Manual Entry**. Enter the count of cases currently pending follow-up on CCF. |
| **5** | **Today's Cases** | *Formula* | Shows Today's new cases. Calculated as `Total Cases` minus `Backlog`. (Formula-driven) |
| **6** | **EL Admissions** | *Yellow Cell* | **Manual Entry**. Enter Elective Admissions from the daily email. |

### Summary Table Actions:
* **Yellow Highlighted Cells**: These require manual entry by staff. Select the yellow cells and type in the correct numbers. Hover over the cells to view instruction tooltips.
* **Saving**: After typing these values, press **Ctrl + S** to save the workbook.

---

## 10. Error Messages & Troubleshooting Guide

This section explains the indicators, prompts, and errors you may encounter, grouped by *when* they appear: during file selection (live inside the dashboard), while saving, and during processing.

### 10.1 File Selection Dashboard Indicators

These appear live inside the **File Selection dashboard** as you Browse for files. They are not pop-ups, and most do **not** block you.

| Indicator | Meaning | Action Required |
|---|---|---|
| **○** (grey circle) | Slot is empty — no file selected yet. | Click **Browse...** and choose the file for that slot. |
| **✓ Valid** (green) | The selected file has the expected columns for that slot. | None. |
| **✗ Invalid** (red) | The selected file is missing the mandatory columns for that slot (usually the wrong file). | Click **Browse...** on that slot again and pick the correct export. |
| **✗ Same file** (red, on the second EFC slot) plus **"⚠ Same file selected for both EFC reports!"** | You picked the identical file for both EFC slots. | Re-Browse the **EFC (with Missed FC)** slot and pick the correct file. **Generate Report** stays disabled until the two EFC files differ. |
| **"⚠ Both EFC files have the same row count (N). Verify exports."** | Advisory only. The two EFC files have identical row counts — possibly the same export chosen twice, or there were genuinely no missed FC cases. | Double-check you picked the right two files. If they are correct, you may still click **Generate Report**. |
| **"⚠ Missed FC file has MORE rows than main file. Verify order."** | Advisory only. The "with Missed FC" export should usually contain *more* rows than the "without" export, not fewer. | Verify which file is which; re-Browse a slot to swap if needed. You may still proceed. |

> [!TIP]
> The **Generate Report** button is greyed out until all four slots show **✓ Valid**. If it won't enable, look for a slot still showing **○**, **✗ Invalid**, or **✗ Same file**. Cancelling a Browse dialog simply leaves that slot unchanged — it does not stop the macro.

### 10.2 Save Prompt

| Message | Type | Cause | Action Required |
|---|---|---|---|
| **"Cannot save -- file is open: [File Name]. Close it and click Retry, or click Cancel to save a copy."** | Error (Retry / Cancel) | The output file name matches a file currently open on your PC or locked by another staff member on the K drive. | 1. Close the file (or ask the other staff member to).<br>2. Click **Retry**.<br>3. If it cannot be closed, click **Cancel** — the macro saves an auto-numbered copy (e.g., `MFC ... (1).xlsx`) so you don't lose progress. |

### 10.3 Processing Errors (Macro Stops)

These pop up during steps 2–9 if the source data is missing required columns or yields no rows. The macro stops; fix the cause and rerun.

| Message | Cause | Resolution Action |
|---|---|---|
| **"Error: EFC file is missing the 'FC Status' column. Check your EFC export."** | The merged EFC sheet has no "FC Status" header. | Re-export from eFC without renaming or removing headers. |
| **"Error: EFC file is missing 'Admission Date'. Check your EFC export."** | The EFC sheet has no "Admission Date" column. | Re-export from eFC with the standard columns. |
| **"No active cases found. All rows were filtered out -- check your EFC date range."** | No patients have a Draft FC status or are marked Missed FC = Yes. | Verify your eFC date range and that there are active cases. |
| **"Error: Epic file is missing required columns: [list]. Check your Epic export."** | The Epic Census file is missing CSN / Bed / Admit Status / Patient. | Re-export the Census Snapshot with the columns listed in Section 3 (File 3). |
| **"Error: EFC file is missing columns needed for Epic lookup: [list]"** | The EFC sheet is missing Encounter No or Point Of Care. | Re-export from eFC with the standard columns. |
| **"Error: 'Bed Point Of Care' column missing. The Epic lookup may have failed."** | The Epic bed lookup did not produce its column (usually a wrong/empty Epic file). | Confirm the Epic file is correct and rerun. |
| **"No NCID ward matches found. Check the Epic Census Report date."** | None of the patients are in an NCID ward (based on the Epic bed codes). | Confirm the Epic Census snapshot is for the right date and wards (Section 3). |
| **"Error: Missing columns for duplicate check: [list]"** | The working sheet is missing Encounter No / Patient Name for the duplicate scan. | Do not rename headers; re-export and rerun. |
| **"No data to output -- all rows were filtered out."** | After all filters, no rows remain to build the report. | Normal when there are truly no active NCID cases; otherwise check your date range and ward types. |
| **"Error: Output cannot be built -- missing columns: [list]"** | One or more output columns (e.g., Patient Name, MRN) are missing in the merged data. | Do not rename headers in eFC/Epic; export fresh copies and rerun. |
| **"Config sheet not found. Run 'CreateConfigSheet' first (Alt+F8)."** | The macro workbook has no **Config** sheet to build the dropdowns from. | Run `CreateConfigSheet` (Section 2), then rerun. |
| **"Config sheet lists are empty. Add values under Config tab."** | The **Config** sheet exists but its status/staff lists are blank. | Fill in the Config columns (Section 2), then rerun. |

### 10.4 Non-Blocking Notices

| Message | Meaning |
|---|---|
| **"Previous report missing 'Encounter Number'. All cases treated as new."** | The previous MFC file had no Encounter Number column, so backlog carry-forward was skipped — every case is treated as new (no backlog). The report still generates normally. Double-check you selected the correct previous report if you expected carry-forward. |

---

## 11. Edge Cases & FAQ

### 1. What happens if I swap the EFC files by mistake?
The dashboard validates each file by its columns, so a swapped pair may still both show **✓ Valid** (they are both EFC files). The usual giveaway is the amber advisory warning between the two EFC rows — **"⚠ Missed FC file has MORE rows than main file. Verify order."** Swapping the files causes incorrect merging, so if you suspect a swap, simply click **Browse...** on the affected slot and re-pick the correct file. You do **not** need to restart the macro.

### 2. Can I use a previous day's report that has a different column structure?
Yes. The macro searches for previous column data (like `Remarks` or `Staff Follow Up`) by reading their header names. If the previous file has columns in a different order, the macro will still find and copy them correctly. If a column is completely missing in the old report, the macro will skip it and pre-fill that column with blank cells in the new report.

### 3. What if no beds match the NCID ward filter?
If none of the patients in the EFC files are located in the NCID wards, the macro shows *"No NCID ward matches found. Check the Epic Census Report date."* (or *"No data to output -- all rows were filtered out."*) and stops. This is normal behavior when there are truly no active NCID cases.

### 4. What if the Epic census report has missing bed details (blank/none)?
The macro extracts the ward code from the bed name (character positions 2 to 4). If a bed is marked as `"none"` or is left blank, the macro automatically filters that patient out, as they are not currently assigned to an NCID ward.

### 5. Why are the Inflight Status and Staff Follow Up dropdown lists empty?
This indicates that the **Config** sheet is missing from the macro workbook, or that its columns are empty. Open the macro workbook, run the `CreateConfigSheet` macro to reset it, and fill in the dropdown columns with your statuses and team names.

---

## 12. Downtime Procedures

Use these manual steps if eFC or Epic systems are unavailable.

### Scenario A: eFC is Completely Offline
If the eFC system is offline, you cannot export the EFC files.
1. Open the **Epic Ward Manager** screen.
2. Go ward by ward through the NCID wards (refer to the ward list in Section 3) to manually check the FC completion status of each admitted patient.
   * *Note*: Epic only shows a status of "Completed" or "Acknowledged" if the eFC form was successfully completed before the outage.
3. For pending or in-progress cases, search for the patient's MRN or CSN in the **eFC dashboard** to check status. Complete the FC with the patient. 
4. If you used a downtime paper form or a backup manual module, **manually update** the FC completion status in Epic after the patient's form is uploaded/scanned.

### Scenario B: eFC is Partially Online
If eFC is online but running slowly or displaying partial data:
1. Export the **Inflight Financial Counselling Report** but **leave the Admission Type field blank**.
2. Set the date range up to 1 month and click submit.
3. Once downloaded, open the Excel sheet and manually filter the `Admission Type` column to keep only `EM` (Emergency) and `EL` (Elective) admissions.
4. Run the macro using this combined file.
5. To capture patients who missed financial counselling (patients without an FC ID):
   * Go to the **eFC Dashboard search utility**.
   * Filter by Admission Type (`Emergency` or `Elective`).
   * Set the Admission Date range.
   * Set **Admission Status = Actualised** (which is pulled from Epic).
   * Export the results to Excel.
   * Filter the sheet to show only rows where `FC ID` is blank. These represent the missed cases requiring manual follow-up.

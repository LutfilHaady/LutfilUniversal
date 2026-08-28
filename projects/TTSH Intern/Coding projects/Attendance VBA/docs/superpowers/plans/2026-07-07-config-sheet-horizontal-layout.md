# Config Sheet Horizontal Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `tblVerification` and `tblRosterCodes` (the two Config-sheet tables meant to be edited/extended over time) each their own column, with nothing else ever placed below them, so they can grow to any number of rows without colliding with the Colour Legend or any other section — replacing today's single-column stacked layout where `tblVerification` sits only 2 rows above the Colour Legend.

**Architecture:** Purely a spreadsheet layout change to `Attendance_Analyzer.xlsx`'s Config sheet, done via Excel COM automation (PowerShell). `Helpers.LoadConfig`/`LoadRoster` locate these tables by name (`ListObjects("tblVerification")`, etc.), not position, so **no VBA source changes are required or permitted** in this plan.

**Tech Stack:** Excel VBA workbook, no package manager, no headless test runner (`CLAUDE.md`). This plan's edits use only the standard Excel Application/Workbook/Worksheet COM object model (`Workbooks.Open`, `ListObjects`, `Cells.Item`) — no `Application.VBE`/`VBProject` access, so it does not require the `AccessVBOM` trust setting, and every task is independently, automatically verifiable by reopening the file read-only afterward.

## Global Constraints

- No `.bas` file may be touched by this plan — `LoadConfig`/`LoadRoster` already resolve `tblSchedule`/`tblVerification`/`tblRosterCodes` by name, so relocating them on the sheet requires zero code changes.
- `tblSchedule` (columns A-E, rows 5-27) is out of scope and must not move.
- Preserve each section's existing font styling (bold/size) exactly when relocating it — this is a layout-only change, not a restyle.
- `tblVerification` and `tblRosterCodes` must end up with nothing else on the sheet below them in their own column, ever.
- This plan can be done in either order relative to `2026-07-07-roster-per-unit-tables.md` — both plans append to the Instructions sheet using a dynamic "insert after current content" approach specifically so neither depends on the other having run first.

---

### Task 1: Move `tblVerification` to column G

**Files:**
- Modify: `Attendance_Analyzer.xlsx` (`Config` sheet)

**Interfaces:**
- Consumes: none
- Produces: `tblVerification` relocated to `$G$6:$G$20` (header row 6, 14 data rows), section title at `G5`. Table name, column name (`Option`), and all 14 values are unchanged — only position moves. `Helpers.LoadConfig` (unmodified) continues to find it by name.

**Context:** current state (confirmed via direct inspection): title `"VERIFICATION OPTIONS (for 'NO PUNCH - VERIFY' days)"` at `A30` (bold, size 12), table header `"Option"` at `A31`, 14 data rows at `A32:A45` (`Approved Leave`, `MC (Medical Certificate)`, `Off-Roster Change`, `Genuine Absence`, `Forgot to Punch (Whole Day)`, `Other - see notes`, `AL`, `MC`, `OIL`, `FCL`, `PH`, `SLWOMC`, `UL`, `BL`).

- [ ] **Step 1: Run the relocation script**

```powershell
$path = Join-Path (Get-Location) "Attendance_Analyzer.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path)
$cfgWs = $wb.Sheets.Item("Config")

# Capture tblVerification's current data before touching anything
$vtbl = $cfgWs.ListObjects.Item("tblVerification")
$verifyRows = @()
for ($r = 1; $r -le $vtbl.ListRows.Count; $r++) {
    $verifyRows += $vtbl.DataBodyRange($r, 1).Value2
}

# Delete the old table and clear its old cells (title + header + data)
$vtbl.Delete()
$cfgWs.Range("A30:A45").Clear()

# Write the section title, table header, and data into column G starting row 5
$cfgWs.Cells.Item(5, 7).Value2 = "VERIFICATION OPTIONS (for 'NO PUNCH - VERIFY' days)"
$cfgWs.Cells.Item(5, 7).Font.Bold = $true
$cfgWs.Cells.Item(5, 7).Font.Size = 12
$cfgWs.Cells.Item(6, 7).Value2 = "Option"
for ($i = 0; $i -lt $verifyRows.Count; $i++) {
    $cfgWs.Cells.Item(7 + $i, 7).Value2 = $verifyRows[$i]
}

# Re-create the table at its new location
$newRange = $cfgWs.Range($cfgWs.Cells.Item(6, 7), $cfgWs.Cells.Item(6 + $verifyRows.Count, 7))
$newTbl = $cfgWs.ListObjects.Add(1, $newRange, $null, 1)
$newTbl.Name = "tblVerification"

$wb.Save()
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "Done"
```

- [ ] **Step 2: Verify the relocation**

```powershell
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path, $true, $true)
$cfgWs = $wb.Sheets.Item("Config")

$tbl = $cfgWs.ListObjects.Item("tblVerification")
Write-Output "ref: $($tbl.Range.Address())"
Write-Output "row count: $($tbl.ListRows.Count)"
for ($r = 1; $r -le $tbl.ListRows.Count; $r++) { Write-Output ("  " + $tbl.DataBodyRange($r,1).Text) }
Write-Output "G5 title: '$($cfgWs.Cells.Item(5,7).Value2)'"
Write-Output "old A30 (should be blank): '$($cfgWs.Cells.Item(30,1).Value2)'"
Write-Output "old A45 (should be blank): '$($cfgWs.Cells.Item(45,1).Value2)'"

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
```

Expected output:
```
ref: $G$6:$G$20
row count: 14
  Approved Leave
  MC (Medical Certificate)
  Off-Roster Change
  Genuine Absence
  Forgot to Punch (Whole Day)
  Other - see notes
  AL
  MC
  OIL
  FCL
  PH
  SLWOMC
  UL
  BL
G5 title: 'VERIFICATION OPTIONS (for 'NO PUNCH - VERIFY' days)'
old A30 (should be blank): ''
old A45 (should be blank): ''
```

- [ ] **Step 3: Commit**

```bash
git add Attendance_Analyzer.xlsx
git commit -m "refactor: move tblVerification to its own column for unlimited growth"
```

---

### Task 2: Move `tblRosterCodes` to column I

**Files:**
- Modify: `Attendance_Analyzer.xlsx` (`Config` sheet)

**Interfaces:**
- Consumes: none
- Produces: `tblRosterCodes` relocated to `$I$6:$I$14` (header row 6, 8 data rows), section title at `I5`. `Helpers.LoadRoster` (unmodified) continues to find it by name.

**Context:** current state: title `"RECOGNIZED ROSTER LEAVE CODES (auto-fills Verification from the Roster sheet)"` at `A54` (bold, size 11), table header `"Code"` at `A55`, 8 data rows at `A56:A63` (`AL, MC, OIL, FCL, PH, SLWOMC, UL, BL`).

- [ ] **Step 1: Run the relocation script**

```powershell
$path = Join-Path (Get-Location) "Attendance_Analyzer.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path)
$cfgWs = $wb.Sheets.Item("Config")

$rtbl = $cfgWs.ListObjects.Item("tblRosterCodes")
$codeRows = @()
for ($r = 1; $r -le $rtbl.ListRows.Count; $r++) {
    $codeRows += $rtbl.DataBodyRange($r, 1).Value2
}

$rtbl.Delete()
$cfgWs.Range("A54:A63").Clear()

$cfgWs.Cells.Item(5, 9).Value2 = "RECOGNIZED ROSTER LEAVE CODES (auto-fills Verification from the Roster sheet)"
$cfgWs.Cells.Item(5, 9).Font.Bold = $true
$cfgWs.Cells.Item(5, 9).Font.Size = 11
$cfgWs.Cells.Item(6, 9).Value2 = "Code"
for ($i = 0; $i -lt $codeRows.Count; $i++) {
    $cfgWs.Cells.Item(7 + $i, 9).Value2 = $codeRows[$i]
}

$newRange = $cfgWs.Range($cfgWs.Cells.Item(6, 9), $cfgWs.Cells.Item(6 + $codeRows.Count, 9))
$newTbl = $cfgWs.ListObjects.Add(1, $newRange, $null, 1)
$newTbl.Name = "tblRosterCodes"

$wb.Save()
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "Done"
```

- [ ] **Step 2: Verify the relocation**

```powershell
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path, $true, $true)
$cfgWs = $wb.Sheets.Item("Config")

$tbl = $cfgWs.ListObjects.Item("tblRosterCodes")
Write-Output "ref: $($tbl.Range.Address())"
Write-Output "row count: $($tbl.ListRows.Count)"
for ($r = 1; $r -le $tbl.ListRows.Count; $r++) { Write-Output ("  " + $tbl.DataBodyRange($r,1).Text) }
Write-Output "old A54 (should be blank): '$($cfgWs.Cells.Item(54,1).Value2)'"
Write-Output "old A63 (should be blank): '$($cfgWs.Cells.Item(63,1).Value2)'"

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
```

Expected output:
```
ref: $I$6:$I$14
row count: 8
  AL
  MC
  OIL
  FCL
  PH
  SLWOMC
  UL
  BL
old A54 (should be blank): ''
old A63 (should be blank): ''
```

- [ ] **Step 3: Commit**

```bash
git add Attendance_Analyzer.xlsx
git commit -m "refactor: move tblRosterCodes to its own column for unlimited growth"
```

---

### Task 3: Move Colour Legend to columns K/L and set new column widths

**Files:**
- Modify: `Attendance_Analyzer.xlsx` (`Config` sheet)

**Interfaces:**
- Consumes: none
- Produces: Colour Legend title at `K5`, 4 label/swatch rows at `K7:K10`/`L7:L10`. Purely cosmetic — nothing in `Helpers.bas`/`ReportBuilder.bas` reads these cells.

**Context:** current state: title `"COLOUR LEGEND (applied automatically by the macro)"` at `A48` (bold, size 12), 4 labels at `A49:A52` (size 10), with matching colour swatches at `B49:B52` (fixed in a prior session — previously misplaced at `B41:B44`).

- [ ] **Step 1: Run the relocation script**

```powershell
$path = Join-Path (Get-Location) "Attendance_Analyzer.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path)
$cfgWs = $wb.Sheets.Item("Config")

$legendLabels = @()
$legendColors = @()
for ($r = 49; $r -le 52; $r++) {
    $legendLabels += $cfgWs.Cells.Item($r, 1).Value2
    $legendColors += $cfgWs.Cells.Item($r, 2).Interior.Color
}

$cfgWs.Range("A48:B52").Clear()

$cfgWs.Cells.Item(5, 11).Value2 = "COLOUR LEGEND (applied automatically by the macro)"
$cfgWs.Cells.Item(5, 11).Font.Bold = $true
$cfgWs.Cells.Item(5, 11).Font.Size = 12

for ($i = 0; $i -lt $legendLabels.Count; $i++) {
    $row = 7 + $i
    $cfgWs.Cells.Item($row, 11).Value2 = $legendLabels[$i]
    $cfgWs.Cells.Item($row, 11).Font.Size = 10
    $cfgWs.Cells.Item($row, 12).Interior.Color = $legendColors[$i]
}

# Column widths for the new blocks, matching the existing A(30)/B(14) convention
$cfgWs.Columns.Item(7).ColumnWidth = 30    # G - Verification Options
$cfgWs.Columns.Item(9).ColumnWidth = 30    # I - Roster Leave Codes
$cfgWs.Columns.Item(11).ColumnWidth = 30   # K - Colour Legend labels
$cfgWs.Columns.Item(12).ColumnWidth = 14   # L - Colour Legend swatches

$wb.Save()
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "Done"
```

- [ ] **Step 2: Verify the relocation**

```powershell
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path, $true, $true)
$cfgWs = $wb.Sheets.Item("Config")

Write-Output "K5 title: '$($cfgWs.Cells.Item(5,11).Value2)'"
for ($r = 7; $r -le 10; $r++) {
    Write-Output "K$r : '$($cfgWs.Cells.Item($r,11).Value2)'  L$r color: $($cfgWs.Cells.Item($r,12).Interior.Color)"
}
Write-Output "old A48 (should be blank): '$($cfgWs.Cells.Item(48,1).Value2)'"
Write-Output "old B49 (should be blank): '$($cfgWs.Cells.Item(49,2).Value2)'"
Write-Output "G column width: $($cfgWs.Columns.Item(7).ColumnWidth)"
Write-Output "L column width: $($cfgWs.Columns.Item(12).ColumnWidth)"

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
```

Expected output (four distinct, non-zero color numbers for K7:K10 — exact values depend on the swatch colors already set in `ReportBuilder.ApplyRowColor`, but must be non-blank and different from each other):
```
K5 title: 'COLOUR LEGEND (applied automatically by the macro)'
K7 : 'On Time / Within Grace (amber)'  L7 color: <non-zero>
K8 : 'Late / Missing punch (light red)'  L8 color: <non-zero>
K9 : 'No Punch - Verify (purple)'  L9 color: <non-zero>
K10 : 'Unrecognized format (red - check raw file)'  L10 color: <non-zero>
old A48 (should be blank): ''
old B49 (should be blank): ''
G column width: 30
L column width: 14
```

- [ ] **Step 3: Commit**

```bash
git add Attendance_Analyzer.xlsx
git commit -m "refactor: move Colour Legend to its own column, set new column widths"
```

---

### Task 4: Instructions sheet — document how to extend the two tables

**Files:**
- Modify: `Attendance_Analyzer.xlsx` (`Instructions` sheet)

**Interfaces:**
- Consumes: none
- Produces: two new documented steps, appended after whatever the sheet's current last row is (order-independent of `2026-07-07-roster-per-unit-tables.md`, which inserts inside the existing content rather than appending).

- [ ] **Step 1: Append the two new sections**

```powershell
$path = Join-Path (Get-Location) "Attendance_Analyzer.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path)
$instWs = $wb.Sheets.Item("Instructions")

$lastRow = $instWs.UsedRange.Row + $instWs.UsedRange.Rows.Count - 1

$r1 = $lastRow + 2
$instWs.Cells.Item($r1, 1).Value2 = "Adding a new verification option"
$instWs.Cells.Item($r1 + 1, 1).Value2 = "1."
$instWs.Cells.Item($r1 + 1, 2).Value2 = "Go to the Config sheet > tblVerification table (column G). Type the new option in the row below the last one -- the table expands automatically, no code changes needed."

$r2 = $r1 + 3
$instWs.Cells.Item($r2, 1).Value2 = "Adding a new roster leave code"
$instWs.Cells.Item($r2 + 1, 1).Value2 = "1."
$instWs.Cells.Item($r2 + 1, 2).Value2 = "Go to the Config sheet > tblRosterCodes table (column I). Type the new code in the row below the last one -- the table expands automatically. tblRosterCodes and tblVerification are kept in sync by content, not formula -- add the same code to tblVerification (column G) too if you also want it selectable in the Verification dropdown."

$wb.Save()
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "Done: sections written at rows $r1 and $r2"
```

- [ ] **Step 2: Verify**

```powershell
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($path, $true, $true)
$instWs = $wb.Sheets.Item("Instructions")
$lastRow = $instWs.UsedRange.Row + $instWs.UsedRange.Rows.Count - 1
for ($r = $lastRow - 6; $r -le $lastRow; $r++) {
    Write-Output "$r : '$($instWs.Cells.Item($r,1).Value2)' | '$($instWs.Cells.Item($r,2).Value2)'"
}
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
```

Expected: the last rows show the "Adding a new verification option" and "Adding a new roster leave code" sections, each with a "1." step, in that order, with one blank row separating each section (matching the sheet's existing section-spacing convention).

- [ ] **Step 3: Commit**

```bash
git add Attendance_Analyzer.xlsx
git commit -m "docs: document how to extend tblVerification and tblRosterCodes"
```

---

### Task 5: Documentation — update the context doc

**Files:**
- Modify: `Attendance_Analyzer_Context.md`

**Interfaces:** none (docs only)

- [ ] **Step 1: Add a Config sheet layout note**

In the "Files in this delivery" section, find this line (currently line 14-15):

```markdown
- `Attendance_Analyzer.xlsx` — template workbook. Has `Config` sheet (Excel Table `tblSchedule`,
  Excel Table `tblVerification`, named range `GracePeriod` = Config!B3) and an `Instructions` sheet.
```

Replace with:

```markdown
- `Attendance_Analyzer.xlsx` — template workbook. Has a `Config` sheet, an `Instructions`
  sheet, and a `Roster` sheet. As of 2026-07-07, the Config sheet is laid out in four
  side-by-side column-blocks, each free to grow straight down with nothing below it:
  Department Schedule (`tblSchedule`, columns A-E), Verification Options
  (`tblVerification`, column G), Recognized Roster Leave Codes (`tblRosterCodes`, column
  I), and a fixed-size Colour Legend (columns K/L) — see
  `docs/superpowers/specs/2026-07-07-config-sheet-horizontal-layout-design.md`. Named
  ranges `GracePeriod` (Config!B3) and `HoursUnit` (Config!B4) are unaffected by this
  layout.
```

- [ ] **Step 2: Commit**

```bash
git add Attendance_Analyzer_Context.md
git commit -m "docs: document the Config sheet's horizontal column-block layout"
```

---

## Self-Review Notes

- **Spec coverage:** four column-blocks starting row 5 (Tasks 1-3) ✓; `tblVerification`/`tblRosterCodes` unlimited downward growth (Tasks 1-2, nothing placed below them) ✓; Colour Legend relocation preserving swatch colors (Task 3) ✓; column widths (Task 3) ✓; Instructions sheet documentation (Task 4) ✓; context doc update (Task 5) ✓; no VBA changes (Global Constraints, and no task touches a `.bas` file) ✓.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable PowerShell.
- **Type consistency:** table names (`tblVerification`, `tblRosterCodes`) and column letters (G=7, I=9, K=11, L=12) are used identically across all three relocation tasks.
- **Verification approach:** fully automated — every task reopens the file read-only via COM and asserts the new state, since this plan makes no VBA changes and therefore isn't subject to the `AccessVBOM`-disabled limitation that constrains VBA-editing plans in this repo.

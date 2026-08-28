# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 issues identified during code review -- a silent data-loss bug, single-row crashes, control-flow inconsistencies, and cosmetic mismatches.

**Architecture:** VBA macro codebase with dual-source maintenance. Every `.bas` file change must be mirrored exactly in `MFC_All_Modules.txt`. No test runner exists -- verification is via grep for consistency and asking the user to compile in Excel.

**Tech Stack:** Excel VBA (no build system, no CLI execution)

## Global Constraints

- Every code change MUST be applied to BOTH the `.bas` file AND the matching section of `MFC_All_Modules.txt`.
- After editing, grep the changed lines in both files to confirm sync.
- Keep `MFC_All_Modules.txt` in clean ASCII -- use `--` for dashes, never smart quotes.
- No `IIf()` with array access (VBA `IIf` is not short-circuit).
- Use `FindColByHeader(ws, "Header Name")` to resolve columns, never hardcoded indices.
- Use `Encounter No` for `lastRow` -- FC ID is blank in Missed FC rows.

---

### Task 1: Fix CombineEFC lastRow using Encounter No instead of column A

The most critical bug. `CombineEFCFiles` uses `ws.Cells(ws.Rows.Count, 1).End(xlUp).Row` for both the main and missed-FC worksheets. Column 1 is FC ID, which is documented as blank in the missed-FC file. This means `lastRowMissed` could return row 1, silently skipping all missed FC rows.

**Files:**
- Modify: `CombineEFC.bas:6-26`
- Modify: `MFC_All_Modules.txt:771-791` (CombineEFC section)

**Interfaces:**
- Consumes: `FindColByHeader(ws, headerName)` from `Helpers.bas` -- returns 1-based column index or 0
- Produces: No interface change -- `CombineEFCFiles(wsMainEFC, wsMissedEFC)` signature unchanged

- [ ] **Step 1: Edit `CombineEFC.bas` -- resolve Encounter No by header, use it for lastRow**

Replace the body of `CombineEFCFiles` with header-based column lookups:

```vba
Sub CombineEFCFiles(wsMainEFC As Worksheet, wsMissedEFC As Worksheet)

    Dim lastRowMain As Long
    Dim lastRowMissed As Long

    ' Use Encounter No for lastRow -- FC ID (col 1) is blank in missed FC rows
    Dim encColMain As Long
    encColMain = FindColByHeader(wsMainEFC, "Encounter No")
    If encColMain > 0 Then
        lastRowMain = wsMainEFC.Cells(wsMainEFC.Rows.Count, encColMain).End(xlUp).Row
    Else
        lastRowMain = wsMainEFC.Cells(wsMainEFC.Rows.Count, 1).End(xlUp).Row
    End If

    Dim encColMissed As Long
    encColMissed = FindColByHeader(wsMissedEFC, "Encounter No")
    If encColMissed > 0 Then
        lastRowMissed = wsMissedEFC.Cells(wsMissedEFC.Rows.Count, encColMissed).End(xlUp).Row
    Else
        lastRowMissed = wsMissedEFC.Cells(wsMissedEFC.Rows.Count, 1).End(xlUp).Row
    End If
    If lastRowMissed < 2 Then Exit Sub  ' Missed FC file has no data rows -- nothing to append

    Dim lastColMissed As Long
    lastColMissed = wsMissedEFC.Cells(1, wsMissedEFC.Columns.Count).End(xlToLeft).Column

    Dim srcData As Variant
    srcData = wsMissedEFC.Range(wsMissedEFC.Cells(2, 1), wsMissedEFC.Cells(lastRowMissed, lastColMissed)).Value

    Dim missedRows As Long
    missedRows = lastRowMissed - 1
    wsMainEFC.Range(wsMainEFC.Cells(lastRowMain + 1, 1), _
        wsMainEFC.Cells(lastRowMain + missedRows, lastColMissed)).Value = srcData

End Sub
```

- [ ] **Step 2: Mirror the same change in `MFC_All_Modules.txt`**

The CombineEFC module starts at line 766. Apply the identical replacement to lines 771-791 (the sub body). The new body is longer (adds `encColMain`/`encColMissed` variables), so line numbers after this point shift.

- [ ] **Step 3: Verify sync between both files**

Run: `grep -n "encColMain\|encColMissed\|Encounter No" CombineEFC.bas MFC_All_Modules.txt`

Expected: matching lines appear in both files with the same content.

- [ ] **Step 4: Commit**

```bash
git add CombineEFC.bas MFC_All_Modules.txt
git commit -m "fix: CombineEFC uses Encounter No for lastRow instead of col A (FC ID)

FC ID is blank in missed-FC rows, so End(xlUp) on col 1 could silently
skip all missed FC data. Now resolves Encounter No by header, matching
the convention used in every other module.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add scalar guards for single-row .Value reads

When a VBA range is exactly one cell, `.Value` returns a scalar (not a 2-D array). Code that then calls `UBound(arr, 1)` crashes with runtime error 13. Four locations need guarding:

1. `FlagDuplicates.bas:46-47` -- `encData` and `nameData`
2. `FilterWard.bas:161-162` (inside `TagNCIDRows`) -- `bedData` and `resData`
3. `Backlog.bas:42` (inside `BacklogSummary`) -- `outEncData`

The pattern already exists in `ConfigReader.bas:50-58` (`ReadConfigList`). The fix for each: check `If lastRow = 2 Then` (single data row) and handle it inline.

**Files:**
- Modify: `FlagDuplicates.bas:37-48`
- Modify: `FilterWard.bas:155-162` (TagNCIDRows)
- Modify: `Backlog.bas:39-42` (BacklogSummary)
- Modify: `MFC_All_Modules.txt` at corresponding line ranges

**Interfaces:**
- No interface changes -- all fixes are internal to existing subs

- [ ] **Step 1: Fix `FlagDuplicateRows` in `FlagDuplicates.bas`**

After `If lastRow < 2 Then Exit Sub`, add a single-row guard. Replace the `.Value` reads (lines 46-47) with:

```vba
    ' Guard: single-cell .Value returns a scalar, not a 2-D array
    Dim encData  As Variant
    Dim nameData As Variant
    If lastRow = 2 Then
        ReDim encData(1 To 1, 1 To 1)
        ReDim nameData(1 To 1, 1 To 1)
        encData(1, 1) = ws.Cells(2, encCol).Value
        nameData(1, 1) = ws.Cells(2, nameCol).Value
    Else
        encData  = ws.Range(ws.Cells(2, encCol),  ws.Cells(lastRow, encCol)).Value
        nameData = ws.Range(ws.Cells(2, nameCol), ws.Cells(lastRow, nameCol)).Value
    End If
```

This replaces lines 46-47 (the two `Dim` + assignment lines). The rest of the sub (keyCounts loop, dupRange loop, formatting) works unchanged because the array shape is the same.

- [ ] **Step 2: Fix `TagNCIDRows` in `FilterWard.bas`**

Replace lines 159-162 (the `bedData`/`resData` reads) with:

```vba
    Dim bedData As Variant
    Dim resData As Variant
    If lastRow = 2 Then
        ReDim bedData(1 To 1, 1 To 1)
        ReDim resData(1 To 1, 1 To 1)
        bedData(1, 1) = outWs.Cells(2, bedCol).Value
        resData(1, 1) = outWs.Cells(2, resCol).Value
    Else
        bedData = outWs.Range(outWs.Cells(2, bedCol), outWs.Cells(lastRow, bedCol)).Value
        resData = outWs.Range(outWs.Cells(2, resCol), outWs.Cells(lastRow, resCol)).Value
    End If
```

- [ ] **Step 3: Fix `BacklogSummary` in `Backlog.bas`**

Replace lines 41-42 (the `outLastRow` and `outEncData` reads) with:

```vba
    Dim outLastRow As Long
    outLastRow = outWs.Cells(outWs.Rows.Count, encCol).End(xlUp).Row
    Dim outEncData As Variant
    If outLastRow = 2 Then
        ReDim outEncData(1 To 1, 1 To 1)
        outEncData(1, 1) = outWs.Cells(2, encCol).Value
    Else
        outEncData = outWs.Range(outWs.Cells(2, encCol), outWs.Cells(outLastRow, encCol)).Value
    End If
```

Note: `ENC_COL` is being replaced with `encCol` (from Task 3 below). If implementing in order, use the variable name that will exist after Task 3. If implementing this task standalone before Task 3, use `ENC_COL` here and it will be renamed in Task 3.

- [ ] **Step 4: Mirror all three changes in `MFC_All_Modules.txt`**

Apply the identical edits to:
- FlagDuplicates section (starts at line 1473): the `encData`/`nameData` reads around lines 1516-1519
- TagNCIDRows section (starts at line 1416): the `bedData`/`resData` reads around lines 1447-1450
- Backlog section (starts at line 1912): the `outLastRow`/`outEncData` reads around lines 1950-1953

- [ ] **Step 5: Verify sync**

Run: `grep -n "If lastRow = 2 Then" FlagDuplicates.bas FilterWard.bas Backlog.bas MFC_All_Modules.txt`

Expected: 3 matches in `.bas` files, 3 matches in `MFC_All_Modules.txt`, same surrounding context.

- [ ] **Step 6: Commit**

```bash
git add FlagDuplicates.bas FilterWard.bas Backlog.bas MFC_All_Modules.txt
git commit -m "fix: guard single-row .Value reads against scalar return

When a range is one cell, .Value returns a scalar instead of a 2-D array,
causing UBound() to crash. Added If lastRow = 2 guards in FlagDuplicateRows,
TagNCIDRows, and BacklogSummary following the pattern from ReadConfigList.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Add Exit Sub before Cleanup label in MainMacro

The success path falls through into `Cleanup:`, which re-closes workbooks on stale `Nothing` references. Harmless (wrapped in `On Error Resume Next`) but untidy.

**Files:**
- Modify: `MainMacro.bas:134`
- Modify: `MFC_All_Modules.txt:134`

- [ ] **Step 1: Add `Exit Sub` before `Cleanup:` in `MainMacro.bas`**

Insert after the `MsgBox` block (after line 133) and before `Cleanup:` (line 135):

```vba
    Exit Sub

Cleanup:
```

- [ ] **Step 2: Mirror in `MFC_All_Modules.txt`**

Insert the same `Exit Sub` line before the `Cleanup:` label at line 135 of `MFC_All_Modules.txt`.

- [ ] **Step 3: Commit**

```bash
git add MainMacro.bas MFC_All_Modules.txt
git commit -m "fix: add Exit Sub before Cleanup to prevent double-close on success

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Resolve Encounter Number by header in Backlog.bas

`BacklogSummary` hardcodes `Const ENC_COL As Long = 7` while resolving `resCol` by header right next to it. Replace with header-based lookup for consistency.

**Files:**
- Modify: `Backlog.bas:20-21, 40-42, 52`
- Modify: `MFC_All_Modules.txt:1931-1932, 1950-1953, 1963`

- [ ] **Step 1: Replace `ENC_COL` constant with header-based lookup in `Backlog.bas`**

Replace lines 20-21:
```vba
    Const ENC_COL As Long = 7   ' Col G -- Encounter Number in output
    Const RES_COL As Long = 5   ' Col E -- Case Status in output
```

With:
```vba
    Const RES_COL As Long = 5   ' Col E -- Case Status fallback

    Dim hdr() As String
    hdr = GetOutputHeaders()

    Dim encCol As Long
    encCol = FindColByHeader(outWs, hdr(7))
    If encCol = 0 Then encCol = FindColByHeader(outWs, "Encounter Number")
    If encCol = 0 Then encCol = 7
```

Then remove the duplicate `Dim hdr() As String` and `hdr = GetOutputHeaders()` lines that were previously at lines 28-29 (they're now covered by the block above).

Replace all remaining references to `ENC_COL` with `encCol`:
- Line 40: `outLastRow = outWs.Cells(outWs.Rows.Count, ENC_COL)` → `outWs.Cells(outWs.Rows.Count, encCol)`
- Line 42: `outEncData = outWs.Range(outWs.Cells(2, ENC_COL), outWs.Cells(outLastRow, ENC_COL))` → use `encCol`
- Line 52: `outWs.Cells(outLastRow, 15)` stays (15 is the output column count, not an encounter column reference)

- [ ] **Step 2: Mirror in `MFC_All_Modules.txt`**

Apply the identical changes to the Backlog section starting at line 1912.

- [ ] **Step 3: Verify no remaining ENC_COL references**

Run: `grep -n "ENC_COL" Backlog.bas MFC_All_Modules.txt`

Expected: No matches.

- [ ] **Step 4: Commit**

```bash
git add Backlog.bas MFC_All_Modules.txt
git commit -m "refactor: resolve Encounter Number by header in BacklogSummary

Replaces hardcoded ENC_COL = 7 with FindColByHeader lookup, consistent
with how resCol and all other modules resolve column positions.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Re-resolve efcEncNoCol after column insert in EpicLookup

`EpicLookup.bas` resolves `efcEncNoCol` before inserting the "Final Bed" column. It then uses `efcEncNoCol` to index `efcData` (read after the insert). This works only because Encounter No is left of Point Of Care. Make it robust by re-resolving after the insert.

**Files:**
- Modify: `EpicLookup.bas:100-104`
- Modify: `MFC_All_Modules.txt:1145-1159`

- [ ] **Step 1: Add re-resolve after the column insert in `EpicLookup.bas`**

After line 70 (`wsMainEFC.Cells(1, bedInsertCol).Value = "Final Bed"`), add:

```vba
    ' Re-resolve Encounter No after insert -- column may have shifted right
    efcEncNoCol = FindColByHeader(wsMainEFC, "Encounter No")
```

And remove the comment at line 102 that says `efcEncNoCol is before the insert position so its index in efcData is unchanged` (line 157 in the original: `' efcEncNoCol is before the insert position so its index in efcData is unchanged.`).

- [ ] **Step 2: Mirror in `MFC_All_Modules.txt`**

Add the same re-resolve line after the `wsMainEFC.Cells(1, bedInsertCol).Value = "Final Bed"` line (around line 1124 in MFC_All_Modules.txt), and remove the stale comment around line 1157.

- [ ] **Step 3: Commit**

```bash
git add EpicLookup.bas MFC_All_Modules.txt
git commit -m "fix: re-resolve efcEncNoCol after Final Bed column insert

The column index could shift if Encounter No is to the right of Point Of
Care in a future EFC export. Re-resolving by header after the insert makes
the lookup robust regardless of source column order.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Fix module name attributes to match filenames

Three `.bas` files have `Attribute VB_Name` values that don't match their filenames:
- `FilterFCStatus.bas` → `"FCStatusFilter"` (should be `"FilterFCStatus"`)
- `FilterWard.bas` → `"WardFilter"` (should be `"FilterWard"`)
- `FilterDischarge.bas` → `"DischargeFilter"` (should be `"FilterDischarge"`)

**Files:**
- Modify: `FilterFCStatus.bas:1`
- Modify: `FilterWard.bas:1`
- Modify: `FilterDischarge.bas:1`
- Modify: `MFC_All_Modules.txt` lines 918, 1289, 1175

- [ ] **Step 1: Fix all three `.bas` files**

`FilterFCStatus.bas` line 1:
```
Attribute VB_Name = "FilterFCStatus"
```

`FilterWard.bas` line 1:
```
Attribute VB_Name = "FilterWard"
```

`FilterDischarge.bas` line 1:
```
Attribute VB_Name = "FilterDischarge"
```

- [ ] **Step 2: Mirror in `MFC_All_Modules.txt`**

- Line 918: `Attribute VB_Name = "FCStatusFilter"` → `"FilterFCStatus"`
- Line 1175: `Attribute VB_Name = "DischargeFilter"` → `"FilterDischarge"`
- Line 1289: `Attribute VB_Name = "WardFilter"` → `"FilterWard"`

- [ ] **Step 3: Verify no old names remain**

Run: `grep -n "FCStatusFilter\|WardFilter\|DischargeFilter" *.bas MFC_All_Modules.txt`

Expected: No matches.

- [ ] **Step 4: Commit**

```bash
git add FilterFCStatus.bas FilterWard.bas FilterDischarge.bas MFC_All_Modules.txt
git commit -m "fix: align VB_Name attributes with filenames for 3 filter modules

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Handle Config upgrade path for NumberFormat fix

The `NumberFormat = "@"` fix (from the earlier session) only runs when `CreateConfigSheet` writes new values. Users who already have a Config sheet with the new columns see "already up to date" and get no fix. The upgrade path should apply `NumberFormat = "@"` to the color cells even when no structural upgrade is needed.

**Files:**
- Modify: `Helpers.bas:106-109`
- Modify: `MFC_All_Modules.txt` (corresponding Helpers section)

- [ ] **Step 1: Add NumberFormat fix to the "already up to date" branch in `Helpers.bas`**

Replace lines 106-109:
```vba
    If Not isNew And hasNewCols Then
        MsgBox "Config sheet is already up to date." & vbNewLine & _
               "Edit it directly to customize the macro.", vbInformation, "Config"
        Exit Sub
    End If
```

With:
```vba
    If Not isNew And hasNewCols Then
        ' Ensure color cells are text-formatted (fixes Excel auto-interpreting RGB strings)
        Dim colorCol As Long
        colorCol = FindColByHeader(ws, "Case Status Color")
        If colorCol > 0 Then
            Dim colorLastRow As Long
            colorLastRow = ws.Cells(ws.Rows.Count, colorCol).End(xlUp).Row
            If colorLastRow >= 2 Then ws.Range(ws.Cells(2, colorCol), ws.Cells(colorLastRow, colorCol)).NumberFormat = "@"
        End If
        Dim settingsCol As Long
        settingsCol = FindColByHeader(ws, "Settings")
        If settingsCol > 0 Then
            Dim settingsValCol As Long
            settingsValCol = settingsCol + 1
            ws.Range(ws.Cells(6, settingsValCol), ws.Cells(9, settingsValCol)).NumberFormat = "@"
        End If
        MsgBox "Config sheet is already up to date." & vbNewLine & _
               "Edit it directly to customize the macro.", vbInformation, "Config"
        Exit Sub
    End If
```

- [ ] **Step 2: Mirror in `MFC_All_Modules.txt`**

Apply the identical replacement to the Helpers section of `MFC_All_Modules.txt` (the matching `If Not isNew And hasNewCols Then` block).

- [ ] **Step 3: Verify sync**

Run: `grep -n "Ensure color cells" Helpers.bas MFC_All_Modules.txt`

Expected: one match in each file.

- [ ] **Step 4: Commit**

```bash
git add Helpers.bas MFC_All_Modules.txt
git commit -m "fix: apply NumberFormat text fix to existing Config sheets on upgrade

Users who already have Config sheets would not get the RGB text formatting
fix. Now CreateConfigSheet applies NumberFormat=\"@\" to color cells even
when the sheet structure is already up to date.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full sync check between `.bas` files and `MFC_All_Modules.txt`**

For each module that was modified, extract the module section from `MFC_All_Modules.txt` and diff against the `.bas` file content (ignoring the `Attribute VB_Name` line which is at the boundary). Modules to check:
- `CombineEFC.bas`
- `FlagDuplicates.bas`
- `FilterWard.bas`
- `Backlog.bas`
- `MainMacro.bas`
- `EpicLookup.bas`
- `FilterFCStatus.bas`
- `FilterDischarge.bas`
- `Helpers.bas`

- [ ] **Step 2: Grep for stale references**

Run:
```bash
grep -n "ENC_COL" Backlog.bas MFC_All_Modules.txt
grep -n "FCStatusFilter\|WardFilter\|DischargeFilter" *.bas MFC_All_Modules.txt
grep -n "wsMainEFC.Cells(wsMainEFC.Rows.Count, 1)" CombineEFC.bas MFC_All_Modules.txt
grep -n "wsMissedEFC.Cells(wsMissedEFC.Rows.Count, 1)" CombineEFC.bas MFC_All_Modules.txt
```

Expected: No matches for any of the above.

- [ ] **Step 3: Ask user to compile**

Request: "Please open the VBA Editor (Alt+F11), go to Debug > Compile VBAProject, and report any errors."

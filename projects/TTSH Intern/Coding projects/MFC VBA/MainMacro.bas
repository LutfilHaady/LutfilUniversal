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

    ' --- Progress window ---
    Dim prog As New ProgressForm
    prog.ShowProgress 9

    ' --- Step 1: Select all 4 input files via dashboard ---
    prog.Update 1, "Select input files..."
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
    prog.Update 2, "Combining EFC files..."
    CombineEFCFiles wsMainEFC, wsMissedEFC

    ' --- Step 3: Reformat Admission Date, insert "Adm Date for MFC" column ---
    ' This shifts "Admission Status" and everything to its right by +1.
    ' LookupEpicData finds all column positions by header, so order matters only
    ' insofar as "Point Of Care" must exist before LookupEpicData runs.
    prog.Update 3, "Extracting and reformatting admission dates..."
    ExtractAdmissionDate wsMainEFC

    ' --- Step 4: Filter FC Status BEFORE Epic lookup ---
    ' The FC Status filter does not need Epic data, so running it here
    ' reduces the working row count from ~20,000 to only the Draft rows
    ' before the Epic lookup runs. This makes the lookup roughly 3x faster
    ' and avoids processing rows that would be discarded anyway.
    prog.Update 4, "Filtering FC Status..."
    If Not FilterFCStatus(wsMainEFC) Then GoTo Cleanup

    ' --- Step 5: XLOOKUP Bed and Admit Status from Epic ---
    ' Inserts "Bed Point Of Care" before "Point Of Care" and appends
    ' "Epic Admission Status/Discharged" after the last EFC column.
    ' Now only processes the filtered (Draft) rows, not the full 20,000.
    prog.Update 5, "Looking up Bed and Admit Status from Epic (~20,000 rows)..."
    LookupEpicData wsMainEFC, wsEpic

    ' --- Step 6: Delete rows whose ward code is not in the NCID allowlist ---
    ' Must run after LookupEpicData -- the Bed column comes from Epic.
    prog.Update 6, "Filtering by bed code (NCID wards only)..."
    FilterBedCode wsMainEFC

    ' --- Step 7: Highlight duplicate Encounter No + Patient Name rows red ---
    prog.Update 7, "Flagging duplicate rows..."
    FlagDuplicateRows wsMainEFC

    ' --- Step 8: Create and save the output .xlsx ---
    prog.Update 8, "Building output report..."
    Set wbOutput = BuildMFCOutput(wsMainEFC)
    If wbOutput Is Nothing Then GoTo Cleanup

    ' --- Step 9: Compare against previous MFC, highlight backlog, write summary ---
    ' The previous MFC workbook has several tabs; the report we compare against is
    ' the tab named "MFC" (the 3rd sheet). Hardcoded for the pilot -- if the tab is
    ' ever renamed or moved, update the sheet name below.
    prog.Update 9, "Comparing against previous MFC report..."
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

    ' Close input workbooks before the success dialog so the output is already
    ' visible when the user clicks OK. The Cleanup block re-runs these closes
    ' harmlessly (OERN silences the "already closed" error).
    On Error Resume Next
    If Not wbMain   Is Nothing Then wbMain.Close   SaveChanges:=False
    If Not wbMissed Is Nothing Then wbMissed.Close SaveChanges:=False
    If Not wbEpic   Is Nothing Then wbEpic.Close   SaveChanges:=False
    If Not wbPrev   Is Nothing Then wbPrev.Close   SaveChanges:=False
    On Error GoTo 0
    wbOutput.Sheets(1).Activate
    Application.ScreenUpdating = True

    Application.StatusBar = False
    prog.CloseProgress
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
    On Error Resume Next
    prog.CloseProgress
    On Error GoTo 0
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

Attribute VB_Name = "MainMacro"
Option Explicit

' ============================================================
' MainMacro.bas
'
' Entry point. Orchestrates the full Inflight MFC report generation:
'   1.  Open and validate 4 input files (with similarity guard for EFC pair)
'   2.  Combine EFC files
'   3.  Extract + reformat Admission Date  -- MUST precede LookupEpicData
'   4.  Filter: keep Draft FC Status rows (+ Missed FC rows) -- runs before Epic for speed
'   5.  XLOOKUP Final Bed and Epic Admission Status from Epic
'   6.  Filter: remove rows whose Final Bed matches the Inflight excludelist
'   7.  Filter: remove ALL discharged cases (including Missed FC); captures them
'       for the Discharged output tab built in step 9. Runs after the bed
'       filter so the Discharged tab only ever contains Inflight-ward beds.
'   8.  Flag duplicate Encounter No + Patient Name combinations
'   9.  Build output .xlsx (cols A-O)
'   10. Compare against previous MFC, highlight backlog, write summary table
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
    prog.ShowProgress 10

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
    prog.Update 3, "Extracting and reformatting admission dates..."
    ExtractAdmissionDate wsMainEFC

    ' --- Step 4: Filter FC Status BEFORE Epic lookup ---
    ' Keeps Draft + Missed FC rows only; reduces row count before Epic lookup.
    prog.Update 4, "Filtering FC Status..."
    If Not FilterFCStatus(wsMainEFC) Then GoTo Cleanup

    ' --- Step 5: XLOOKUP Final Bed and Epic Admission Status from Epic ---
    ' Inserts "Final Bed" after "Point Of Care" and appends
    ' "Epic Admission Status" after the last EFC column.
    prog.Update 5, "Looking up Final Bed and Admit Status from Epic (~20,000 rows)..."
    LookupEpicData wsMainEFC, wsEpic

    ' --- Step 6: Remove rows whose Final Bed matches the Inflight excludelist ---
    ' Must run after Epic lookup. Runs BEFORE the discharge filter so that
    ' non-Inflight-ward rows are gone before discharged rows get captured --
    ' keeps the Discharged tab scoped to the same wards as the main report.
    prog.Update 6, "Filtering by bed code (Inflight wards)..."
    FilterByBedCode wsMainEFC

    ' --- Step 7: Remove ALL discharged cases ---
    ' Unlike NCID, Inflight removes discharged patients unconditionally
    ' (including Missed FC rows). Must run after Epic lookup.
    ' Discharged rows are captured onto a hidden temp sheet (wsDischarged) instead
    ' of being lost -- BuildMFCOutput turns them into a second "Discharged" tab
    ' for the manager to close out in eFC.
    prog.Update 7, "Filtering discharged cases..."
    Dim wsDischarged As Worksheet
    FilterDischarged wsMainEFC, wsDischarged

    ' --- Step 8: Highlight duplicate Encounter No + Patient Name rows red ---
    prog.Update 8, "Flagging duplicate rows..."
    FlagDuplicateRows wsMainEFC

    ' --- Step 9: Create and save the output .xlsx (also adds the Discharged
    ' tab if any rows were captured in step 6) ---
    prog.Update 9, "Building output report..."
    Set wbOutput = BuildMFCOutput(wsMainEFC, wsDischarged)
    If wbOutput Is Nothing Then GoTo Cleanup

    ' --- Step 10: Compare against previous MFC, highlight backlog, write summary ---
    prog.Update 10, "Comparing against previous MFC report..."
    Dim totalCases   As Long
    Dim backlogCount As Long
    Dim wsPrev As Worksheet
    Dim prevSheetName As String
    prevSheetName = GetSetting("Sheet Name", "MFC Report")
    On Error Resume Next
    Set wsPrev = wbPrev.Sheets(prevSheetName)
    If wsPrev Is Nothing Then Set wsPrev = wbPrev.Sheets("MFC Report")
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
    ' visible when the user clicks OK.
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
           "   (or pick the blank option in Case Status to clear the row)", _
           vbInformation, "MFC Report Done"
    Exit Sub

Cleanup:
    Application.StatusBar = False
    On Error Resume Next
    prog.CloseProgress
    On Error GoTo 0
    On Error Resume Next
    If Not wbMain   Is Nothing Then wbMain.Close   SaveChanges:=False
    If Not wbMissed Is Nothing Then wbMissed.Close SaveChanges:=False
    If Not wbEpic   Is Nothing Then wbEpic.Close   SaveChanges:=False
    If Not wbPrev   Is Nothing Then wbPrev.Close   SaveChanges:=False
    On Error GoTo 0

End Sub

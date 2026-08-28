Attribute VB_Name = "MainMacro"
Option Explicit

' ============================================================
' MainMacro.bas
'
' Entry point: GenerateFCCompletionReport (run via Alt+F8).
' Orchestrates the full pipeline:
'   1. FilePickerForm -- select File A and File B
'   2. Load staff roster from Config sheet
'   3. Clean File A (FC Mode filter, cancel filter, dedup)
'   4. Clean File B (FC Mode filter, Missed FC filter, cancel/planned, EDVW flag)
'   5. Build output workbook (EM/EL split, Summary, Methodology, Roster Check)
'   6. Close input files, show success summary
' ============================================================

Private Const TOTAL_STEPS As Long = 12

Public Sub GenerateFCCompletionReport()

    On Error GoTo ErrHandler

    ' ---- Step 0: File picker ----
    Dim picker As FilePickerForm
    Set picker = New FilePickerForm
    If Not picker.ShowFilePicker Then Exit Sub

    Dim wbA As Workbook, wbB As Workbook
    Set wbA = picker.SelectedFileA
    Set wbB = picker.SelectedFileB

    Dim wsA As Worksheet, wsB As Worksheet
    Set wsA = wbA.Sheets(1)
    Set wsB = wbB.Sheets(1)

    ' ---- Show progress ----
    ProgressForm.ShowProgress TOTAL_STEPS

    ' ---- Step 1: Load staff roster ----
    ProgressForm.Update 1, "Loading staff roster"
    Dim roster As Object
    Set roster = LoadStaffRoster()

    ' ---- Steps 2-3: Clean File A ----
    ProgressForm.Update 2, "File A -- filtering FC Mode"
    If Not FilterFCMode(wsA) Then GoTo Cleanup

    ProgressForm.Update 3, "File A -- removing cancelled admissions"
    If Not DeleteCancelledAdmissions(wsA) Then GoTo Cleanup

    ' ---- Steps 4-6: Deduplicate File A ----
    ProgressForm.Update 4, "File A -- adding priority column"
    AddPriorityColumn wsA

    ProgressForm.Update 5, "File A -- highlighting duplicate encounters"
    MarkDuplicateEncounters wsA

    ProgressForm.Update 6, "File A -- resolving duplicates"
    Dim voidedOnlyCount As Long
    Dim dupGroupsResolved As Long
    Dim dupRowsRemoved As Long
    If Not ResolveDuplicateEncounters(wsA, roster, voidedOnlyCount, _
            dupGroupsResolved, dupRowsRemoved) Then GoTo Cleanup

    ' ---- Steps 7-10: Clean File B ----
    ProgressForm.Update 7, "File B -- filtering FC Mode"
    If Not FilterFCModeIfPresent(wsB) Then GoTo Cleanup

    ProgressForm.Update 8, "File B -- keeping Missed FC rows"
    If Not KeepOnlyMissedFC(wsB) Then GoTo Cleanup

    ProgressForm.Update 9, "File B -- removing cancelled/planned"
    If Not DeleteCancelledOrPlanned(wsB) Then GoTo Cleanup

    ProgressForm.Update 10, "File B -- flagging EDVW discharges"
    FlagEDVWDischarges wsB

    ' ---- Steps 11-12: Build output ----
    ProgressForm.Update 11, "Building output workbook"
    Dim outputOK As Boolean
    outputOK = BuildOutputWorkbook(wsA, wsB, roster, voidedOnlyCount)

    ProgressForm.Update 12, "Done"

    ' ---- Cleanup: close input files ----
    On Error Resume Next
    wbA.Close SaveChanges:=False
    wbB.Close SaveChanges:=False
    On Error GoTo 0

    ProgressForm.CloseProgress
    Application.StatusBar = False

    If outputOK Then
        Dim missedCount As Long
        Dim bEncCol As Long
        bEncCol = 0

        MsgBox "FC Completion Report generated successfully." & vbNewLine & vbNewLine & _
               "Duplicate encounters resolved: " & dupGroupsResolved & _
               " (" & dupRowsRemoved & " row(s) removed)" & vbNewLine & _
               "Voided/Deleted-only encounters excluded: " & voidedOnlyCount, _
               vbInformation, "Complete"
    Else
        MsgBox "Report generation encountered an error. Check the output workbook " & _
               "(if open) for partial results.", vbExclamation, "Warning"
    End If

    Exit Sub

Cleanup:
    On Error Resume Next
    ProgressForm.CloseProgress
    wbA.Close SaveChanges:=False
    wbB.Close SaveChanges:=False
    Application.StatusBar = False
    On Error GoTo 0
    Exit Sub

ErrHandler:
    On Error Resume Next
    ProgressForm.CloseProgress
    Application.StatusBar = False
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
    On Error GoTo 0
    MsgBox "Unexpected error:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
End Sub

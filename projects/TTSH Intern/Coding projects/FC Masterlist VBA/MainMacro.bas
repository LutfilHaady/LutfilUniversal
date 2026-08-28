Attribute VB_Name = "MainMacro"
Option Explicit

' ============================================================
' MainMacro.bas
'
' Entry point: RunFCMasterlistCleanup
'
' Orchestrates the full FC Training & Assessment Masterlist cleanup:
'   1. Ensure the "Designation Map" reference sheet exists (creates + seeds
'      it on first run; leaves it alone -- including your manual edits -- on
'      every run after that)
'   2. Clean Designation (canonicalize via map) + Department (structural
'      cleanup only) directly on Data Entry
'   3. Restore the "Employment Type" column and refresh the Pivot/Sheet2
'      pivot caches so the #REF! GETPIVOTDATA formulas on Training Breakdown
'      resolve again
'   4. Build the long-to-wide "Data Entry (Wide)" sheet, one row per
'      Employee No., with repeating Cycle N columns for each competency round
'   5. Colour-code Data Entry (Wide) (row status, Employment Type, Competency
'      Result per cycle) and build a "Legend" sheet explaining every colour
'
' Run via Alt+F8 -> RunFCMasterlistCleanup, with the FC Training & Assessment
' Masterlist as the ACTIVE workbook.
'
' Steps 2-3 modify Data Entry in place. Step 4 only adds a new sheet and does
' not touch Data Entry. Back up the file before running if you want an
' untouched copy -- this macro does not make one for you.
' ============================================================

Sub RunFCMasterlistCleanup()
    Dim wb As Workbook
    Set wb = ActiveWorkbook

    Dim wsData As Worksheet
    On Error Resume Next
    Set wsData = wb.Sheets("Data Entry")
    On Error GoTo 0

    If wsData Is Nothing Then
        MsgBox "Could not find a 'Data Entry' sheet in the active workbook." & vbNewLine & _
               "Open the FC Training & Assessment Masterlist and make sure it is the active window, then try again.", _
               vbCritical, "FC Masterlist Cleanup"
        Exit Sub
    End If

    Dim confirm As VbMsgBoxResult
    confirm = MsgBox( _
        "This will:" & vbNewLine & _
        "  1. Canonicalize Designation + clean Department text on Data Entry (in place)" & vbNewLine & _
        "  2. Restore the Employment Type column and refresh pivot caches (fixes Training Breakdown #REF! errors)" & vbNewLine & _
        "  3. Build a new 'Data Entry (Wide)' sheet, one row per Employee No." & vbNewLine & _
        "  4. Colour-code Data Entry (Wide) and build a 'Legend' sheet explaining every colour" & vbNewLine & vbNewLine & _
        "Steps 1-2 edit Data Entry directly. Make a backup copy of this file first if you want to keep the untouched original." & vbNewLine & vbNewLine & _
        "Continue?", vbYesNo + vbQuestion, "FC Masterlist Cleanup")
    If confirm = vbNo Then Exit Sub

    Application.ScreenUpdating = False
    Application.StatusBar = "Preparing Designation Map..."

    EnsureDesignationMapSheet wb
    Dim dict As Object
    Set dict = LoadDesignationMap(wb)

    Application.StatusBar = "Cleaning Designation and Department text..."
    Dim unmappedCount As Long
    unmappedCount = CleanDesignationsAndDepartments(wsData, dict)

    Application.StatusBar = "Restoring Employment Type column and refreshing pivots..."
    Dim pivotSummary As String
    pivotSummary = RestoreEmploymentTypeAndPivots(wsData, dict)

    Application.StatusBar = "Building long-to-wide Data Entry (Wide) sheet..."
    Dim wsWide As Worksheet
    Set wsWide = BuildWideMasterlist(wsData, dict)

    Dim wideCount As Long
    If Not wsWide Is Nothing Then
        wideCount = wsWide.Cells(wsWide.Rows.Count, 1).End(xlUp).Row - 1

        Application.StatusBar = "Applying colour coding..."
        ApplyColorCoding wsWide

        Application.StatusBar = "Building Legend sheet..."
        BuildLegendSheet wb

        wsWide.Activate
    Else
        wideCount = 0
    End If

    Application.StatusBar = False
    Application.ScreenUpdating = True

    ' Columns with real data but no header text in row 1 are NOT included in
    ' Data Entry (Wide) (there's no named slot to put them in), even though
    ' the pivot-cache fix above now correctly extends to cover them. Surface
    ' this explicitly rather than let it go unnoticed.
    Dim unlabeledReport As String
    unlabeledReport = DescribeUnlabeledColumnsWithData(wsData)

    Dim unlabeledSection As String
    If Len(unlabeledReport) > 0 Then
        unlabeledSection = vbNewLine & vbNewLine & _
            "WARNING - found column(s) with data but no header on Data Entry:" & vbNewLine & _
            unlabeledReport & vbNewLine & _
            "These are NOT included in Data Entry (Wide) -- add a header name to each and re-run " & _
            "if they should be. (One of these is likely a legacy field, e.g. the old " & _
            "'Employment (Y/N)' column, that lost its header text rather than being deleted.)"
    Else
        unlabeledSection = ""
    End If

    MsgBox "FC Masterlist cleanup complete." & vbNewLine & vbNewLine & _
           "Designations cleaned: unmapped/unrecognised designations found: " & unmappedCount & vbNewLine & _
           "  (check the 'Designation Map' sheet -- rows tagged 'UNMAPPED - REVIEW' need your input)" & vbNewLine & vbNewLine & _
           pivotSummary & vbNewLine & vbNewLine & _
           "Data Entry (Wide): " & wideCount & " employee rows written." & vbNewLine & _
           "Review the 'Data Quality Flags' column on that sheet for rows needing attention " & _
           "(no Employee No., unmapped designation, source error value, or inconsistent onboarding dates)." & vbNewLine & vbNewLine & _
           "Colour coding applied -- see the new 'Legend' sheet for what every colour means." & _
           unlabeledSection, _
           vbInformation, "FC Masterlist Cleanup Done"
End Sub

Attribute VB_Name = "PivotRepair"
Option Explicit

' ============================================================
' PivotRepair.bas
'
' Fixes the #REF! errors on the Training Breakdown sheet. Root cause (verified
' against the workbook, not assumed): those GETPIVOTDATA formulas reference a
' pivot field "Employment Type\n(FC/Nurse/VAS/Others)" that no longer exists --
' the source column was removed from Data Entry at some point, so the Pivot /
' Sheet2 pivot tables' cached field list no longer has it.
'
' Fix: re-add an "Employment Type" column to Data Entry (derived from the
' now-canonical Designation via the Designation Map), extend each affected
' PivotCache's source range to include it, and refresh. This does NOT touch
' the GETPIVOTDATA formula text itself -- once the field exists again in the
' refreshed cache under the same header text, the existing formulas resolve
' on their own.
'
' Run this AFTER DesignationCleanup (so Designation values are already
' canonical) and it can run independently of ReshapeBuilder.
' ============================================================

Private Const EMP_TYPE_HEADER As String = "Employment Type" & vbLf & "(FC/Nurse/VAS/Others)"

' Returns a summary string describing what was done / any caches that could
' not be refreshed, for MainMacro to show in the final MsgBox.
Public Function RestoreEmploymentTypeAndPivots(wsSource As Worksheet, dict As Object) As String
    Dim wb As Workbook
    Set wb = wsSource.Parent

    Dim cDept As Long
    cDept = FindColByHeader(wsSource, "Department")
    If cDept = 0 Then
        RestoreEmploymentTypeAndPivots = "Could not find Department column -- Employment Type not restored."
        Exit Function
    End If

    ' NormHeader collapses the header's internal line break to a space, so the
    ' lookup string here must include the full "(FC/Nurse/VAS/Others)" suffix --
    ' searching for just "Employment Type" would never match the real header
    ' and would insert a duplicate column on every run.
    Dim cEmpType As Long
    cEmpType = FindColByHeader(wsSource, "Employment Type (FC/Nurse/VAS/Others)")

    If cEmpType = 0 Then
        ' Insert a fresh column immediately after Department.
        wsSource.Columns(cDept + 1).Insert Shift:=xlToRight
        cEmpType = cDept + 1
        wsSource.Cells(1, cEmpType).Value = EMP_TYPE_HEADER
    End If

    ' --- Populate Employment Type for every data row from the (canonical) Designation ---
    Dim cDesig As Long
    cDesig = FindColByHeader(wsSource, "Designation")

    Dim anchorCol As Long
    anchorCol = FindColByHeader(wsSource, "S/N")
    If anchorCol = 0 Then anchorCol = 1
    Dim lastRow As Long
    lastRow = wsSource.Cells(wsSource.Rows.Count, anchorCol).End(xlUp).Row

    Dim r As Long, canonical As String, employmentType As String
    For r = 2 To lastRow
        ' Guards against an Excel error value (#N/A etc.) in Designation the
        ' same way DesignationCleanup.bas does -- see that module's comment.
        If Not IsErrorValue(wsSource.Cells(r, cDesig).Value) Then
            Dim desigVal As String
            desigVal = SafeStr(wsSource.Cells(r, cDesig).Value)
            If Len(Trim(desigVal)) > 0 Then
                CanonicalizeDesignation desigVal, dict, canonical, employmentType
                wsSource.Cells(r, cEmpType).Value = employmentType
            End If
        End If
    Next r

    ' --- Extend + refresh every PivotCache that sources from this sheet ---
    ' Uses LastUsedColumn, not a header-row-only scan -- see Helpers.bas.
    ' Header-only scanning here would re-point every pivot cache to a range
    ' that excludes real, unlabeled data columns that already exist further
    ' right on the sheet.
    Dim lastColNow As Long
    lastColNow = LastUsedColumn(wsSource)

    Dim newSourceRange As Range
    Set newSourceRange = wsSource.Range(wsSource.Cells(1, 1), wsSource.Cells(lastRow, lastColNow))

    Dim refreshedCount As Long, failedCount As Long
    refreshedCount = 0: failedCount = 0

    Dim pc As PivotCache
    For Each pc In wb.PivotCaches
        Dim srcStr As String
        On Error Resume Next
        srcStr = ""
        srcStr = CStr(pc.SourceData)
        On Error GoTo 0

        If InStr(1, srcStr, wsSource.Name, vbTextCompare) > 0 Then
            On Error Resume Next
            ' Assigning a Range object here (not a hand-built A1/R1C1 address
            ' string) -- PivotCache.SourceData is documented to accept either,
            ' but a Range removes any ambiguity about which notation Excel
            ' expects, which is the one part of this fix that can't be
            ' verified without a live Excel session.
            pc.SourceData = newSourceRange
            pc.Refresh
            If Err.Number = 0 Then
                refreshedCount = refreshedCount + 1
            Else
                failedCount = failedCount + 1
            End If
            Err.Clear
            On Error GoTo 0
        End If
    Next pc

    ' Refresh all pivot tables on all sheets too (cache refresh alone doesn't always
    ' force visible pivot tables to recalculate their displayed values/fields).
    Dim ws As Worksheet, pt As PivotTable
    For Each ws In wb.Worksheets
        For Each pt In ws.PivotTables
            On Error Resume Next
            pt.RefreshTable
            On Error GoTo 0
        Next pt
    Next ws

    RestoreEmploymentTypeAndPivots = "Employment Type column restored (col " & _
        wsSource.Cells(1, cEmpType).Address(False, False) & "). Pivot caches refreshed: " & _
        refreshedCount & ". Failed: " & failedCount & _
        IIf(failedCount > 0, " (open Pivot/Sheet2 manually and re-point the source range if #REF! persists)", "")
End Function

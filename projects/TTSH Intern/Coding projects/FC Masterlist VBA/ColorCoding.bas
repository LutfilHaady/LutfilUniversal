Attribute VB_Name = "ColorCoding"
Option Explicit

' ============================================================
' ColorCoding.bas
'
' "Maximum colour coding" for Data Entry (Wide), per Lutfil's request, plus a
' companion "Legend" sheet documenting every color used (also requested).
'
' Layers on top of ReshapeBuilder's Resigned/grey row fill:
'   - Resigned rows are already filled grey by ReshapeBuilder. This module
'     does NOT re-color the rest of a resigned row's status (grey already
'     says everything that matters), but it DOES still tint that row's
'     per-cycle Competency Result cells -- pass/fail history stays visible
'     even for someone who's left.
'   - Non-resigned rows get a row-level status color based on their Data
'     Quality Flags, priority order below (first match wins).
'   - The Employment Type cell (not the whole row) is tinted by category,
'     independent of row status.
'   - Every cycle's Competency Result cell is tinted by result (C / NYC /
'     other), independent of row status.
'
' Column layout assumed here matches ReshapeBuilder.bas exactly:
'   Static cols 1-12: EmpNo, Name, ADID, Email, Designation, Department,
'     Employment Type, FC Fundamentals, eFC Stages, No. of Records,
'     Resigned, Data Quality Flags.
'   Cycle N block (7 cols, starting at 12 + (N-1)*7 + 1): Year, Calendar
'     Year, Competency Result, Date of Competence, No. of Attempts,
'     Assessed By, FC Certificate Number.
' If ReshapeBuilder's layout ever changes, update COL_* / CYCLE_RESULT_OFFSET
' below to match.
' ============================================================

Private Const COL_EMPTYPE As Long = 7
Private Const COL_RESIGNED As Long = 11
Private Const COL_FLAGS As Long = 12
Private Const STATIC_COLS As Long = 12
Private Const COLS_PER_CYCLE As Long = 7
Private Const CYCLE_RESULT_OFFSET As Long = 3 ' Competency Result is the 3rd column within each cycle block

Public Sub ApplyColorCoding(wsWide As Worksheet)
    Dim lastRow As Long
    lastRow = wsWide.Cells(wsWide.Rows.Count, 1).End(xlUp).Row
    If lastRow < 2 Then Exit Sub

    Dim lastCol As Long
    lastCol = wsWide.Cells(1, wsWide.Columns.Count).End(xlToLeft).Column

    Dim maxCycles As Long
    maxCycles = (lastCol - STATIC_COLS) \ COLS_PER_CYCLE
    If maxCycles < 1 Then maxCycles = 1

    Dim r As Long
    For r = 2 To lastRow
        Dim resignedVal As String, flagsVal As String
        resignedVal = CStr(wsWide.Cells(r, COL_RESIGNED).Value)
        flagsVal = CStr(wsWide.Cells(r, COL_FLAGS).Value)

        If resignedVal <> "Yes" Then
            ApplyRowStatusColor wsWide, r, flagsVal
        End If

        ApplyEmploymentTypeTint wsWide, r

        Dim cyc As Long
        For cyc = 1 To maxCycles
            ApplyCompetencyResultTint wsWide, r, cyc
        Next cyc
    Next r
End Sub

' Row-level status color, priority order (first match wins). Only called
' for non-resigned rows -- see ApplyColorCoding.
Private Sub ApplyRowStatusColor(wsWide As Worksheet, r As Long, flagsVal As String)
    Dim lastCol As Long
    lastCol = wsWide.Cells(1, wsWide.Columns.Count).End(xlToLeft).Column

    Dim rowRange As Range
    Set rowRange = wsWide.Range(wsWide.Cells(r, 1), wsWide.Cells(r, lastCol))

    If InStr(1, flagsVal, "NO EMPLOYEE NO.", vbTextCompare) > 0 Then
        rowRange.Interior.Color = RGB(255, 192, 0) ' orange -- can't be matched to a person at all
    ElseIf InStr(1, flagsVal, "UNMAPPED DESIGNATION", vbTextCompare) > 0 Then
        rowRange.Interior.Color = RGB(255, 235, 156) ' yellow -- needs a Designation Map entry
    ElseIf InStr(1, flagsVal, "SOURCE ERROR VALUE", vbTextCompare) > 0 Then
        rowRange.Interior.Color = RGB(216, 180, 254) ' purple -- broken formula/error cell upstream
    ElseIf InStr(1, flagsVal, "date differs across rows", vbTextCompare) > 0 Then
        rowRange.Interior.Color = RGB(189, 215, 238) ' light blue -- onboarding dates inconsistent
    Else
        rowRange.Interior.ColorIndex = xlColorIndexNone ' clean row -- no fill
    End If
End Sub

Private Sub ApplyEmploymentTypeTint(wsWide As Worksheet, r As Long)
    Dim v As String
    v = CStr(wsWide.Cells(r, COL_EMPTYPE).Value)

    Select Case v
        Case "Nurse"
            wsWide.Cells(r, COL_EMPTYPE).Interior.Color = RGB(217, 225, 242) ' light blue
        Case "FC Competency Required"
            wsWide.Cells(r, COL_EMPTYPE).Interior.Color = RGB(226, 239, 218) ' light green
        Case "Others"
            wsWide.Cells(r, COL_EMPTYPE).Interior.Color = RGB(228, 223, 236) ' light lavender
        Case "UNMAPPED - REVIEW"
            wsWide.Cells(r, COL_EMPTYPE).Interior.Color = RGB(255, 192, 0) ' orange -- same as no-Designation-mapping row color
        Case Else
            wsWide.Cells(r, COL_EMPTYPE).Interior.ColorIndex = xlColorIndexNone
    End Select
End Sub

Private Sub ApplyCompetencyResultTint(wsWide As Worksheet, r As Long, cyc As Long)
    Dim col As Long
    col = STATIC_COLS + (cyc - 1) * COLS_PER_CYCLE + CYCLE_RESULT_OFFSET

    Dim v As String
    v = CStr(wsWide.Cells(r, col).Value)

    Select Case UCase(Trim(v))
        Case "C"
            wsWide.Cells(r, col).Interior.Color = RGB(198, 239, 206) ' green -- competent
        Case "NYC"
            wsWide.Cells(r, col).Interior.Color = RGB(255, 199, 206) ' red -- not yet competent
        Case ""
            wsWide.Cells(r, col).Interior.ColorIndex = xlColorIndexNone ' no assessment recorded
        Case Else
            wsWide.Cells(r, col).Interior.Color = RGB(255, 235, 156) ' yellow -- some other result (NA, etc.)
    End Select
End Sub

' Builds (or replaces) a "Legend" sheet describing every color this module
' and ReshapeBuilder use on Data Entry (Wide), with an actual color swatch
' next to each description rather than just text.
Public Sub BuildLegendSheet(wb As Workbook)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = wb.Sheets("Legend")
    On Error GoTo 0
    If Not ws Is Nothing Then
        Application.DisplayAlerts = False
        ws.Delete
        Application.DisplayAlerts = True
    End If

    Set ws = wb.Sheets.Add(After:=wb.Sheets(wb.Sheets.Count))
    ws.Name = "Legend"

    ws.Cells(1, 1).Value = "Data Entry (Wide) -- Colour Legend"
    ws.Cells(1, 1).Font.Bold = True
    ws.Cells(1, 1).Font.Size = 14

    ws.Cells(3, 1).Value = "Swatch"
    ws.Cells(3, 2).Value = "Applies to"
    ws.Cells(3, 3).Value = "Meaning"
    ws.Range("A3:C3").Font.Bold = True
    ws.Range("A3:C3").Interior.Color = RGB(31, 73, 125)
    ws.Range("A3:C3").Font.Color = RGB(255, 255, 255)

    Dim r As Long
    r = 4

    r = LegendRow(ws, r, RGB(166, 166, 166), "Whole row", _
        "Resigned -- 'Resigned'/'Resign and left on...' text found in this person's FC Certificate Number field on any of their cycles. (Substitute signal -- the original Employment (Y/N) source column is empty.)")

    r = LegendRow(ws, r, RGB(255, 192, 0), "Whole row (if not resigned) / Employment Type cell", _
        "No Employee No. found for this row (can't be matched to a person) -- OR -- Designation has no entry in the Designation Map (Employment Type shows UNMAPPED - REVIEW).")

    r = LegendRow(ws, r, RGB(255, 235, 156), "Whole row (if not resigned)", _
        "Designation was not recognised in the Designation Map -- passed through cleaned but unchanged text. Add it to the Designation Map sheet.")

    r = LegendRow(ws, r, RGB(216, 180, 254), "Whole row (if not resigned)", _
        "A source cell for this person (Name/ADID/Email/Designation/Department/dates/Cert No.) held an Excel error value (#N/A, #REF!, etc.) rather than real data -- caused by a broken formula elsewhere in the original workbook. Check Data Quality Flags for which column.")

    r = LegendRow(ws, r, RGB(189, 215, 238), "Whole row (if not resigned)", _
        "This person's Date of FC Fundamentals or Date of eFC Stages differs across their own merged rows -- should be a one-time onboarding date, so a mismatch usually means a data entry error.")

    r = r + 1
    ws.Cells(r, 1).Value = "Employment Type cell"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    r = LegendRow(ws, r, RGB(217, 225, 242), "Employment Type cell", "Nurse")
    r = LegendRow(ws, r, RGB(226, 239, 218), "Employment Type cell", "FC Competency Required")
    r = LegendRow(ws, r, RGB(228, 223, 236), "Employment Type cell", "Others (management/admin roles)")

    r = r + 1
    ws.Cells(r, 1).Value = "Cycle N - Competency Result cell (one per training cycle)"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    r = LegendRow(ws, r, RGB(198, 239, 206), "Competency Result cell", "C -- Competent")
    r = LegendRow(ws, r, RGB(255, 199, 206), "Competency Result cell", "NYC -- Not Yet Competent")
    r = LegendRow(ws, r, RGB(255, 235, 156), "Competency Result cell", "Any other recorded result (e.g. NA)")

    r = r + 2
    ws.Cells(r, 1).Value = "Not carried over from the original Data Entry sheet:"
    ws.Cells(r, 1).Font.Italic = True
    r = r + 1
    ws.Cells(r, 1).Value = "Red duplicate highlighting -- was Excel's built-in ""Highlight Duplicate Values"" on Employee No.; moot here since duplicates are exactly what get merged into one row."
    r = r + 1
    ws.Cells(r, 1).Value = "Yellow row highlighting on the original sheet -- confirmed dead formatting debt (formulas full of #REF! errors from old row edits), not recreated."

    ws.Columns("A").ColumnWidth = 14
    ws.Columns("B").ColumnWidth = 32
    ws.Columns("C").ColumnWidth = 90
    ws.Columns("B:C").WrapText = True
End Sub

' Writes one legend row (colored swatch cell + applies-to + meaning) and
' returns the next free row number.
Private Function LegendRow(ws As Worksheet, r As Long, swatchColor As Long, _
        appliesTo As String, meaning As String) As Long
    ws.Cells(r, 1).Interior.Color = swatchColor
    ws.Cells(r, 2).Value = appliesTo
    ws.Cells(r, 3).Value = meaning
    LegendRow = r + 1
End Function

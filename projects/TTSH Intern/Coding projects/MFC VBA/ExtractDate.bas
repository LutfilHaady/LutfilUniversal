Attribute VB_Name = "ExtractDate"
Option Explicit

' ============================================================
' ExtractDate.bas
'
' Reads EFC "Admission Date" column (found by header name).
' Format in source: MM/DD/YYYY HH:MM:SS AM/PM
'
' Inserts a new column immediately after "Admission Date" containing
' the date reformatted as a DD/MM/YYYY text string, header "Adm Date for MFC".
'
' This shifts "Admission Status" and everything to its right by +1.
' EpicLookup also finds its insert positions by header, so call order
' between ExtractAdmissionDate and LookupEpicData still matters only
' insofar as EpicLookup looks for "Point Of Care" after this insert.
' ============================================================

' Finds "Admission Date" by header, reformats all values,
' inserts new column immediately after it, then writes back in one bulk operation.
Public Sub ExtractAdmissionDate(ws As Worksheet)

    Dim admDateCol As Long
    admDateCol = FindColByHeader(ws, "Admission Date")
    If admDateCol = 0 Then
        MsgBox "Error: EFC file is missing 'Admission Date'." & vbNewLine & _
               "Check your EFC export.", vbExclamation, "Missing Column"
        Exit Sub
    End If

    ' Use "Encounter No" for lastRow: always filled for both main EFC and missed FC rows.
    ' FC ID (col 1) is blank for missed FC rows and would silently truncate the scan.
    Dim encNoCol As Long
    encNoCol = FindColByHeader(ws, "Encounter No")
    Dim lastRow As Long
    If encNoCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encNoCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, admDateCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Sub

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' --- Step 1: Read entire Admission Date column into a memory array ---
    Dim rawDates As Variant
    rawDates = ws.Range(ws.Cells(1, admDateCol), ws.Cells(lastRow, admDateCol)).Value

    ' --- Step 2: Build output array with reformatted dates ---
    Dim outDates() As Variant
    ReDim outDates(1 To lastRow, 1 To 1)
    outDates(1, 1) = "Adm Date for MFC"

    Dim i As Long
    For i = 2 To lastRow
        outDates(i, 1) = FormatAdmDate(rawDates(i, 1))
    Next i

    ' --- Step 3: Insert blank column immediately after "Admission Date" ---
    Dim insertCol As Long
    insertCol = admDateCol + 1
    ws.Columns(insertCol).Insert Shift:=xlToRight

    ' --- Step 4: Format new column as text BEFORE writing ---
    ' Prevents Excel from re-interpreting "18/12/2025" as a date serial
    ws.Columns(insertCol).NumberFormat = "@"

    ' --- Step 5: Write header + all dates in one bulk write ---
    ws.Range(ws.Cells(1, insertCol), ws.Cells(lastRow, insertCol)).Value = outDates

    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True

End Sub

' Converts one Admission Date cell value to a DD/MM/YYYY string.
'
' Handles two cases depending on the user's Windows locale:
'   - Numeric / vbDate: Excel auto-parsed the cell as a date serial on open
'     (happens when locale is MM/DD, e.g. US settings).
'   - String: cell was stored as text "MM/DD/YYYY HH:MM:SS AM/PM"
'     (happens when locale is DD/MM, e.g. Singapore settings -- Excel cannot
'     recognise MM/DD format and leaves the value as plain text).
Private Function FormatAdmDate(cellVal As Variant) As String

    ' Return empty string for blank cells
    If IsEmpty(cellVal) Or CStr(cellVal) = "" Then
        FormatAdmDate = ""
        Exit Function
    End If

    ' Case 1: Excel date serial (VarType vbDouble or vbDate) -- convert via CDate
    If VarType(cellVal) = vbDouble Or VarType(cellVal) = vbDate Then
        FormatAdmDate = Format(CDate(cellVal), "DD/MM/YYYY")
        Exit Function
    End If

    ' Case 2: Text string -- parse "MM/DD/YYYY HH:MM:SS AM/PM" manually
    Dim strVal As String
    strVal = Trim(CStr(cellVal))

    ' Isolate the date portion before the first space
    Dim spacePos As Long
    spacePos = InStr(strVal, " ")
    If spacePos > 0 Then strVal = Left(strVal, spacePos - 1)

    ' Split into parts: (0)=MM, (1)=DD, (2)=YYYY
    Dim parts() As String
    parts = Split(strVal, "/")
    If UBound(parts) < 2 Then
        FormatAdmDate = CStr(cellVal)   ' Unexpected format -- pass through unchanged
        Exit Function
    End If

    ' Pad to 2 digits and reassemble as DD/MM/YYYY
    Dim mm As String, dd As String, yyyy As String
    mm   = Right("0" & Trim(parts(0)), 2)
    dd   = Right("0" & Trim(parts(1)), 2)
    yyyy = Trim(parts(2))

    FormatAdmDate = dd & "/" & mm & "/" & yyyy

End Function

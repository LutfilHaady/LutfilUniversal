Attribute VB_Name = "FlagDuplicates"
Option Explicit

' ============================================================
' FlagDuplicates.bas
'
' Highlights in red every row (including the first occurrence)
' where the combination of Encounter No + Patient Name appears
' more than once in the working sheet.
' Staff review and decide manually which duplicate to delete.
'
' Encounter No and Patient Name are located by header name so the sub
' remains correct if columns are added to the EFC report.
'
' Strategy:
'   1. Load both columns into memory arrays (two reads).
'   2. Count composite key occurrences using a Dictionary (O(n) in memory).
'   3. Collect duplicate rows into a Union range (O(n) in memory).
'   4. Apply red fill + white font to the Union in one operation.
' ============================================================

Public Sub FlagDuplicateRows(ws As Worksheet)

    Dim encCol  As Long
    Dim nameCol As Long
    encCol  = FindColByHeader(ws, "Encounter No")
    nameCol = FindColByHeader(ws, "Patient Name")

    If encCol = 0 Or nameCol = 0 Then
        MsgBox "Error: Missing columns for duplicate check:" & vbNewLine & _
               IIf(encCol = 0, "  - Encounter No" & vbNewLine, "") & _
               IIf(nameCol = 0, "  - Patient Name" & vbNewLine, ""), _
               vbExclamation, "Missing Column"
        Exit Sub
    End If

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then Exit Sub

    Application.ScreenUpdating = False

    ' --- Step 1: Load Encounter No and Patient Name columns into memory ---
    Dim encData  As Variant
    Dim nameData As Variant
    encData  = ws.Range(ws.Cells(2, encCol),  ws.Cells(lastRow, encCol)).Value
    nameData = ws.Range(ws.Cells(2, nameCol), ws.Cells(lastRow, nameCol)).Value

    ' --- Step 2: Count occurrences of each composite key ---
    Dim keyCounts As Object
    Set keyCounts = CreateObject("Scripting.Dictionary")
    keyCounts.CompareMode = vbTextCompare  ' Case-insensitive matching

    Dim i As Long
    Dim key As String

    For i = 1 To UBound(encData, 1)
        ' Pipe separator prevents accidental collisions across fields
        key = Trim(CStr(encData(i, 1))) & "|" & UCase(Trim(CStr(nameData(i, 1))))
        If keyCounts.Exists(key) Then
            keyCounts(key) = keyCounts(key) + 1
        Else
            keyCounts(key) = 1
        End If
    Next i

    ' --- Step 3: Collect all duplicate rows into a single Union range ---
    Dim dupRange As Range

    For i = 1 To UBound(encData, 1)
        key = Trim(CStr(encData(i, 1))) & "|" & UCase(Trim(CStr(nameData(i, 1))))
        If keyCounts(key) > 1 Then
            ' Array index i -> sheet row i + 1 (data starts at row 2)
            If dupRange Is Nothing Then
                Set dupRange = ws.Rows(i + 1)
            Else
                Set dupRange = Union(dupRange, ws.Rows(i + 1))
            End If
        End If
    Next i

    ' --- Step 4: Apply formatting to all duplicate rows in one operation ---
    If Not dupRange Is Nothing Then
        dupRange.Interior.Color = RGB(255, 0, 0)
        dupRange.Font.Color     = RGB(255, 255, 255)
    End If

    Application.ScreenUpdating = True

End Sub

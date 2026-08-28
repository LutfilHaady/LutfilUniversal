Attribute VB_Name = "Dropdowns"
Option Explicit

' ============================================================
' Dropdowns.bas
'
' AddDropdowns (Public entry) -- adds the Resolution Status dropdown (col E)
' and the Config-driven dropdowns (cols A, C) to the output sheet, backed by a
' hidden "Lists" sheet copied from the macro workbook's Config sheet.
' ============================================================


' Applies all dropdowns and conditional formatting to the output sheet.
' Split into three focused subs so each can be understood and debugged independently.
Public Sub AddDropdowns(outWs As Worksheet, lastRow As Long)
    If lastRow < 2 Then Exit Sub
    SetupResolutionDropdown outWs, lastRow
    Dim listsWs As Worksheet
    Set listsWs = CreateListsSheet(outWs, lastRow)
    ApplyConfigDropdowns outWs, listsWs, lastRow
End Sub


' Sets the DD/MM/YYYY date format on col B, applies the Resolution Status dropdown
' on col E (Follow Up / Resolved), and adds row conditional formatting across A:P
' (Follow Up = amber, Resolved = green).
' Conditional formatting takes visual priority over the red duplicate highlight.
Private Sub SetupResolutionDropdown(outWs As Worksheet, lastRow As Long)
    Const RES_COL  As Long = 5
    Const DATE_COL As Long = 2
    Const LAST_COL As Long = 16

    outWs.Range(outWs.Cells(2, DATE_COL), outWs.Cells(lastRow, DATE_COL)).NumberFormat = "DD/MM/YYYY"

    With outWs.Range(outWs.Cells(2, RES_COL), outWs.Cells(lastRow, RES_COL)).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
             Operator:=xlBetween, Formula1:="Follow Up,Resolved,Clear"
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With

    ' $E2: absolute column E, row adjusts per row in the applied range
    Dim cf As FormatCondition
    With outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, LAST_COL)).FormatConditions
        .Delete
        Set cf = .Add(Type:=xlExpression, Formula1:="=$E2=""Follow Up""")
        cf.Interior.Color = RGB(255, 229, 153)  ' pale gold
        cf.Font.Color     = RGB(0, 0, 0)
        cf.StopIfTrue     = True
        Set cf = .Add(Type:=xlExpression, Formula1:="=$E2=""Resolved""")
        cf.Interior.Color = RGB(169, 209, 142)  ' soft sage green
        cf.Font.Color     = RGB(0, 0, 0)
        cf.StopIfTrue     = True
        Set cf = .Add(Type:=xlExpression, Formula1:="=$E2=""Clear""")
        cf.Interior.Color = RGB(255, 255, 255)  ' white -- overrides red duplicate flag
        cf.Font.Color     = RGB(0, 0, 0)
        cf.StopIfTrue     = True
    End With
End Sub


' Creates (or recreates) the hidden Lists sheet in the output workbook.
' Writes the last 31 dates into Lists!C (most recent first) and applies
' the date picker dropdown to col B. Returns the Lists sheet so the caller
' can write additional dropdown lists into cols A and B.
Private Function CreateListsSheet(outWs As Worksheet, lastRow As Long) As Worksheet
    Const DATE_DAYS As Long = 30
    Const DATE_COL  As Long = 2

    Dim outWb As Workbook
    Set outWb = outWs.Parent

    Dim listsWs As Worksheet
    On Error Resume Next
    Set listsWs = outWb.Sheets("Lists")
    On Error GoTo 0
    If Not listsWs Is Nothing Then
        Application.DisplayAlerts = False
        listsWs.Delete
        Application.DisplayAlerts = True
    End If
    Set listsWs = outWb.Sheets.Add(After:=outWb.Sheets(outWb.Sheets.Count))
    listsWs.Name = "Lists"
    listsWs.Visible = xlSheetVeryHidden

    ' Write last 31 dates into Lists!C, most recent first so today is top of dropdown
    Dim d As Long
    For d = 0 To DATE_DAYS
        listsWs.Cells(d + 2, 3).Value = Date - d
    Next d
    listsWs.Range(listsWs.Cells(2, 3), listsWs.Cells(DATE_DAYS + 2, 3)).NumberFormat = "DD/MM/YYYY"

    ' Apply date picker dropdown to col B; source is the range just written to Lists!C
    With outWs.Range(outWs.Cells(2, DATE_COL), outWs.Cells(lastRow, DATE_COL)).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
             Operator:=xlBetween, Formula1:="=Lists!$C$2:$C$" & (DATE_DAYS + 2)
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With

    Set CreateListsSheet = listsWs
End Function


' Reads Inflight FC Status and Staff Follow Up lists from the Config sheet,
' writes them into the hidden Lists sheet (cols A and B), and applies
' in-cell dropdowns to output cols A (Inflight FC Status) and C (Staff Follow Up).
Private Sub ApplyConfigDropdowns(outWs As Worksheet, listsWs As Worksheet, lastRow As Long)
    Dim cfgWs As Worksheet
    On Error Resume Next
    Set cfgWs = ThisWorkbook.Sheets("Config")
    On Error GoTo 0
    If cfgWs Is Nothing Then
        MsgBox "Config sheet not found. Run 'CreateConfigSheet' first (Alt+F8).", _
               vbExclamation, "Config Missing"
        Exit Sub
    End If

    Dim inflightCol As Long : inflightCol = FindColByHeader(cfgWs, "Inflight FC Status")
    Dim staffCol    As Long : staffCol    = FindColByHeader(cfgWs, "Staff Follow Up")

    Dim inflightCount As Long
    Dim staffCount    As Long
    Dim inflightList() As String
    Dim staffList()   As String
    If inflightCol > 0 Then inflightList = ReadConfigColumn(cfgWs, inflightCol, inflightCount)
    If staffCol    > 0 Then staffList    = ReadConfigColumn(cfgWs, staffCol,    staffCount)

    If inflightCount = 0 And staffCount = 0 Then
        MsgBox "Config sheet lists are empty." & vbNewLine & _
               "Add values under Config tab.", _
               vbExclamation, "Config Lists Empty"
        Exit Sub
    End If

    ' Write Config lists into the hidden Lists sheet (cols A and B)
    Dim r As Long
    For r = 1 To inflightCount
        listsWs.Cells(r + 1, 1).Value = inflightList(r)
    Next r
    For r = 1 To staffCount
        listsWs.Cells(r + 1, 2).Value = staffList(r)
    Next r

    If inflightCount > 0 Then
        With outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, 1)).Validation
            .Delete
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
                 Operator:=xlBetween, Formula1:="=Lists!$A$2:$A$" & (inflightCount + 1)
            .IgnoreBlank = True
            .InCellDropdown = True
            .ShowError = False
        End With
    End If

    If staffCount > 0 Then
        With outWs.Range(outWs.Cells(2, 3), outWs.Cells(lastRow, 3)).Validation
            .Delete
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
                 Operator:=xlBetween, Formula1:="=Lists!$B$2:$B$" & (staffCount + 1)
            .IgnoreBlank = True
            .InCellDropdown = True
            .ShowError = False
        End With
    End If
End Sub


' Reads non-blank values from a Config column starting at row 2, stopping at the
' first blank cell. Uses a single bulk range read to avoid per-cell COM calls;
' only one ReDim Preserve at the end to trim the array.
' Returns a 1-based String array; count = 0 when the column is empty.
Private Function ReadConfigColumn(ws As Worksheet, colIdx As Long, ByRef count As Long) As String()
    Dim items() As String
    ReDim items(1 To 1)
    count = 0

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, colIdx).End(xlUp).Row
    If lastRow < 2 Then
        ReadConfigColumn = items
        Exit Function
    End If

    ' Single-row range returns a scalar, not a 2-D array -- guard required
    If lastRow = 2 Then
        Dim singleVal As String
        singleVal = Trim(CStr(ws.Cells(2, colIdx).Value))
        If singleVal <> "" Then
            count = 1
            items(1) = singleVal
        End If
        ReadConfigColumn = items
        Exit Function
    End If

    ' Bulk read: one COM call for the entire column slice
    Dim colData As Variant
    colData = ws.Range(ws.Cells(2, colIdx), ws.Cells(lastRow, colIdx)).Value

    ' Pre-size to worst case, then trim once (one ReDim Preserve total, not one per row)
    ReDim items(1 To lastRow - 1)
    Dim r As Long
    Dim cellVal As String
    For r = 1 To UBound(colData, 1)
        cellVal = Trim(CStr(colData(r, 1)))
        If cellVal = "" Then Exit For
        count = count + 1
        items(count) = cellVal
    Next r
    If count > 0 Then ReDim Preserve items(1 To count)

    ReadConfigColumn = items
End Function

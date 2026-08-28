Attribute VB_Name = "Dropdowns"
Option Explicit

' ============================================================
' Dropdowns.bas
'
' AddDropdowns (Public entry) -- adds the Case Status dropdown (col E)
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


' Sets the DD/MM/YYYY date format on col B, applies the Case Status dropdown
' on col E (Resolved / U-turn / Clear), and adds row conditional formatting
' across A:O (Resolved = green, U-turn = yellow, Clear = white).
' Backlog rows receive direct yellow fill from ApplyCarryForward;
' conditional formatting takes visual priority over direct fill.
Private Sub SetupResolutionDropdown(outWs As Worksheet, lastRow As Long)
    Const RES_COL  As Long = 5
    Const DATE_COL As Long = 2
    Const LAST_COL As Long = 15

    outWs.Range(outWs.Cells(2, DATE_COL), outWs.Cells(lastRow, DATE_COL)).NumberFormat = "DD/MM/YYYY"

    Dim statusNames() As String
    Dim statusColors() As Long
    Dim statusCount As Long
    GetCaseStatuses statusNames, statusColors, statusCount

    Dim formula As String
    Dim i As Long
    For i = 1 To statusCount
        If i > 1 Then formula = formula & ","
        formula = formula & statusNames(i)
    Next i

    With outWs.Range(outWs.Cells(2, RES_COL), outWs.Cells(lastRow, RES_COL)).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
             Operator:=xlBetween, Formula1:=formula
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With

    Dim cf As FormatCondition
    With outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, LAST_COL)).FormatConditions
        .Delete
        For i = 1 To statusCount
            Set cf = .Add(Type:=xlExpression, Formula1:="=$E2=""" & statusNames(i) & """")
            cf.Interior.Color = statusColors(i)
            cf.Font.Color = RGB(0, 0, 0)
            cf.StopIfTrue = True
        Next i
    End With
End Sub


' Creates (or reuses) the hidden Lists sheet in the output workbook.
' Writes the last 31 dates into Lists!C (most recent first) and applies
' the date picker dropdown to col B. Returns the Lists sheet so the caller
' can write additional dropdown lists into cols A and B.
' Reused across multiple output sheets in the same workbook (e.g. the main
' report and the Discharged tab): Lists!C is only ever built once per run,
' but the date-dropdown validation on col B is (re)applied for every caller,
' since each output sheet needs its own validation pointing at the shared sheet.
Private Function CreateListsSheet(outWs As Worksheet, lastRow As Long) As Worksheet
    Dim DATE_DAYS As Long
    DATE_DAYS = GetSettingLong("Date Dropdown Days", 30)
    Const DATE_COL  As Long = 2

    Dim outWb As Workbook
    Set outWb = outWs.Parent

    Dim listsWs As Worksheet
    On Error Resume Next
    Set listsWs = outWb.Sheets("Lists")
    On Error GoTo 0

    If listsWs Is Nothing Then
        Set listsWs = outWb.Sheets.Add(After:=outWb.Sheets(outWb.Sheets.Count))
        listsWs.Name = "Lists"
        listsWs.Visible = xlSheetVeryHidden

        ' Write last 31 dates into Lists!C, most recent first so today is top of dropdown
        Dim d As Long
        For d = 0 To DATE_DAYS
            listsWs.Cells(d + 2, 3).Value = Date - d
        Next d
        listsWs.Range(listsWs.Cells(2, 3), listsWs.Cells(DATE_DAYS + 2, 3)).NumberFormat = "DD/MM/YYYY"
    End If

    ' Apply date picker dropdown to col B; source is the range written to Lists!C.
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
    Dim inflightCount As Long
    Dim staffCount    As Long
    Dim inflightList() As String
    Dim staffList()   As String
    inflightList = ReadConfigList("Inflight FC Status", inflightCount)
    staffList    = ReadConfigList("Staff Follow Up", staffCount)

    If inflightCount = 0 And staffCount = 0 Then
        MsgBox "Config sheet lists are empty." & vbNewLine & _
               "Add values under Config tab.", _
               vbExclamation, "Config Lists Empty"
        Exit Sub
    End If

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

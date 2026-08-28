Attribute VB_Name = "MainMacro"
Option Explicit

Sub GenerateAttendanceReport()
    Dim srcWb As Workbook, srcWs As Worksheet
    Dim cfgWs As Worksheet
    Dim schedule As Object, verifyOptions As Collection
    Dim rosterCodes As Object, rosterData As Object
    Dim outWb As Workbook
    Dim dayCols() As Long, dayDates() As Date, dayNames() As String
    Dim progressShown As Boolean

    On Error GoTo ErrHandler
    LastAction = "Showing file picker"

    If Not FilePickerForm.ShowFilePicker() Then Exit Sub   ' user cancelled; picker already closed its own file
    Set srcWb = FilePickerForm.SelectedSrc
    Set srcWs = srcWb.Sheets(1)

    Application.ScreenUpdating = False
    ProgressForm.ShowProgress 5
    progressShown = True

    ProgressForm.Update 1, "Loading configuration..."
    LastAction = "Loading Config sheet"
    Set cfgWs = ThisWorkbook.Sheets("Config")
    LoadConfig cfgWs, schedule, verifyOptions

    ProgressForm.Update 2, "Loading roster data..."
    LastAction = "Loading Roster sheet"
    LoadRoster ThisWorkbook, rosterCodes, rosterData

    ProgressForm.Update 3, "Parsing date headers..."
    LastAction = "Parsing date headers"
    ParseDayHeaders srcWs, dayCols, dayDates, dayNames

    ProgressForm.Update 4, "Classifying attendance and building department sheets..."
    LastAction = "Creating output workbook"
    Set outWb = Workbooks.Add(xlWBATWorksheet)
    BuildDepartmentSheets srcWs, outWb, schedule, verifyOptions, dayCols, dayDates, dayNames, rosterCodes, rosterData

    ProgressForm.Update 5, "Finalizing and saving report..."
    LastAction = "Removing blank placeholder sheet"
    Application.DisplayAlerts = False
    Do While outWb.Sheets.Count > 1 And outWb.Sheets(1).Name Like "Sheet*" _
              And Application.WorksheetFunction.CountA(outWb.Sheets(1).Cells) = 0
        outWb.Sheets(1).Delete
    Loop
    Application.DisplayAlerts = True

    LastAction = "Closing source workbook"
    srcWb.Close SaveChanges:=False

    Dim outName As String
    outName = "Attendance_Report_" & Format(dayDates(LBound(dayDates)), "YYYY_MM") & ".xlsx"
    LastAction = "Saving output workbook as " & outName
    outWb.SaveAs ThisWorkbook.Path & Application.PathSeparator & outName, FileFormat:=xlOpenXMLWorkbook

    ProgressForm.CloseProgress
    Application.ScreenUpdating = True

    Dim completionMsg As String
    completionMsg = "Attendance report generated:" & vbCrLf & outName & vbCrLf & vbCrLf & _
           "Check each department sheet for purple 'NO PUNCH - VERIFY' rows and fill in the Verification column."

    If Not RosterWarnings Is Nothing Then
        If RosterWarnings.Count > 0 Then
            Dim w As Variant
            completionMsg = completionMsg & vbCrLf & vbCrLf & "Roster warnings:"
            For Each w In RosterWarnings
                completionMsg = completionMsg & vbCrLf & "- " & w
            Next w
        End If
    End If

    MsgBox completionMsg, vbInformation
    Exit Sub

ErrHandler:
    Dim errNum As Long, errDesc As String
    errNum = Err.Number
    errDesc = Err.Description

    If progressShown Then
        On Error Resume Next
        ProgressForm.CloseProgress
        On Error GoTo 0
    End If
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    If Not srcWb Is Nothing Then
        On Error Resume Next
        srcWb.Close SaveChanges:=False
        On Error GoTo 0
    End If
    MsgBox "Error " & errNum & ": " & errDesc & vbCrLf & vbCrLf & _
           "Last action: " & LastAction, vbCritical, "Attendance Report Generator"
End Sub

Attribute VB_Name = "BuildOutput"
Option Explicit

' ============================================================
' BuildOutput.bas
'
' Public entry points:
'   BuildMFCOutput  -- Creates the final .xlsx (cols A-P).
'                      Returns the new Workbook, or Nothing on cancel.
'   BacklogSummary  -- Compares against previous MFC, carries forward
'                      manual cols A-D, writes the summary table.
'
' Each step is a separate named private sub -- paste any one into an AI
' chat to debug it in isolation without needing the whole file.
'
' Output layout (cols A-P):
'   A  Inflight FC Status              Manual -- dropdown
'   B  Date Updated (DD/MM/YYYY)       Manual
'   C  Staff Follow Up (if any)        Manual -- dropdown
'   D  Remarks                         Manual
'   E  Resolution Status               Manual -- Follow Up / Resolved
'   F  FC ID
'   G  Encounter Number
'   H  MRN
'   I  Patient Name
'   J  Adm Date for MFC
'   K  FC Status
'   L  Admit Status
'   M  Point of Care
'   N  Point of Care Final Bed
'   O  Admission Level Of Care
'   P  Epic Admission Status/Discharged
' ============================================================


' ===========================================================
' PUBLIC: BuildMFCOutput
' Orchestrates steps 1-7 to create the output workbook.
' ===========================================================
Public Function BuildMFCOutput(ws As Worksheet) As Workbook

    On Error GoTo CleanExit

    ' --- Resolve source columns by header ---
    Dim srcFCID     As Long : srcFCID     = FindColByHeader(ws, "FC ID")
    Dim srcEncNo    As Long : srcEncNo    = FindColByHeader(ws, "Encounter No")
    Dim srcMRN      As Long : srcMRN      = FindColByHeader(ws, "MRN")
    Dim srcPatName  As Long : srcPatName  = FindColByHeader(ws, "Patient Name")
    Dim srcAdmDate  As Long : srcAdmDate  = FindColByHeader(ws, "Adm Date for MFC")
    Dim srcAdmStat  As Long : srcAdmStat  = FindColByHeader(ws, "Admission Status")
    Dim srcBed      As Long : srcBed      = FindColByHeader(ws, "Bed Point Of Care")
    Dim srcPOC      As Long : srcPOC      = FindColByHeader(ws, "Point Of Care")
    Dim srcAdmLevel As Long : srcAdmLevel = FindColByHeader(ws, "Admission Level Of Care")
    Dim srcFCStat   As Long : srcFCStat   = FindColByHeader(ws, "FC Status")
    Dim srcEpicStat As Long : srcEpicStat = FindColByHeader(ws, "Epic Admission Status/Discharged")

    If Not ValidateSourceColumns(srcFCID, srcEncNo, srcMRN, srcPatName, srcAdmDate, _
                                  srcAdmStat, srcBed, srcPOC, srcAdmLevel, srcFCStat, srcEpicStat) Then
        Set BuildMFCOutput = Nothing
        Exit Function
    End If

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, srcEncNo).End(xlUp).Row
    If lastRow < 2 Then
        MsgBox "No data to output -- all rows were filtered out.", vbExclamation, "No Data"
        Set BuildMFCOutput = Nothing
        Exit Function
    End If
    Dim dataRows As Long : dataRows = lastRow - 1

    ' Load working sheet into memory (one read covers all needed columns)
    Dim wsLastCol As Long
    wsLastCol = Application.WorksheetFunction.Max( _
        srcFCID, srcEncNo, srcMRN, srcPatName, srcAdmDate, _
        srcAdmStat, srcBed, srcPOC, srcAdmLevel, srcFCStat, srcEpicStat)
    Dim wsData As Variant
    wsData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, wsLastCol)).Value

    ' Capture red duplicate-row flags before switching to the output workbook
    Dim rowIsRed() As Boolean
    CaptureRedFlags ws, dataRows, rowIsRed

    ' Build filename and prompt for save folder
    Dim currentDateStr As String : currentDateStr = Format(Date, "DD.MM.YYYY")
    Dim oneMonthAgoStr As String : oneMonthAgoStr = Format(DateAdd("m", -1, Date), "DD.MM.YYYY")
    Dim savePath As String
    With Application.FileDialog(msoFileDialogFolderPicker)
        .Title = "Select folder to save MFC Report"
        If .Show = False Then
            Set BuildMFCOutput = Nothing
            Exit Function
        End If
        savePath = .SelectedItems(1)
    End With
    Dim fullPath As String
    fullPath = savePath & "\MFC " & currentDateStr & " TO " & oneMonthAgoStr & ".xlsx"

    Application.ScreenUpdating = False

    ' Create output workbook -- strip to one sheet named "MFC Report"
    Dim outWb As Workbook
    Dim outWs As Worksheet
    Set outWb = Workbooks.Add
    Application.DisplayAlerts = False
    Do While outWb.Sheets.Count > 1
        outWb.Sheets(outWb.Sheets.Count).Delete
    Loop
    Application.DisplayAlerts = True
    Set outWs = outWb.Sheets(1)
    outWs.Name = "MFC Report"

    ' colMap(1..11) maps output cols F-P to their source column numbers in wsData.
    ' F=1(FC ID)  G=2(Enc No)  H=3(MRN)  I=4(Name)  J=5(Adm Date)
    ' K=6(FC Stat)  L=7(Adm Stat)  M=8(POC)  N=9(Bed)  O=10(Adm Level)  P=11(Epic Stat)
    Dim colMap(1 To 11) As Long
    colMap(1)  = srcFCID      ' F
    colMap(2)  = srcEncNo     ' G
    colMap(3)  = srcMRN       ' H
    colMap(4)  = srcPatName   ' I
    colMap(5)  = srcAdmDate   ' J
    colMap(6)  = srcFCStat    ' K
    colMap(7)  = srcAdmStat   ' L
    colMap(8)  = srcPOC       ' M
    colMap(9)  = srcBed       ' N
    colMap(10) = srcAdmLevel  ' O
    colMap(11) = srcEpicStat  ' P

    WriteOutputHeaders outWs
    WriteOutputData outWs, wsData, dataRows, lastRow, colMap, rowIsRed
    AddDropdowns outWs, lastRow
    FormatOutputSheet outWs, lastRow
    SaveOutputFile outWb, fullPath, savePath, currentDateStr, oneMonthAgoStr

    Application.ScreenUpdating = True
    Set BuildMFCOutput = outWb
    Exit Function

CleanExit:
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    Dim errMsg As String
    If Err.Number <> 0 Then errMsg = "BuildMFCOutput: Error " & Err.Number & " - " & Err.Description
    On Error Resume Next
    If Not outWb Is Nothing Then outWb.Close SaveChanges:=False
    On Error GoTo 0
    Set BuildMFCOutput = Nothing
    If Len(errMsg) > 0 Then MsgBox errMsg, vbCritical

End Function


' Checks all 11 required source columns are present.
' Shows a MsgBox listing any that are missing. Returns True only if all are found.
Private Function ValidateSourceColumns(srcFCID As Long, srcEncNo As Long, srcMRN As Long, _
                                        srcPatName As Long, srcAdmDate As Long, srcAdmStat As Long, _
                                        srcBed As Long, srcPOC As Long, srcAdmLevel As Long, _
                                        srcFCStat As Long, srcEpicStat As Long) As Boolean
    If srcFCID > 0 And srcEncNo > 0 And srcMRN > 0 And srcPatName > 0 And _
       srcAdmDate > 0 And srcAdmStat > 0 And srcBed > 0 And srcPOC > 0 And _
       srcAdmLevel > 0 And srcFCStat > 0 And srcEpicStat > 0 Then
        ValidateSourceColumns = True
        Exit Function
    End If
    ' Use explicit If guards, not IIf() -- IIf() is NOT short-circuit in VBA.
    Dim msg As String
    msg = "Error: Output cannot be built -- missing columns:" & vbNewLine
    If srcFCID = 0     Then msg = msg & "  - FC ID" & vbNewLine
    If srcEncNo = 0    Then msg = msg & "  - Encounter No" & vbNewLine
    If srcMRN = 0      Then msg = msg & "  - MRN" & vbNewLine
    If srcPatName = 0  Then msg = msg & "  - Patient Name" & vbNewLine
    If srcAdmDate = 0  Then msg = msg & "  - Adm Date for MFC" & vbNewLine
    If srcAdmStat = 0  Then msg = msg & "  - Admission Status" & vbNewLine
    If srcBed = 0      Then msg = msg & "  - Bed Point Of Care" & vbNewLine
    If srcPOC = 0      Then msg = msg & "  - Point Of Care" & vbNewLine
    If srcAdmLevel = 0 Then msg = msg & "  - Admission Level Of Care" & vbNewLine
    If srcFCStat = 0   Then msg = msg & "  - FC Status" & vbNewLine
    If srcEpicStat = 0 Then msg = msg & "  - Epic Admission Status/Discharged" & vbNewLine
    MsgBox msg, vbExclamation, "Missing Column"
    ValidateSourceColumns = False
End Function


' Reads the Interior.Color of each data row in ws into rowIsRed.
' Must run before switching to the output workbook.
' FlagDuplicateRows coloured duplicate rows red; we carry that forward.
Private Sub CaptureRedFlags(ws As Worksheet, dataRows As Long, ByRef rowIsRed() As Boolean)
    ReDim rowIsRed(1 To dataRows)
    Dim r As Long
    For r = 1 To dataRows
        rowIsRed(r) = (ws.Cells(r + 1, 1).Interior.Color = RGB(255, 0, 0))
    Next r
End Sub


' Saves the workbook to fullPath. If the file is locked (already open),
' lets the user choose to retry or auto-save under a new numbered name.
Private Sub SaveOutputFile(outWb As Workbook, ByVal fullPath As String, _
                            savePath As String, currentDateStr As String, oneMonthAgoStr As String)
    Dim saveErr As Long
    Dim answer  As VbMsgBoxResult
    Dim baseName As String
    Dim counter  As Long
    Dim fileName As String
    fileName = "MFC " & currentDateStr & " TO " & oneMonthAgoStr & ".xlsx"

    Do
        Application.DisplayAlerts = False
        On Error Resume Next
        outWb.SaveAs Filename:=fullPath, FileFormat:=xlOpenXMLWorkbook
        saveErr = Err.Number
        Err.Clear
        On Error GoTo 0
        Application.DisplayAlerts = True

        If saveErr = 0 Then Exit Do

        answer = MsgBox("Cannot save -- file is open:" & vbNewLine & _
                        fileName & vbNewLine & vbNewLine & _
                        "Close it and click Retry, or click Cancel to save a copy.", _
                        vbRetryCancel + vbExclamation, "File Already Open")

        If answer = vbCancel Then
            baseName = savePath & "\MFC " & currentDateStr & " TO " & oneMonthAgoStr
            counter = 1
            Do
                fullPath = baseName & " (" & counter & ").xlsx"
                fileName = "MFC " & currentDateStr & " TO " & oneMonthAgoStr & " (" & counter & ").xlsx"
                counter = counter + 1
            Loop While Dir(fullPath) <> ""
        End If
    Loop
End Sub

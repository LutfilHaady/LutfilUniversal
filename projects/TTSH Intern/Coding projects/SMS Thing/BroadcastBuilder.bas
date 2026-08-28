Attribute VB_Name = "BroadcastBuilder"
Option Explicit

' ============================================================
' BroadcastBuilder.bas
'
' Turns the flagged eFC working sheet (after CaseMatcher's Dedupe /
' IdentifySmsRequired / JoinPhoneFromEpic) into the ReviewForm's input lists,
' the final phone-number-only broadcast file, and the RunLog audit trail.
' ============================================================

' Scans wsEfc (already flagged by IdentifySmsRequired + JoinPhoneFromEpic) and
' splits "SMS REQUIRED" rows into cases (at least one usable phone candidate)
' and manualLookup (no Epic match, or all three candidates blank/placeholder
' -- never silently dropped, principle #4 in the design spec). followUpCount
' counts "NO FC DONE / WARD CLASS SELECTED" rows, surfaced as a distinct
' count rather than dropped.
Public Sub BuildReviewList(wsEfc As Worksheet, ByRef cases() As SmsCase, ByRef caseCount As Long, _
                            ByRef manualLookup() As SmsCase, ByRef manualCount As Long, _
                            ByRef followUpCount As Long)
    caseCount = 0
    manualCount = 0
    followUpCount = 0
    ReDim cases(1 To 1)
    ReDim manualLookup(1 To 1)

    Dim mcafCol As Long, encCol As Long, mrnCol As Long, nameCol As Long
    Dim phone1Col As Long, phone2Col As Long, phone3Col As Long
    mcafCol = FindColByHeader(wsEfc, "MCAF Reminder")
    encCol = FindColByHeader(wsEfc, GetSetting("eFC Encounter No Header", "Encounter No"))
    mrnCol = FindColByHeader(wsEfc, GetSetting("eFC MRN Header", "MRN"))
    nameCol = FindColByHeader(wsEfc, GetSetting("eFC Patient Name Header", "Patient Name"))
    phone1Col = FindColByHeader(wsEfc, "1st Phone Number")
    phone2Col = FindColByHeader(wsEfc, "2nd Phone Number")
    phone3Col = FindColByHeader(wsEfc, "3rd Phone Number")

    If mcafCol = 0 Or encCol = 0 Then Exit Sub   ' IdentifySmsRequired hasn't run

    Dim lastRow As Long
    lastRow = wsEfc.Cells(wsEfc.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then Exit Sub

    Dim lastCol As Long
    lastCol = wsEfc.Cells(1, wsEfc.Columns.Count).End(xlToLeft).Column
    Dim allData As Variant
    allData = wsEfc.Range(wsEfc.Cells(1, 1), wsEfc.Cells(lastRow, lastCol)).Value

    Dim placeholders() As String, placeholderCount As Long
    LoadPlaceholderList placeholders, placeholderCount

    Dim i As Long, flag As String
    Dim c As SmsCase

    For i = 2 To lastRow
        flag = Trim(CStr(allData(i, mcafCol)))
        If flag = "SMS REQUIRED" Then
            c.EncounterNo = CStr(allData(i, encCol))
            If mrnCol > 0 Then c.MRN = CStr(allData(i, mrnCol)) Else c.MRN = ""
            If nameCol > 0 Then c.PatientName = CStr(allData(i, nameCol)) Else c.PatientName = ""
            If phone1Col > 0 Then c.Phone1 = Trim(CStr(allData(i, phone1Col))) Else c.Phone1 = ""
            If phone2Col > 0 Then c.Phone2 = Trim(CStr(allData(i, phone2Col))) Else c.Phone2 = ""
            If phone3Col > 0 Then c.Phone3 = Trim(CStr(allData(i, phone3Col))) Else c.Phone3 = ""

            If FirstUsableNumber(c.Phone1, c.Phone2, c.Phone3, placeholders, placeholderCount) = "" Then
                manualCount = manualCount + 1
                ReDim Preserve manualLookup(1 To manualCount)
                manualLookup(manualCount) = c
            Else
                caseCount = caseCount + 1
                ReDim Preserve cases(1 To caseCount)
                cases(caseCount) = c
            End If
        ElseIf flag = "NO FC DONE / WARD CLASS SELECTED" Then
            followUpCount = followUpCount + 1
        End If
    Next i
End Sub

' Writes the checked cases' phone numbers to a new workbook, one number per
' row, with a header row labeled "Mobile Number" in row 1 (constraint #5 in
' the design spec -- matches the NHG portal's expected upload format; confirm
' the exact label against a real successful upload). Picks whichever of the
' three candidates FirstUsableNumber resolves to -- ReviewForm already showed
' PSA all three, so this isn't a hidden decision, just the SOP's one-number-
' per-row requirement (step 5/9) being enforced at the last step. Saves as
' SMS_Broadcast_<YYYY-MM-DD>.xlsx next to this tool, never overwriting an
' existing file from an earlier run the same day (architecture decision #2).
Public Function BuildBroadcastFile(cases() As SmsCase, checked() As Boolean, caseCount As Long) As Workbook
    Dim wb As Workbook
    Set wb = Workbooks.Add(xlWBATWorksheet)
    Dim ws As Worksheet
    Set ws = wb.Sheets(1)
    ws.Name = "Broadcast"

    ws.Cells(1, 1).Value = GetSetting("Broadcast Upload Header", "Mobile Number")
    ws.Cells(1, 1).Font.Bold = True

    Dim placeholders() As String, placeholderCount As Long
    LoadPlaceholderList placeholders, placeholderCount

    Dim outRow As Long
    outRow = 1
    Dim i As Long
    For i = 1 To caseCount
        If checked(i) Then
            outRow = outRow + 1
            ws.Cells(outRow, 1).Value = FirstUsableNumber(cases(i).Phone1, cases(i).Phone2, cases(i).Phone3, placeholders, placeholderCount)
        End If
    Next i

    ws.Columns("A:A").AutoFit

    Dim outPath As String
    outPath = UniqueOutputPath("SMS_Broadcast_" & Format(Date, "YYYY-MM-DD"))
    wb.SaveAs outPath, FileFormat:=xlOpenXMLWorkbook

    Set BuildBroadcastFile = wb
End Function

' Returns a save path for baseName & ".xlsx" next to this tool, appending
' "_2", "_3", ... if a file from an earlier run today already exists --
' output is a new file per run, never overwritten (architecture decision #2).
Private Function UniqueOutputPath(baseName As String) As String
    Dim folder As String
    folder = ThisWorkbook.Path & Application.PathSeparator

    If Dir(folder & baseName & ".xlsx") = "" Then
        UniqueOutputPath = folder & baseName & ".xlsx"
        Exit Function
    End If

    Dim n As Long
    n = 2
    Do While Dir(folder & baseName & "_" & n & ".xlsx") <> ""
        n = n + 1
    Loop
    UniqueOutputPath = folder & baseName & "_" & n & ".xlsx"
End Function

' Appends one row to the "RunLog" sheet in this workbook (creating it with
' headers if missing) -- the audit trail called for in the design spec, since
' the NHG portal itself isn't queryable.
Public Sub AppendRunLog(runTimestamp As Date, efcFileName As String, epicFileName As String, _
                         smsRequiredCount As Long, manualLookupCount As Long, _
                         dupCollapsedCount As Long, excludedCount As Long, _
                         markedSent As Boolean, portalNotes As String)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("RunLog")
    On Error GoTo 0

    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        ws.Name = "RunLog"
        ws.Cells(1, 1).Value = "Timestamp"
        ws.Cells(1, 2).Value = "eFC file used"
        ws.Cells(1, 3).Value = "Epic file used"
        ws.Cells(1, 4).Value = "SMS-required count"
        ws.Cells(1, 5).Value = "Manual-lookup count"
        ws.Cells(1, 6).Value = "Duplicates collapsed"
        ws.Cells(1, 7).Value = "Unchecked/excluded count"
        ws.Cells(1, 8).Value = "Marked sent?"
        ws.Cells(1, 9).Value = "Portal notes (free text)"
        ws.Range("A1:I1").Font.Bold = True
    End If

    Dim nextRow As Long
    nextRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1

    Dim sentText As String
    If markedSent Then sentText = "Yes" Else sentText = "No"

    ws.Cells(nextRow, 1).Value = Format(runTimestamp, "YYYY-MM-DD HH:NN:SS")
    ws.Cells(nextRow, 2).Value = efcFileName
    ws.Cells(nextRow, 3).Value = epicFileName
    ws.Cells(nextRow, 4).Value = smsRequiredCount
    ws.Cells(nextRow, 5).Value = manualLookupCount
    ws.Cells(nextRow, 6).Value = dupCollapsedCount
    ws.Cells(nextRow, 7).Value = excludedCount
    ws.Cells(nextRow, 8).Value = sentText
    ws.Cells(nextRow, 9).Value = portalNotes

    ws.Columns("A:I").AutoFit
End Sub

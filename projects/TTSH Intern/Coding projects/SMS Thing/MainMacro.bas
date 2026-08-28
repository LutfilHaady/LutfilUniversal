Attribute VB_Name = "MainMacro"
Option Explicit

' ============================================================
' MainMacro.bas
'
' Entry point. Orchestrates the full MCAF-M SMS broadcast generation:
'   1. Select and validate the eFC and Epic export files
'   2. Dedupe repeat Encounter No rows (keep last occurrence)
'   3. Identify SMS-required cases from Comment
'   4. Join Phone from Epic by Encounter No = CSN
'   5. Build the review list (matched / needs manual lookup / follow-up)
'   6. Review grid -- PSA unchecks any row before generating the file
'   7. Build the broadcast file, offer to mark the run as sent, log it
' See docs/superpowers/specs/2026-07-16-sms-broadcast-design.md.
' ============================================================

Sub GenerateSmsBroadcast()

    Dim wbEfc As Workbook
    Dim wbEpic As Workbook
    Dim wsEfc As Worksheet
    Dim wsEpic As Worksheet
    Dim efcFileName As String
    Dim epicFileName As String

    Dim dupSummary() As String
    Dim dupCount As Long

    Dim cases() As SmsCase
    Dim caseCount As Long
    Dim manualLookup() As SmsCase
    Dim manualCount As Long
    Dim followUpCount As Long

    Dim checked() As Boolean
    Dim checkedCount As Long
    Dim i As Long

    Dim wbBroadcast As Workbook
    Dim markedSent As Boolean
    Dim portalNotes As String

    ' --- Progress window ---
    Dim prog As New ProgressForm
    prog.ShowProgress 5

    ' --- Step 1: Select and validate input files ---
    prog.Update 1, "Select input files..."
    Dim picker As New FilePickerForm
    If Not picker.ShowFilePicker() Then GoTo Cleanup

    Set wbEfc = picker.SelectedEfc
    Set wbEpic = picker.SelectedEpic
    Set wsEfc = wbEfc.Sheets(1)
    Set wsEpic = wbEpic.Sheets(1)
    efcFileName = wbEfc.Name
    epicFileName = wbEpic.Name

    ' --- Step 2: Dedupe repeat Encounter No rows (keep last occurrence) ---
    prog.Update 2, "Removing duplicate Encounter No rows..."
    DedupeEfcRows wsEfc, dupSummary, dupCount

    ' --- Step 3: Identify SMS-required cases from Comment ---
    prog.Update 3, "Identifying SMS-required cases..."
    IdentifySmsRequired wsEfc

    ' --- Step 4: Join Phone from Epic by Encounter No = CSN ---
    prog.Update 4, "Looking up Phone from Epic..."
    JoinPhoneFromEpic wsEfc, wsEpic

    ' --- Step 5: Build the review list ---
    prog.Update 5, "Building review list..."
    BuildReviewList wsEfc, cases, caseCount, manualLookup, manualCount, followUpCount

    prog.CloseProgress

    If caseCount = 0 And manualCount = 0 Then
        On Error Resume Next
        wbEfc.Close SaveChanges:=False
        wbEpic.Close SaveChanges:=False
        On Error GoTo 0
        MsgBox "No SMS-required cases found in this export." & vbNewLine & _
               "Follow-up needed (NO FC DONE / WARD CLASS SELECTED): " & followUpCount, _
               vbInformation, "No Cases"
        Exit Sub
    End If

    ' --- Step 6: Review grid -- the human error-catching step ---
    Dim reviewer As New ReviewForm
    If Not reviewer.ShowReview(cases, caseCount, manualLookup, manualCount, dupSummary, dupCount, checked) Then
        GoTo Cleanup
    End If

    checkedCount = 0
    For i = 1 To caseCount
        If checked(i) Then checkedCount = checkedCount + 1
    Next i

    If checkedCount = 0 Then
        MsgBox "No cases were checked -- no broadcast file generated.", vbExclamation, "Nothing to Send"
        GoTo Cleanup
    End If

    ' --- Step 7: Build the broadcast file, offer to mark as sent, log it ---
    Set wbBroadcast = BuildBroadcastFile(cases, checked, caseCount)

    markedSent = (MsgBox("Broadcast file generated: " & wbBroadcast.Name & vbNewLine & vbNewLine & _
                          "After uploading to the NHG portal, mark this run as sent?", _
                          vbYesNo + vbQuestion, "Mark as Sent?") = vbYes)
    If markedSent Then
        portalNotes = InputBox("Optional: paste portal notes (record count, process status)...", "Portal Notes")
    End If

    AppendRunLog Now, efcFileName, epicFileName, checkedCount, manualCount, dupCount, _
                 (caseCount - checkedCount), markedSent, portalNotes

    On Error Resume Next
    wbEfc.Close SaveChanges:=False
    wbEpic.Close SaveChanges:=False
    On Error GoTo 0

    MsgBox "SMS broadcast file ready: " & wbBroadcast.Name & vbNewLine & vbNewLine & _
           "SMS required (checked): " & checkedCount & vbNewLine & _
           "Needs manual lookup    : " & manualCount & vbNewLine & _
           "Duplicates collapsed   : " & dupCount & vbNewLine & _
           "Follow-up needed       : " & followUpCount & vbNewLine & vbNewLine & _
           "Next step: log into the NHG portal and upload this file.", _
           vbInformation, "SMS Broadcast Ready"
    Exit Sub

Cleanup:
    On Error Resume Next
    prog.CloseProgress
    If Not wbEfc Is Nothing Then wbEfc.Close SaveChanges:=False
    If Not wbEpic Is Nothing Then wbEpic.Close SaveChanges:=False
    On Error GoTo 0

End Sub

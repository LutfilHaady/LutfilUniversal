Attribute VB_Name = "CaseMatcher"
Option Explicit

' ============================================================
' CaseMatcher.bas
'
' Ports the manual SOP's case-identification and Epic join logic:
'   DedupeEfcRows       -- collapse repeat Encounter No rows, keep last occurrence
'   IdentifySmsRequired -- Comment string match, ports the existing IF formula
'   JoinPhoneFromEpic   -- CSN/Encounter No dictionary join against Epic
' See docs/superpowers/specs/2026-07-16-sms-broadcast-design.md for the
' identification rules and the dedup rationale.
' ============================================================

' One matched or candidate SMS case, built by BuildReviewList (BroadcastBuilder.bas)
' from the flagged eFC working sheet. Fields match the columns actually used
' from the SMS TEMPLATE workbook (confirmed 2026-07-21): Encounter No, MRN,
' Patient Name, 1st/2nd/3rd Phone Number (all three raw candidates, not
' collapsed to one -- so PSA can see and override what the tool would pick;
' see FirstUsableNumber). FC ID / Admission Date / Admission Status and the
' FTF/SMS checker column onward are disregarded -- not part of the real
' working process. No separate Bed field either (see JoinPhoneFromEpic).
Public Type SmsCase
    EncounterNo As String
    MRN As String
    PatientName As String
    Phone1 As String
    Phone2 As String
    Phone3 As String
End Type

' Collapses repeat Encounter No rows in wsEfc, keeping only the LAST occurrence
' (bottom-most row in file order) per Encounter No -- see the Dedup Rule in the
' design spec: a repeat most plausibly means a re-export after a correction,
' and later rows reflect the more recent state.
' dupSummary receives one description string per collapsed Encounter No
' ("<EncounterNo> (<N> occurrences collapsed)"); dupCount is the number of
' distinct Encounter Nos affected (not the number of rows removed).
' Load-filter-write-delete strategy: one read, one write, one delete.
Public Sub DedupeEfcRows(wsEfc As Worksheet, ByRef dupSummary() As String, ByRef dupCount As Long)
    dupCount = 0
    ReDim dupSummary(1 To 0)

    Dim encCol As Long
    encCol = FindColByHeader(wsEfc, GetSetting("eFC Encounter No Header", "Encounter No"))
    If encCol = 0 Then Exit Sub

    Dim lastRow As Long
    lastRow = wsEfc.Cells(wsEfc.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then Exit Sub

    Dim lastCol As Long
    lastCol = wsEfc.Cells(1, wsEfc.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False

    Dim allData As Variant
    allData = wsEfc.Range(wsEfc.Cells(1, 1), wsEfc.Cells(lastRow, lastCol)).Value

    ' --- Pass 1: last row index and occurrence count per Encounter No ---
    Dim lastIdx As Object, occCount As Object
    Set lastIdx = CreateObject("Scripting.Dictionary")
    Set occCount = CreateObject("Scripting.Dictionary")

    Dim i As Long, key As String
    For i = 2 To lastRow
        key = Trim(CStr(allData(i, encCol)))
        If key <> "" Then
            lastIdx(key) = i
            If occCount.Exists(key) Then
                occCount(key) = occCount(key) + 1
            Else
                occCount(key) = 1
            End If
        End If
    Next i

    ' --- Pass 2: count rows to keep (blank keys always kept -- can't dedupe safely) ---
    Dim keepCount As Long
    keepCount = 0
    For i = 2 To lastRow
        key = Trim(CStr(allData(i, encCol)))
        If key = "" Then
            keepCount = keepCount + 1
        ElseIf lastIdx(key) = i Then
            keepCount = keepCount + 1
        End If
    Next i

    If keepCount = lastRow - 1 Then
        Application.ScreenUpdating = True
        Exit Sub   ' nothing to collapse
    End If

    ' --- Pass 3: build the compacted array of kept rows ---
    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)
    Dim outRow As Long, j As Long
    outRow = 0
    For i = 2 To lastRow
        key = Trim(CStr(allData(i, encCol)))
        If key = "" Or lastIdx(key) = i Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    wsEfc.Range(wsEfc.Cells(2, 1), wsEfc.Cells(1 + keepCount, lastCol)).Value = filtData
    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        wsEfc.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    ' --- Build the dup summary from keys with more than one occurrence ---
    Dim k As Variant
    For Each k In occCount.Keys
        If occCount(k) > 1 Then
            dupCount = dupCount + 1
            ReDim Preserve dupSummary(1 To dupCount)
            dupSummary(dupCount) = CStr(k) & " (" & occCount(k) & " occurrences collapsed)"
        End If
    Next k

    Application.ScreenUpdating = True
End Sub

' Returns True if comment contains any of phrases(1..phraseCount) as a
' substring. comment must already be UCase'd by the caller.
Public Function MatchesAnyPhrase(comment As String, phrases() As String, phraseCount As Long) As Boolean
    Dim i As Long
    For i = 1 To phraseCount
        If InStr(comment, phrases(i)) > 0 Then
            MatchesAnyPhrase = True
            Exit Function
        End If
    Next i
    MatchesAnyPhrase = False
End Function

' Loads a Config phrase/value list by header name, falling back to defaults
' (pass as Array("A", "B", ...)) if the Config sheet or that column is
' missing/empty. Callers load once, before a per-row loop -- see
' IdentifySmsRequired -- never re-reading Config per row.
Public Sub LoadPhraseList(configHeader As String, defaults As Variant, ByRef outList() As String, ByRef outCount As Long)
    outList = ReadConfigList(configHeader, outCount)
    If outCount = 0 Then
        Dim n As Long
        n = UBound(defaults) - LBound(defaults) + 1
        ReDim outList(1 To n)
        Dim i As Long
        For i = 1 To n
            outList(i) = CStr(defaults(LBound(defaults) + i - 1))
        Next i
        outCount = n
    End If
End Sub

' Reads Comment per row and appends an "MCAF Reminder" column with one of:
'   "SMS REQUIRED"                     -- FC DONE / PHONE FC DONE + MCAF REMINDER found
'   "NO FC DONE / WARD CLASS SELECTED" -- needs FC follow-up, not an SMS case
'   ""                                 -- neither pattern matched
' Direct port of the manual SOP's IF formula (SOP step 3) -- not re-derived.
' Phrase lists come from the Config sheet (MatchesAnyPhrase/LoadPhraseList,
' ConfigReader.bas), falling back to the hardcoded defaults below if Config
' is absent. "NO FC DONE" is checked first and excluded from the "FC DONE"
' match so the substring "FC DONE" inside "NO FC DONE" doesn't cause a
' false SMS REQUIRED.
Public Sub IdentifySmsRequired(wsEfc As Worksheet)
    Dim commentHeader As String, encHeader As String
    commentHeader = GetSetting("eFC Comment Header", "Comment")
    encHeader = GetSetting("eFC Encounter No Header", "Encounter No")

    Dim commentCol As Long
    commentCol = FindColByHeader(wsEfc, commentHeader)
    If commentCol = 0 Then
        MsgBox "Error: eFC file is missing the '" & commentHeader & "' column.", vbExclamation, "Missing Column"
        Exit Sub
    End If

    Dim encCol As Long
    encCol = FindColByHeader(wsEfc, encHeader)
    If encCol = 0 Then Exit Sub

    Dim lastRow As Long
    lastRow = wsEfc.Cells(wsEfc.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then Exit Sub

    Dim lastCol As Long
    lastCol = wsEfc.Cells(1, wsEfc.Columns.Count).End(xlToLeft).Column
    Dim mcafCol As Long
    mcafCol = lastCol + 1
    wsEfc.Cells(1, mcafCol).Value = "MCAF Reminder"

    Application.ScreenUpdating = False

    Dim mcafPhrases() As String, mcafCount As Long
    Dim fcDonePhrases() As String, fcDoneCount As Long
    Dim noFcDonePhrases() As String, noFcDoneCount As Long
    Dim wardClassPhrases() As String, wardClassCount As Long
    LoadPhraseList "MCAF Reminder Phrases", Array("MCAF REMINDER"), mcafPhrases, mcafCount
    LoadPhraseList "FC Done Phrases", Array("FC DONE", "PHONE FC DONE"), fcDonePhrases, fcDoneCount
    LoadPhraseList "No FC Done Phrases", Array("NO FC DONE"), noFcDonePhrases, noFcDoneCount
    LoadPhraseList "Ward Class Phrases", Array("WARD CLASS SELECTED"), wardClassPhrases, wardClassCount

    Dim commentData As Variant
    commentData = wsEfc.Range(wsEfc.Cells(2, commentCol), wsEfc.Cells(lastRow, commentCol)).Value

    Dim flagOut() As Variant
    ReDim flagOut(1 To lastRow - 1, 1 To 1)

    Dim i As Long, comment As String
    Dim isMcaf As Boolean, isNoFcDone As Boolean, isWardClass As Boolean, isFcDone As Boolean

    For i = 1 To UBound(commentData, 1)
        comment = UCase(Trim(CStr(commentData(i, 1))))
        isMcaf = MatchesAnyPhrase(comment, mcafPhrases, mcafCount)
        isNoFcDone = MatchesAnyPhrase(comment, noFcDonePhrases, noFcDoneCount)
        isWardClass = MatchesAnyPhrase(comment, wardClassPhrases, wardClassCount)
        isFcDone = MatchesAnyPhrase(comment, fcDonePhrases, fcDoneCount) And Not isNoFcDone

        If isFcDone And isMcaf Then
            flagOut(i, 1) = "SMS REQUIRED"
        ElseIf isNoFcDone Or isWardClass Then
            flagOut(i, 1) = "NO FC DONE / WARD CLASS SELECTED"
        Else
            flagOut(i, 1) = ""
        End If
    Next i

    wsEfc.Range(wsEfc.Cells(2, mcafCol), wsEfc.Cells(lastRow, mcafCol)).Value = flagOut

    Application.ScreenUpdating = True
End Sub

' For every row flagged "SMS REQUIRED" by IdentifySmsRequired, looks up Phone
' from wsEpic by CSN = Encounter No (constraint #4 in the design spec) and
' writes it into three new "1st/2nd/3rd Phone Number" columns appended after
' "MCAF Reminder" -- matching the SMS TEMPLATE's own H/I/J columns (all three
' raw candidates, not collapsed to one; see ExtractMobileNumbers). No Bed
' lookup -- dropped 2026-07-21: the columns actually used from the SMS
' TEMPLATE (Encounter No, MRN, Patient Name, 1st/2nd/3rd Phone Number) don't
' include Bed, so there was nothing for a Bed value to feed. Rows with no
' Epic match are left blank on all three -- BuildReviewList
' (BroadcastBuilder.bas) already routes any row with no usable candidate to
' "Needs Manual Lookup" rather than dropping it. Bulk dictionary join, same
' pattern as the MFC macro's Epic lookup (EpicLookup.bas) -- one bulk read of
' Epic, one pass over eFC.
Public Sub JoinPhoneFromEpic(wsEfc As Worksheet, wsEpic As Worksheet)
    Dim epicCSNCol As Long, epicPhoneCol As Long
    epicCSNCol = FindColByHeader(wsEpic, GetSetting("Epic CSN Header", "CSN"))
    epicPhoneCol = FindColByHeader(wsEpic, GetSetting("Epic Phone Header", "Phone"))
    If epicCSNCol = 0 Or epicPhoneCol = 0 Then
        MsgBox "Error: Epic file is missing required columns for the Phone join.", vbExclamation, "Missing Column"
        Exit Sub
    End If

    Dim encCol As Long, mcafCol As Long
    encCol = FindColByHeader(wsEfc, GetSetting("eFC Encounter No Header", "Encounter No"))
    mcafCol = FindColByHeader(wsEfc, "MCAF Reminder")
    If encCol = 0 Or mcafCol = 0 Then Exit Sub   ' IdentifySmsRequired hasn't run yet

    Dim lastRowEfc As Long
    lastRowEfc = wsEfc.Cells(wsEfc.Rows.Count, encCol).End(xlUp).Row
    If lastRowEfc < 2 Then Exit Sub

    Dim lastRowEpic As Long
    lastRowEpic = wsEpic.Cells(wsEpic.Rows.Count, 1).End(xlUp).Row
    If lastRowEpic < 2 Then Exit Sub

    Application.ScreenUpdating = False

    ' --- Bulk-load Epic into CSN-keyed dictionaries, one per candidate slot ---
    Dim epicLastCol As Long
    epicLastCol = Application.WorksheetFunction.Max(epicCSNCol, epicPhoneCol)
    Dim epicData As Variant
    epicData = wsEpic.Range(wsEpic.Cells(1, 1), wsEpic.Cells(lastRowEpic, epicLastCol)).Value

    Dim dictPhone1 As Object, dictPhone2 As Object, dictPhone3 As Object
    Set dictPhone1 = CreateObject("Scripting.Dictionary")
    Set dictPhone2 = CreateObject("Scripting.Dictionary")
    Set dictPhone3 = CreateObject("Scripting.Dictionary")

    Dim i As Long, csn As String, p1 As String, p2 As String, p3 As String
    For i = 2 To lastRowEpic
        csn = Trim(CStr(epicData(i, epicCSNCol)))
        ExtractMobileNumbers CStr(epicData(i, epicPhoneCol)), p1, p2, p3
        dictPhone1(csn) = p1
        dictPhone2(csn) = p2
        dictPhone3(csn) = p3
    Next i

    ' --- Append "1st/2nd/3rd Phone Number" right after "MCAF Reminder" ---
    Dim phone1OutCol As Long, phone2OutCol As Long, phone3OutCol As Long
    phone1OutCol = mcafCol + 1
    phone2OutCol = mcafCol + 2
    phone3OutCol = mcafCol + 3
    wsEfc.Cells(1, phone1OutCol).Value = "1st Phone Number"
    wsEfc.Cells(1, phone2OutCol).Value = "2nd Phone Number"
    wsEfc.Cells(1, phone3OutCol).Value = "3rd Phone Number"

    Dim efcData As Variant
    efcData = wsEfc.Range(wsEfc.Cells(2, 1), wsEfc.Cells(lastRowEfc, mcafCol)).Value

    Dim phone1Out() As Variant, phone2Out() As Variant, phone3Out() As Variant
    ReDim phone1Out(1 To lastRowEfc - 1, 1 To 1)
    ReDim phone2Out(1 To lastRowEfc - 1, 1 To 1)
    ReDim phone3Out(1 To lastRowEfc - 1, 1 To 1)

    Dim encNo As String, flag As String
    For i = 1 To UBound(efcData, 1)
        flag = Trim(CStr(efcData(i, mcafCol)))
        If flag = "SMS REQUIRED" Then
            encNo = Trim(CStr(efcData(i, encCol)))
            If dictPhone1.Exists(encNo) Then
                phone1Out(i, 1) = dictPhone1(encNo)
                phone2Out(i, 1) = dictPhone2(encNo)
                phone3Out(i, 1) = dictPhone3(encNo)
            Else
                phone1Out(i, 1) = ""
                phone2Out(i, 1) = ""
                phone3Out(i, 1) = ""
            End If
        Else
            phone1Out(i, 1) = ""
            phone2Out(i, 1) = ""
            phone3Out(i, 1) = ""
        End If
    Next i

    wsEfc.Range(wsEfc.Cells(2, phone1OutCol), wsEfc.Cells(lastRowEfc, phone1OutCol)).Value = phone1Out
    wsEfc.Range(wsEfc.Cells(2, phone2OutCol), wsEfc.Cells(lastRowEfc, phone2OutCol)).Value = phone2Out
    wsEfc.Range(wsEfc.Cells(2, phone3OutCol), wsEfc.Cells(lastRowEfc, phone3OutCol)).Value = phone3Out

    Application.ScreenUpdating = True
End Sub

' Ports the SMS TEMPLATE workbook's "1st/2nd/3rd phone number" formulas
' (columns H/I/J): Epic's raw phone field looks like
'   "*9327 2613 (Mobile)" & vbCrLf & "6677 1216 (Home Phone)" & vbCrLf & "9664 9678 (Work Phone)"
' -- one or more labelled numbers, asterisks marking a preferred number, and
' line breaks between entries. Strips spaces and asterisks (matching the
' template's inline SUBSTITUTE(SUBSTITUTE(G2," ",""),"*","") step), then scans
' left to right for up to three non-overlapping 8-digit runs starting with
' "8" or "9" (the SG mobile prefixes), writing them into num1/num2/num3 in
' the order found. Deliberately does NOT reject Epic's "88888888"/"99999999"
' placeholder values here -- those are still valid *candidates* to show a
' human reviewer (see ReviewForm), same as the template's own H/I/J don't
' filter them either. Use FirstUsableNumber to pick one for the broadcast file.
Public Sub ExtractMobileNumbers(rawPhone As String, ByRef num1 As String, ByRef num2 As String, ByRef num3 As String)
    num1 = ""
    num2 = ""
    num3 = ""

    Dim cleaned As String
    cleaned = Replace(rawPhone, " ", "")
    cleaned = Replace(cleaned, "*", "")

    Dim n As Long
    n = Len(cleaned)

    Dim found As Long
    found = 0

    Dim i As Long, ch As String, candidate As String
    i = 1
    Do While i <= n - 7 And found < 3
        ch = Mid(cleaned, i, 1)
        If ch = "8" Or ch = "9" Then
            candidate = Mid(cleaned, i, 8)
            If IsEightDigits(candidate) Then
                found = found + 1
                Select Case found
                    Case 1: num1 = candidate
                    Case 2: num2 = candidate
                    Case 3: num3 = candidate
                End Select
                i = i + 8   ' non-overlapping: skip past this candidate
            Else
                i = i + 1
            End If
        Else
            i = i + 1
        End If
    Loop
End Sub

' Loads the "Epic Placeholder Numbers" Config list once (falls back to
' 88888888/99999999) -- callers pass the result into FirstUsableNumber so a
' bulk-processing loop doesn't re-read Config per row.
Public Sub LoadPlaceholderList(ByRef outList() As String, ByRef outCount As Long)
    LoadPhraseList "Epic Placeholder Numbers", Array("88888888", "99999999"), outList, outCount
End Sub

' Picks the single number that goes into the final broadcast file (SOP step
' 5/9 requires exactly one "Mobile Number" per row) -- the first of the
' three candidates that isn't blank or a configured placeholder value.
' ReviewForm still shows all three raw candidates so PSA can see and
' override what got picked, rather than this decision being made invisibly.
Public Function FirstUsableNumber(num1 As String, num2 As String, num3 As String, _
                                   placeholders() As String, placeholderCount As Long) As String
    If IsUsableNumber(num1, placeholders, placeholderCount) Then
        FirstUsableNumber = num1
    ElseIf IsUsableNumber(num2, placeholders, placeholderCount) Then
        FirstUsableNumber = num2
    ElseIf IsUsableNumber(num3, placeholders, placeholderCount) Then
        FirstUsableNumber = num3
    Else
        FirstUsableNumber = ""
    End If
End Function

Private Function IsUsableNumber(num As String, placeholders() As String, placeholderCount As Long) As Boolean
    If num = "" Then
        IsUsableNumber = False
        Exit Function
    End If

    Dim i As Long
    For i = 1 To placeholderCount
        If num = placeholders(i) Then
            IsUsableNumber = False
            Exit Function
        End If
    Next i

    IsUsableNumber = True
End Function

' True if s is exactly 8 characters, all digits 0-9.
Private Function IsEightDigits(s As String) As Boolean
    If Len(s) <> 8 Then
        IsEightDigits = False
        Exit Function
    End If

    Dim k As Long, c As String
    For k = 1 To 8
        c = Mid(s, k, 1)
        If c < "0" Or c > "9" Then
            IsEightDigits = False
            Exit Function
        End If
    Next k

    IsEightDigits = True
End Function

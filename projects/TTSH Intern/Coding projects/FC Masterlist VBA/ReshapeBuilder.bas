Attribute VB_Name = "ReshapeBuilder"
Option Explicit

' ============================================================
' ReshapeBuilder.bas
'
' Long -> wide reshape of the Data Entry sheet, keyed on Employee No.
' Each employee's multiple training/competency-cycle rows are collapsed
' into a single row, with one repeating column block per cycle
' (chronological order by Calendar Year of Competence / Date of Competence).
'
' Non-destructive: writes to a NEW "Data Entry (Wide)" sheet. The original
' Data Entry sheet is never modified by this module.
'
' Rows with a blank Employee No. are NOT merged with each other -- each is
' kept as its own row and flagged "NO EMPLOYEE NO." in Data Quality Flags,
' since there is no safe way to tell whether two blank-key rows belong to
' the same person.
'
' "Resigned" column + grey row fill: the original Data Entry sheet greyed out
' resigned staff via conditional formatting keyed on an "Employment (Y/N)"
' column that is now empty (confirmed -- 0 of 511 rows have anything in it).
' Substitute signal, per Lutfil: 84 rows have literal "Resigned"/"Resign and
' left on ..." text in the FC Certificate Number column instead -- any row
' in a group matching that (case-insensitive "resign" substring) marks the
' whole merged employee row as Resigned = "Yes" and fills it grey.
' ============================================================

Private Const COLS_PER_CYCLE As Long = 7

Public Function BuildWideMasterlist(wsSource As Worksheet, dict As Object) As Worksheet
    Dim wb As Workbook
    Set wb = wsSource.Parent

    ' --- Resolve source columns by header (never hardcode positions) ---
    Dim cEmpNo As Long, cName As Long, cADID As Long, cDesig As Long, cDept As Long, cEmail As Long
    Dim cYear As Long, cFCFund As Long, cEFCStage As Long, cCalYear As Long, cCompetency As Long
    Dim cDateComp As Long, cAttempts As Long, cCert As Long
    Dim cA1Date As Long, cA1By As Long, cA1Result As Long
    Dim cA2Date As Long, cA2By As Long, cA2Result As Long
    Dim cA3Date As Long, cA3By As Long, cA3Result As Long
    Dim cA4Date As Long, cA4By As Long, cA4Result As Long

    cEmpNo = FindColByHeader(wsSource, "Employee No.")
    cName = FindColByHeader(wsSource, "Name")
    cADID = FindColByHeader(wsSource, "ADID")
    cDesig = FindColByHeader(wsSource, "Designation")
    cDept = FindColByHeader(wsSource, "Department")
    cEmail = FindColByHeader(wsSource, "Email")
    cYear = FindColByHeader(wsSource, "Year of training")
    cFCFund = FindColByHeader(wsSource, "Date of FC Fundamentals")
    cEFCStage = FindColByHeader(wsSource, "Date of eFC Stages")
    cCalYear = FindColByHeader(wsSource, "Calendar Year of Competence")
    cCompetency = FindColByHeader(wsSource, "Competency")
    cDateComp = FindColByHeader(wsSource, "Date of Competence")
    cAttempts = FindColByHeader(wsSource, "No. of Attempts")
    cCert = FindColByHeader(wsSource, "FC Certificate Number")
    cA1Date = FindColByHeader(wsSource, "1st Assessment Date")
    cA1By = 0 ' resolved below -- "Assessed By" appears 4x, must resolve positionally relative to each Assessment Date
    cA1Result = FindColByHeader(wsSource, "1st Result")
    cA2Date = FindColByHeader(wsSource, "2nd Assessment Date")
    cA2Result = FindColByHeader(wsSource, "2nd Result")
    cA3Date = FindColByHeader(wsSource, "3rd Assessment Date")
    cA3Result = FindColByHeader(wsSource, "3rd Result")
    cA4Date = FindColByHeader(wsSource, "4th Assessment Date")
    cA4Result = FindColByHeader(wsSource, "4th Result")

    ' "Assessed By" is a repeated, non-unique header -- FindColByHeader only finds the
    ' first match. Each "Assessed By" column sits immediately after its Assessment Date
    ' column in the source layout (verified against the workbook, not assumed from docs
    ' per the standing rule) -- resolve them positionally from that anchor.
    If cA1Date > 0 Then cA1By = cA1Date + 1
    If cA2Date > 0 Then cA2By = cA2Date + 1
    If cA3Date > 0 Then cA3By = cA3Date + 1
    If cA4Date > 0 Then cA4By = cA4Date + 1

    If cEmpNo = 0 Then
        MsgBox "Could not find an 'Employee No.' column on the Data Entry sheet -- cannot reshape.", vbCritical
        Set BuildWideMasterlist = Nothing
        Exit Function
    End If

    Dim lastRow As Long
    lastRow = wsSource.Cells(wsSource.Rows.Count, cEmpNo).End(xlUp).Row
    If lastRow < 2 Then
        Set BuildWideMasterlist = Nothing
        Exit Function
    End If

    ' Uses LastUsedColumn (not a plain header-row scan) -- Data Entry has
    ' columns beyond the last named header that still contain real data
    ' (see Helpers.DescribeUnlabeledColumnsWithData). A header-only scan would
    ' silently truncate the read range before those columns.
    Dim lastCol As Long
    lastCol = LastUsedColumn(wsSource)

    Dim data As Variant
    data = wsSource.Range(wsSource.Cells(2, 1), wsSource.Cells(lastRow, lastCol)).Value

    Dim nRows As Long
    nRows = UBound(data, 1)

    ' --- Group row indices (into `data`) by Employee No. ---
    ' Blank Employee No. rows get a unique synthetic key so they never merge together.
    Dim groups As Object
    Set groups = CreateObject("Scripting.Dictionary")

    Dim r As Long
    Dim empNoRaw As String, key As String
    Dim blankCounter As Long
    blankCounter = 0

    For r = 1 To nRows
        ' An error value (e.g. #N/A from a broken lookup elsewhere in the
        ' sheet) in Employee No. is treated the same as blank -- there's no
        ' reliable identifier to group on, so it stays its own singleton row
        ' rather than being lumped in with other error-valued rows under a
        ' literal "#ERROR" key.
        If IsErrorValue(data(r, cEmpNo)) Then
            empNoRaw = ""
        Else
            empNoRaw = Trim(SafeStr(data(r, cEmpNo)))
        End If
        If Len(empNoRaw) = 0 Then
            blankCounter = blankCounter + 1
            key = "__NOEMPNO__" & blankCounter
        Else
            key = UCase(empNoRaw)
        End If

        If Not groups.Exists(key) Then
            groups.Add key, New Collection
        End If
        groups(key).Add r
    Next r

    ' --- Determine max cycles across all groups (needed for column count) ---
    Dim maxCycles As Long
    maxCycles = 1
    Dim k As Variant
    For Each k In groups.Keys
        If groups(k).Count > maxCycles Then maxCycles = groups(k).Count
    Next k

    ' --- Create (or clear) the output sheet ---
    Dim wsOut As Worksheet
    On Error Resume Next
    Set wsOut = wb.Sheets("Data Entry (Wide)")
    On Error GoTo 0
    If Not wsOut Is Nothing Then
        Application.DisplayAlerts = False
        wsOut.Delete
        Application.DisplayAlerts = True
    End If
    Set wsOut = wb.Sheets.Add(After:=wsSource)
    wsOut.Name = "Data Entry (Wide)"

    ' --- Write headers ---
    Dim headers() As String
    Dim nStaticCols As Long
    nStaticCols = 12
    ReDim headers(1 To nStaticCols + maxCycles * COLS_PER_CYCLE)

    headers(1) = "Employee No."
    headers(2) = "Name"
    headers(3) = "ADID"
    headers(4) = "Email"
    headers(5) = "Designation (Canonical)"
    headers(6) = "Department"
    headers(7) = "Employment Type"
    headers(8) = "Date of FC Fundamentals"
    headers(9) = "Date of eFC Stages"
    headers(10) = "No. of Training Records"
    headers(11) = "Resigned"
    headers(12) = "Data Quality Flags"

    Dim cyc As Long
    Dim baseIdx As Long
    For cyc = 1 To maxCycles
        baseIdx = nStaticCols + (cyc - 1) * COLS_PER_CYCLE
        headers(baseIdx + 1) = "Cycle " & cyc & " - Year of Training"
        headers(baseIdx + 2) = "Cycle " & cyc & " - Calendar Year of Competence"
        headers(baseIdx + 3) = "Cycle " & cyc & " - Competency Result"
        headers(baseIdx + 4) = "Cycle " & cyc & " - Date of Competence"
        headers(baseIdx + 5) = "Cycle " & cyc & " - No. of Attempts"
        headers(baseIdx + 6) = "Cycle " & cyc & " - Assessed By (Final)"
        headers(baseIdx + 7) = "Cycle " & cyc & " - FC Certificate Number"
    Next cyc

    Dim c As Long
    For c = 1 To UBound(headers)
        wsOut.Cells(1, c).Value = headers(c)
    Next c
    wsOut.Range(wsOut.Cells(1, 1), wsOut.Cells(1, UBound(headers))).Font.Bold = True
    wsOut.Range(wsOut.Cells(1, 1), wsOut.Cells(1, UBound(headers))).Interior.Color = RGB(31, 73, 125)
    wsOut.Range(wsOut.Cells(1, 1), wsOut.Cells(1, UBound(headers))).Font.Color = RGB(255, 255, 255)

    ' --- Write one output row per group ---
    Dim outRow As Long
    outRow = 2

    For Each k In groups.Keys
        Dim rows As Collection
        Set rows = groups(k)

        ' Sort this group's row indices chronologically by best-available date:
        ' Date of Competence, else Calendar Year of Competence, else Year of training.
        Dim ordered() As Long
        ReDim ordered(1 To rows.Count)
        Dim i As Long
        For i = 1 To rows.Count
            ordered(i) = rows(i)
        Next i
        SortByCycleDate ordered, data, cDateComp, cCalYear, cYear

        ' Running "latest non-blank wins" identity fields
        Dim finName As String, finADID As String, finEmail As String
        Dim finDesigRaw As String, finDept As String
        Dim fcFundDate As Variant, efcStageDate As Variant
        Dim fcFundInconsistent As Boolean, efcStageInconsistent As Boolean
        fcFundDate = Empty: efcStageDate = Empty
        fcFundInconsistent = False: efcStageInconsistent = False

        ' Resignation flag: the original "Employment (Y/N)" column that drove
        ' grey conditional-formatting highlighting is empty in this workbook
        ' (confirmed -- 0 of 511 rows have anything in it), so it can't be
        ' used. Staff have been recording resignations as literal text in the
        ' FC Certificate Number column instead ("Resigned", "Resign and left
        ' on ...") -- use that as the substitute signal, per Lutfil.
        Dim isResigned As Boolean
        isResigned = False

        ' Tracks whether any raw cell touched below was an Excel error value
        ' (#N/A, #REF!, #VALUE!, etc.) rather than a real value -- this is
        ' what caused "error 2042": a broken formula elsewhere in the sheet
        ' left #N/A in a source cell, and code tried to CStr() it directly.
        ' Error cells are now treated as blank (never overwrite a good value,
        ' never used in date comparisons) and flagged for review instead of
        ' crashing or being silently swallowed.
        Dim sourceErrorCols As String
        sourceErrorCols = ""

        For i = 1 To UBound(ordered)
            r = ordered(i)
            If cName > 0 And IsErrorValue(data(r, cName)) Then sourceErrorCols = FlagCol(sourceErrorCols, "Name")
            If cName > 0 And Not IsErrorValue(data(r, cName)) And Len(SafeStr(data(r, cName))) > 0 Then finName = SafeStr(data(r, cName))

            If cADID > 0 And IsErrorValue(data(r, cADID)) Then sourceErrorCols = FlagCol(sourceErrorCols, "ADID")
            If cADID > 0 And Not IsErrorValue(data(r, cADID)) And Len(SafeStr(data(r, cADID))) > 0 Then finADID = SafeStr(data(r, cADID))

            If cEmail > 0 And IsErrorValue(data(r, cEmail)) Then sourceErrorCols = FlagCol(sourceErrorCols, "Email")
            If cEmail > 0 And Not IsErrorValue(data(r, cEmail)) And Len(SafeStr(data(r, cEmail))) > 0 Then finEmail = SafeStr(data(r, cEmail))

            If cDesig > 0 And IsErrorValue(data(r, cDesig)) Then sourceErrorCols = FlagCol(sourceErrorCols, "Designation")
            If cDesig > 0 And Not IsErrorValue(data(r, cDesig)) And Len(SafeStr(data(r, cDesig))) > 0 Then finDesigRaw = SafeStr(data(r, cDesig))

            If cDept > 0 And IsErrorValue(data(r, cDept)) Then sourceErrorCols = FlagCol(sourceErrorCols, "Department")
            If cDept > 0 And Not IsErrorValue(data(r, cDept)) And Len(SafeStr(data(r, cDept))) > 0 Then finDept = CleanText(SafeStr(data(r, cDept)))

            If cFCFund > 0 And IsErrorValue(data(r, cFCFund)) Then sourceErrorCols = FlagCol(sourceErrorCols, "Date of FC Fundamentals")
            If cFCFund > 0 And Not IsErrorValue(data(r, cFCFund)) And Not IsEmpty(data(r, cFCFund)) And Len(SafeStr(data(r, cFCFund))) > 0 Then
                If IsEmpty(fcFundDate) Then
                    fcFundDate = data(r, cFCFund)
                ElseIf data(r, cFCFund) <> fcFundDate Then
                    fcFundInconsistent = True
                End If
            End If

            If cEFCStage > 0 And IsErrorValue(data(r, cEFCStage)) Then sourceErrorCols = FlagCol(sourceErrorCols, "Date of eFC Stages")
            If cEFCStage > 0 And Not IsErrorValue(data(r, cEFCStage)) And Not IsEmpty(data(r, cEFCStage)) And Len(SafeStr(data(r, cEFCStage))) > 0 Then
                If IsEmpty(efcStageDate) Then
                    efcStageDate = data(r, cEFCStage)
                ElseIf data(r, cEFCStage) <> efcStageDate Then
                    efcStageInconsistent = True
                End If
            End If

            If cCert > 0 And IsErrorValue(data(r, cCert)) Then sourceErrorCols = FlagCol(sourceErrorCols, "FC Certificate Number")
            If cCert > 0 And Not IsErrorValue(data(r, cCert)) And InStr(1, SafeStr(data(r, cCert)), "resign", vbTextCompare) > 0 Then
                isResigned = True
            End If
        Next i

        Dim canonical As String, employmentType As String
        Dim wasMapped As Boolean
        If Len(finDesigRaw) > 0 Then
            wasMapped = CanonicalizeDesignation(finDesigRaw, dict, canonical, employmentType)
        Else
            canonical = "": employmentType = "": wasMapped = True
        End If

        Dim flags As String
        flags = ""
        If Left(k, 11) = "__NOEMPNO__" Then flags = AppendFlag(flags, "NO EMPLOYEE NO.")
        If Not wasMapped And Len(finDesigRaw) > 0 Then flags = AppendFlag(flags, "UNMAPPED DESIGNATION: '" & finDesigRaw & "'")
        If fcFundInconsistent Then flags = AppendFlag(flags, "FC Fundamentals date differs across rows")
        If efcStageInconsistent Then flags = AppendFlag(flags, "eFC Stages date differs across rows")
        If Len(sourceErrorCols) > 0 Then flags = AppendFlag(flags, "SOURCE ERROR VALUE (e.g. #N/A) in: " & sourceErrorCols)

        ' --- Write the row ---
        Dim empNoOut As String
        If Left(k, 11) = "__NOEMPNO__" Then
            empNoOut = ""
        Else
            empNoOut = k
        End If

        wsOut.Cells(outRow, 1).Value = empNoOut
        wsOut.Cells(outRow, 2).Value = finName
        wsOut.Cells(outRow, 3).Value = finADID
        wsOut.Cells(outRow, 4).Value = finEmail
        wsOut.Cells(outRow, 5).Value = canonical
        wsOut.Cells(outRow, 6).Value = finDept
        wsOut.Cells(outRow, 7).Value = employmentType
        If Not IsEmpty(fcFundDate) Then wsOut.Cells(outRow, 8).Value = fcFundDate
        If Not IsEmpty(efcStageDate) Then wsOut.Cells(outRow, 9).Value = efcStageDate
        wsOut.Cells(outRow, 10).Value = UBound(ordered)
        If isResigned Then wsOut.Cells(outRow, 11).Value = "Yes"
        wsOut.Cells(outRow, 12).Value = flags

        For i = 1 To UBound(ordered)
            r = ordered(i)
            baseIdx = nStaticCols + (i - 1) * COLS_PER_CYCLE

            If cYear > 0 Then wsOut.Cells(outRow, baseIdx + 1).Value = SafeVal(data(r, cYear))
            If cCalYear > 0 Then wsOut.Cells(outRow, baseIdx + 2).Value = SafeVal(data(r, cCalYear))
            If cCompetency > 0 Then wsOut.Cells(outRow, baseIdx + 3).Value = SafeVal(data(r, cCompetency))
            If cDateComp > 0 Then wsOut.Cells(outRow, baseIdx + 4).Value = SafeVal(data(r, cDateComp))
            If cAttempts > 0 Then wsOut.Cells(outRow, baseIdx + 5).Value = SafeVal(data(r, cAttempts))
            wsOut.Cells(outRow, baseIdx + 6).Value = FinalAssessedBy(data, r, cA1By, cA2By, cA3By, cA4By)
            If cCert > 0 Then wsOut.Cells(outRow, baseIdx + 7).Value = SafeVal(data(r, cCert))
        Next i

        ' Grey out the whole row for resigned staff -- matches the original
        ' Data Entry sheet's grey/resigned convention (confirmed via its
        ' conditional-formatting rule; approximated here as a flat fill since
        ' the underlying source column that rule depended on is gone).
        If isResigned Then
            wsOut.Range(wsOut.Cells(outRow, 1), wsOut.Cells(outRow, UBound(headers))).Interior.Color = RGB(166, 166, 166)
        End If

        outRow = outRow + 1
    Next k

    wsOut.Columns.AutoFit
    wsOut.Rows(1).AutoFilter

    Set BuildWideMasterlist = wsOut
End Function

' Returns the last non-blank "Assessed By" value across the 4 assessment
' rounds for row r (i.e. whoever conducted the FINAL attempt).
Private Function FinalAssessedBy(data As Variant, r As Long, _
        c1 As Long, c2 As Long, c3 As Long, c4 As Long) As String
    Dim result As String
    result = ""
    If c1 > 0 And Not IsErrorValue(data(r, c1)) And Len(SafeStr(data(r, c1))) > 0 Then result = SafeStr(data(r, c1))
    If c2 > 0 And Not IsErrorValue(data(r, c2)) And Len(SafeStr(data(r, c2))) > 0 Then result = SafeStr(data(r, c2))
    If c3 > 0 And Not IsErrorValue(data(r, c3)) And Len(SafeStr(data(r, c3))) > 0 Then result = SafeStr(data(r, c3))
    If c4 > 0 And Not IsErrorValue(data(r, c4)) And Len(SafeStr(data(r, c4))) > 0 Then result = SafeStr(data(r, c4))
    FinalAssessedBy = result
End Function

Private Function AppendFlag(existing As String, newFlag As String) As String
    If Len(existing) = 0 Then
        AppendFlag = newFlag
    Else
        AppendFlag = existing & " | " & newFlag
    End If
End Function

' Appends colName to a comma-separated list, skipping it if already present
' (a group can hit the same error column across multiple of its rows).
Private Function FlagCol(existing As String, colName As String) As String
    If InStr(1, existing, colName, vbTextCompare) > 0 Then
        FlagCol = existing
    ElseIf Len(existing) = 0 Then
        FlagCol = colName
    Else
        FlagCol = existing & ", " & colName
    End If
End Function

' NzStr/NzVal were this module's private null-safe accessors -- superseded by
' Helpers.SafeStr/SafeVal, which additionally guard against Excel error
' values (see the comment on SafeStr in Helpers.bas for why that matters).

' In-place insertion sort of a small array of row indices, ordered by the best
' available date proxy: Date of Competence, else Calendar Year of Competence,
' else Year of training. Group sizes here are small (single digits), so an
' O(n^2) insertion sort is simpler and plenty fast -- no need for anything fancier.
Private Sub SortByCycleDate(ByRef ordered() As Long, data As Variant, _
        cDateComp As Long, cCalYear As Long, cYear As Long)
    Dim i As Long, j As Long, tmp As Long
    For i = 2 To UBound(ordered)
        tmp = ordered(i)
        j = i - 1
        Do While j >= 1
            If SortKey(data, ordered(j), cDateComp, cCalYear, cYear) > _
               SortKey(data, tmp, cDateComp, cCalYear, cYear) Then
                ordered(j + 1) = ordered(j)
                j = j - 1
            Else
                Exit Do
            End If
        Loop
        ordered(j + 1) = tmp
    Next i
End Sub

Private Function SortKey(data As Variant, r As Long, cDateComp As Long, cCalYear As Long, cYear As Long) As Double
    If cDateComp > 0 And IsDate(data(r, cDateComp)) Then
        SortKey = CDbl(CDate(data(r, cDateComp)))
    ElseIf cCalYear > 0 And IsDate(data(r, cCalYear)) Then
        SortKey = CDbl(CDate(data(r, cCalYear)))
    ElseIf cYear > 0 And IsNumeric(data(r, cYear)) Then
        SortKey = CDbl(data(r, cYear)) * 10000 ' coarse fallback, year-only precision
    Else
        SortKey = 0
    End If
End Function

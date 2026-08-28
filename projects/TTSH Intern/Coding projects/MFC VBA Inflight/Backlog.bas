Attribute VB_Name = "Backlog"
Option Explicit

' ============================================================
' Backlog.bas
'
' BacklogSummary (Public) -- compares the output against the previous MFC
' report, carries forward Staff Follow Up (col C) for still-open cases,
' applies yellow fill to backlog rows, and computes Total/Backlog counts.
'   LoadPreviousMFC   -- builds lookup dictionaries from the previous report
'   ApplyCarryForward -- copies col C (Staff Follow Up) for matching encounters,
'                        highlights backlog rows yellow
'   TagAndGroupNCID   -- tags NCID ward rows with Case Status = "NCID"
'                        and sorts them to the bottom of the report
' ============================================================


' Compares output against previous MFC, carries forward Staff Follow Up
' (col C), highlights backlog rows yellow, tags NCID rows, and writes counts.
Public Sub BacklogSummary(outWs As Worksheet, prevWs As Worksheet, _
                           ByRef outTotalCases As Long, ByRef outBacklogCount As Long)

    Dim hdr() As String
    hdr = GetOutputHeaders()

    Dim encCol As Long
    encCol = FindColByHeader(outWs, hdr(7))
    If encCol = 0 Then encCol = FindColByHeader(outWs, "Encounter Number")
    If encCol = 0 Then encCol = 7

    ' Build lookup dictionaries from the previous MFC report
    Dim prevEncs As Object
    Dim carryFwd As Object
    Set prevEncs = CreateObject("Scripting.Dictionary")
    Set carryFwd = CreateObject("Scripting.Dictionary")
    LoadPreviousMFC prevWs, prevEncs, carryFwd

    ' Load output Encounter Number column into memory
    Dim outLastRow As Long
    outLastRow = outWs.Cells(outWs.Rows.Count, encCol).End(xlUp).Row
    Dim outEncData As Variant
    If outLastRow = 2 Then
        ReDim outEncData(1 To 1, 1 To 1)
        outEncData(1, 1) = outWs.Cells(2, encCol).Value
    Else
        outEncData = outWs.Range(outWs.Cells(2, encCol), outWs.Cells(outLastRow, encCol)).Value
    End If

    ' Write carry-forward values and yellow backlog fill, receive case counts
    Dim totalCases   As Long
    Dim backlogCount As Long
    ApplyCarryForward outWs, outLastRow, outEncData, prevEncs, carryFwd, totalCases, backlogCount

    ' Tag NCID ward rows and sort: backlog, new cases, NCID at bottom
    TagAndGroupNCID outWs, prevEncs

    outWs.Parent.Save

    outTotalCases   = totalCases
    outBacklogCount = backlogCount

End Sub


' Loads the previous MFC sheet into two dictionaries.
' prevEncs:  Encounter Number -> True  (non-Resolved rows only)
' carryFwd:  Encounter Number -> Array(inflight, dateUpdated, staffFollowUp, remarks)
Private Sub LoadPreviousMFC(prevWs As Worksheet, prevEncs As Object, carryFwd As Object)

    Dim prevEncCol      As Long
    Dim prevStatusCol   As Long
    Dim prevInflightCol As Long
    Dim prevDateCol     As Long
    Dim prevStaffCol    As Long
    Dim prevRemarksCol  As Long

    Dim hdr() As String
    hdr = GetOutputHeaders()

    prevEncCol = FindColByHeader(prevWs, hdr(7))
    If prevEncCol = 0 Then prevEncCol = FindColByHeader(prevWs, "Encounter Number")
    If prevEncCol = 0 Then prevEncCol = FindColByHeader(prevWs, "Encounter No")
    If prevEncCol = 0 Then
        MsgBox "Previous report missing 'Encounter Number'." & vbNewLine & _
               "All cases treated as new.", _
               vbExclamation, "Missing Column"
        Exit Sub
    End If

    prevStatusCol = FindColByHeader(prevWs, hdr(5))
    If prevStatusCol = 0 Then prevStatusCol = FindColByHeader(prevWs, "Case Status")
    If prevStatusCol = 0 Then prevStatusCol = FindColByHeader(prevWs, "Resolution Status")

    prevInflightCol = FindColByHeader(prevWs, hdr(1))
    If prevInflightCol = 0 Then prevInflightCol = FindColByHeader(prevWs, "Inflight FC Status")

    prevDateCol = FindColByHeader(prevWs, hdr(2))
    If prevDateCol = 0 Then prevDateCol = FindColByHeader(prevWs, "Date Updated (DD/MM/YYYY)")
    If prevDateCol = 0 Then prevDateCol = FindColByHeader(prevWs, "Date Updated")

    prevStaffCol = FindColByHeader(prevWs, hdr(3))
    If prevStaffCol = 0 Then prevStaffCol = FindColByHeader(prevWs, "Staff Follow Up (if any)")
    If prevStaffCol = 0 Then prevStaffCol = FindColByHeader(prevWs, "Staff Follow Up")

    prevRemarksCol = FindColByHeader(prevWs, hdr(4))
    If prevRemarksCol = 0 Then prevRemarksCol = FindColByHeader(prevWs, "Remarks")

    Dim prevLastRow As Long
    prevLastRow = prevWs.Cells(prevWs.Rows.Count, prevEncCol).End(xlUp).Row
    If prevLastRow < 2 Then Exit Sub

    ' IIf() is safe here: all arguments are Long values, not array subscripts
    Dim prevLastCol As Long
    prevLastCol = Application.WorksheetFunction.Max(prevEncCol, _
        IIf(prevStatusCol > 0, prevStatusCol, 1), _
        IIf(prevInflightCol > 0, prevInflightCol, 1), _
        IIf(prevDateCol > 0, prevDateCol, 1), _
        IIf(prevStaffCol > 0, prevStaffCol, 1), _
        IIf(prevRemarksCol > 0, prevRemarksCol, 1))
    Dim prevData As Variant
    prevData = prevWs.Range(prevWs.Cells(2, 1), prevWs.Cells(prevLastRow, prevLastCol)).Value

    Dim i As Long
    Dim pEnc As String
    Dim prevStat As String
    For i = 1 To UBound(prevData, 1)
        pEnc = Trim(CStr(prevData(i, prevEncCol)))
        If pEnc <> "" And Not prevEncs.Exists(pEnc) Then
            prevStat = ""
            If prevStatusCol > 0 Then prevStat = UCase(Trim(CStr(prevData(i, prevStatusCol))))
            If prevStat <> "RESOLVED" Then
                prevEncs(pEnc) = True
                ' Use explicit If guards, not IIf() -- IIf() is NOT short-circuit in VBA.
                Dim cfInflight As Variant, cfDate As Variant
                Dim cfStaff As Variant, cfRemarks As Variant
                cfInflight = "" : cfDate = "" : cfStaff = "" : cfRemarks = ""
                If prevInflightCol > 0 Then cfInflight = prevData(i, prevInflightCol)
                If prevDateCol     > 0 Then cfDate     = prevData(i, prevDateCol)
                If prevStaffCol    > 0 Then cfStaff    = prevData(i, prevStaffCol)
                If prevRemarksCol  > 0 Then cfRemarks  = prevData(i, prevRemarksCol)
                carryFwd(pEnc) = Array(cfInflight, cfDate, cfStaff, cfRemarks)
            End If
        End If
    Next i

End Sub


' Scans the output Encounter Number column, counts total and backlog cases,
' then bulk-writes Staff Follow Up (col C) and applies yellow fill to
' backlog rows (cases that appeared in the previous report).
Private Sub ApplyCarryForward(outWs As Worksheet, outLastRow As Long, outEncData As Variant, _
                               prevEncs As Object, carryFwd As Object, _
                               ByRef totalCases As Long, ByRef backlogCount As Long)

    Dim rowCount As Long : rowCount = UBound(outEncData, 1)

    Dim cfWrite()  As Variant
    ReDim cfWrite(1 To rowCount, 1 To 4)

    Dim i As Long
    Dim curEnc As String
    Dim cf As Variant
    Dim backlogRange As Range
    For i = 1 To rowCount
        curEnc = Trim(CStr(outEncData(i, 1)))
        If curEnc <> "" Then
            totalCases = totalCases + 1
            If prevEncs.Exists(curEnc) Then
                backlogCount = backlogCount + 1
                If backlogRange Is Nothing Then
                    Set backlogRange = outWs.Range(outWs.Cells(i + 1, 1), outWs.Cells(i + 1, 15))
                Else
                    Set backlogRange = Union(backlogRange, outWs.Range(outWs.Cells(i + 1, 1), outWs.Cells(i + 1, 15)))
                End If
            End If
            If carryFwd.Exists(curEnc) Then
                cf = carryFwd(curEnc)
                cfWrite(i, 3) = cf(2)  ' Staff Follow Up (only col C carried forward)
            End If
        End If
    Next i

    Application.ScreenUpdating = False
    outWs.Range(outWs.Cells(2, 1), outWs.Cells(outLastRow, 4)).Value = cfWrite
    If Not backlogRange Is Nothing Then
        backlogRange.Interior.Color = RGB(255, 255, 0)
    End If
    Application.ScreenUpdating = True

End Sub


' Tags NCID ward rows and sorts the report into three groups:
'   0 = backlog (in prevEncs)   -- top
'   1 = new cases               -- middle
'   2 = NCID wards              -- bottom
' Uses a temporary helper column so cell formatting moves with the rows.
Private Sub TagAndGroupNCID(outWs As Worksheet, prevEncs As Object)
    Dim hdr() As String
    hdr = GetOutputHeaders()

    Dim bedCol As Long
    bedCol = FindColByHeader(outWs, hdr(13))
    If bedCol = 0 Then bedCol = FindColByHeader(outWs, "Final Bed")
    If bedCol = 0 Then Exit Sub

    Dim resCol As Long
    resCol = FindColByHeader(outWs, hdr(5))
    If resCol = 0 Then resCol = FindColByHeader(outWs, "Case Status")
    If resCol = 0 Then resCol = 5

    Dim encCol As Long
    encCol = FindColByHeader(outWs, hdr(7))
    If encCol = 0 Then encCol = FindColByHeader(outWs, "Encounter Number")
    If encCol = 0 Then encCol = 7

    Dim lastRow As Long
    lastRow = outWs.Cells(outWs.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then Exit Sub

    ' Build NCID tag set: wards in All NCID Wards minus Included NCID Wards
    Dim allWards As Variant
    allWards = GetAllNCIDWards()
    Dim includedWards As Variant
    includedWards = GetIncludedNCIDWards()

    Dim includedSet As Object
    Set includedSet = CreateObject("Scripting.Dictionary")
    Dim w As Long
    For w = LBound(includedWards) To UBound(includedWards)
        includedSet(UCase(Trim(CStr(includedWards(w))))) = True
    Next w

    Dim ncidSet As Object
    Set ncidSet = CreateObject("Scripting.Dictionary")
    For w = LBound(allWards) To UBound(allWards)
        Dim wc As String
        wc = UCase(Trim(CStr(allWards(w))))
        If Not includedSet.Exists(wc) Then ncidSet(wc) = True
    Next w

    Dim dataRows As Long
    dataRows = lastRow - 1

    ' Read bed + encounter columns in bulk
    Dim bedData As Variant
    Dim encData As Variant
    If dataRows = 1 Then
        ReDim bedData(1 To 1, 1 To 1)
        ReDim encData(1 To 1, 1 To 1)
        bedData(1, 1) = outWs.Cells(2, bedCol).Value
        encData(1, 1) = outWs.Cells(2, encCol).Value
    Else
        bedData = outWs.Range(outWs.Cells(2, bedCol), outWs.Cells(lastRow, bedCol)).Value
        encData = outWs.Range(outWs.Cells(2, encCol), outWs.Cells(lastRow, encCol)).Value
    End If

    ' Build sort key (0=backlog, 1=new, 2=NCID) and NCID status arrays
    Dim sortKeys() As Variant
    Dim ncidFlags() As Variant
    ReDim sortKeys(1 To dataRows, 1 To 1)
    ReDim ncidFlags(1 To dataRows, 1 To 1)

    Dim hasNCID As Boolean
    Dim i As Long
    Dim bedVal As String
    Dim curEnc As String
    For i = 1 To dataRows
        bedVal = UCase(Trim(CStr(bedData(i, 1))))

        ' Check NCID first (takes priority over backlog)
        If Len(bedVal) >= 4 Then
            If ncidSet.Exists(Mid(bedVal, 2, 3)) Then
                sortKeys(i, 1) = 2
                ncidFlags(i, 1) = "NCID"
                hasNCID = True
                GoTo NextRow
            End If
        End If

        ' Backlog vs new
        curEnc = Trim(CStr(encData(i, 1)))
        If curEnc <> "" And prevEncs.Exists(curEnc) Then
            sortKeys(i, 1) = 0
        Else
            sortKeys(i, 1) = 1
        End If
NextRow:
    Next i

    Application.ScreenUpdating = False

    ' Write NCID Case Status (only NCID rows get a value; others stay empty)
    If hasNCID Then
        outWs.Range(outWs.Cells(2, resCol), outWs.Cells(lastRow, resCol)).Value = ncidFlags
    End If

    ' Write sort key to temporary helper column and sort
    Const SORT_COL As Long = 16
    outWs.Range(outWs.Cells(2, SORT_COL), outWs.Cells(lastRow, SORT_COL)).Value = sortKeys

    Dim dataRange As Range
    Set dataRange = outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, SORT_COL))

    outWs.Sort.SortFields.Clear
    outWs.Sort.SortFields.Add Key:=outWs.Range(outWs.Cells(2, SORT_COL), outWs.Cells(lastRow, SORT_COL)), _
        SortOn:=xlSortOnValues, Order:=xlAscending, DataOption:=xlSortNormal

    With outWs.Sort
        .SetRange dataRange
        .Header = xlNo
        .MatchCase = False
        .Orientation = xlTopToBottom
        .Apply
    End With

    ' Remove temporary helper column
    outWs.Columns(SORT_COL).Delete

    Application.ScreenUpdating = True

End Sub

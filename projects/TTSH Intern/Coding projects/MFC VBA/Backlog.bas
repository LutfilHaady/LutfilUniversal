Attribute VB_Name = "Backlog"
Option Explicit

' ============================================================
' Backlog.bas
'
' BacklogSummary (Public) -- compares the output against the previous MFC
' report, carries forward manual cols A-D for still-open cases, computes
' Total/Backlog counts, and calls WriteSummaryTable (SummaryTable.bas).
'   LoadPreviousMFC   -- builds lookup dictionaries from the previous report
'   ApplyCarryForward -- copies A-D for matching open encounters
' ============================================================


' Compares output against previous MFC, carries forward manual
' cols A-D, and writes the summary table.
Public Sub BacklogSummary(outWs As Worksheet, prevWs As Worksheet, _
                           ByRef outTotalCases As Long, ByRef outBacklogCount As Long)

    Const ENC_COL As Long = 7   ' Col G -- Encounter Number in output
    Const RES_COL As Long = 5   ' Col E -- Resolution Status in output

    ' Build lookup dictionaries from the previous MFC report
    Dim prevEncs As Object
    Dim carryFwd As Object
    Set prevEncs = CreateObject("Scripting.Dictionary")
    Set carryFwd = CreateObject("Scripting.Dictionary")
    LoadPreviousMFC prevWs, prevEncs, carryFwd

    ' Resolve Resolution Status column (falls back to hardcoded E if header is absent)
    Dim resCol As Long
    resCol = FindColByHeader(outWs, "Resolution Status")
    If resCol = 0 Then resCol = RES_COL

    ' Load output Encounter Number column into memory
    Dim outLastRow As Long
    outLastRow = outWs.Cells(outWs.Rows.Count, ENC_COL).End(xlUp).Row
    Dim outEncData As Variant
    outEncData = outWs.Range(outWs.Cells(2, ENC_COL), outWs.Cells(outLastRow, ENC_COL)).Value

    ' Write carry-forward values and Follow Up flags, receive case counts
    Dim totalCases   As Long
    Dim backlogCount As Long
    ApplyCarryForward outWs, outLastRow, outEncData, resCol, prevEncs, carryFwd, totalCases, backlogCount

    ' Sort output rows: Backlog ("Follow Up" / amber) cases sorted to the top
    If outLastRow >= 2 Then
        Dim dataRange As Range
        Set dataRange = outWs.Range(outWs.Cells(2, 1), outWs.Cells(outLastRow, 16))

        outWs.Sort.SortFields.Clear
        outWs.Sort.SortFields.Add Key:=outWs.Range(outWs.Cells(2, resCol), outWs.Cells(outLastRow, resCol)), _
            SortOn:=xlSortOnValues, Order:=xlDescending, DataOption:=xlSortNormal

        With outWs.Sort
            .SetRange dataRange
            .Header = xlNo
            .MatchCase = False
            .Orientation = xlTopToBottom
            .Apply
        End With
    End If

    WriteSummaryTable outWs, outLastRow + 3, totalCases, backlogCount
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

    prevEncCol = FindColByHeader(prevWs, "Encounter Number")
    If prevEncCol = 0 Then prevEncCol = FindColByHeader(prevWs, "Encounter No")
    If prevEncCol = 0 Then
        MsgBox "Previous report missing 'Encounter Number'." & vbNewLine & _
               "All cases treated as new.", _
               vbExclamation, "Missing Column"
        Exit Sub
    End If

    prevStatusCol   = FindColByHeader(prevWs, "Resolution Status")
    prevInflightCol = FindColByHeader(prevWs, "Inflight FC Status")
    prevDateCol     = FindColByHeader(prevWs, "Date Updated (DD/MM/YYYY)")
    If prevDateCol = 0 Then prevDateCol = FindColByHeader(prevWs, "Date Updated")
    prevStaffCol    = FindColByHeader(prevWs, "Staff Follow Up (if any)")
    If prevStaffCol = 0 Then prevStaffCol = FindColByHeader(prevWs, "Staff Follow Up")
    prevRemarksCol  = FindColByHeader(prevWs, "Remarks")

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
                ' IIf(col>0, prevData(i,col), "") evaluates prevData(i,0) when col=0,
                ' which raises runtime error 9 (subscript out of range).
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
' then bulk-writes carry-forward values (cols A-D) and Follow Up flags (col E)
' in two array writes instead of up to 5 x rowCount individual cell writes.
Private Sub ApplyCarryForward(outWs As Worksheet, outLastRow As Long, outEncData As Variant, _
                               resCol As Long, prevEncs As Object, carryFwd As Object, _
                               ByRef totalCases As Long, ByRef backlogCount As Long)

    Dim rowCount As Long : rowCount = UBound(outEncData, 1)

    ' Pre-size output arrays; empty string overwrites are safe (cols A-D start blank)
    Dim cfWrite()  As Variant
    Dim resWrite() As Variant
    ReDim cfWrite(1 To rowCount, 1 To 4)
    ReDim resWrite(1 To rowCount, 1 To 1)

    Dim i As Long
    Dim curEnc As String
    Dim cf As Variant
    For i = 1 To rowCount
        curEnc = Trim(CStr(outEncData(i, 1)))
        If curEnc <> "" Then
            totalCases = totalCases + 1
            If prevEncs.Exists(curEnc) Then
                backlogCount = backlogCount + 1
                resWrite(i, 1) = "Follow Up"
            End If
            If carryFwd.Exists(curEnc) Then
                cf = carryFwd(curEnc)
                cfWrite(i, 1) = cf(0)  ' Inflight FC Status
                cfWrite(i, 2) = cf(1)  ' Date Updated
                cfWrite(i, 3) = cf(2)  ' Staff Follow Up
                cfWrite(i, 4) = cf(3)  ' Remarks
            End If
        End If
    Next i

    Application.ScreenUpdating = False
    outWs.Range(outWs.Cells(2, 1), outWs.Cells(outLastRow, 4)).Value             = cfWrite
    outWs.Range(outWs.Cells(2, resCol), outWs.Cells(outLastRow, resCol)).Value    = resWrite
    Application.ScreenUpdating = True

End Sub

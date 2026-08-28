Attribute VB_Name = "DesignationCleanup"
Option Explicit

' ============================================================
' DesignationCleanup.bas
'
' Applies formatting cleanup DIRECTLY to the Data Entry sheet's Designation
' and Department columns (this is the "spaces, formatting" half of the
' original cleanup ask -- distinct from the reshape in ReshapeBuilder.bas).
'
'   - Department: CleanText only (trim / nbsp / double-space / trailing period).
'     There is no canonical short-list for Department, so no semantic remapping
'     is attempted here -- only structural cleanup.
'   - Designation: replaced with its canonical form from the Designation Map
'     IF a mapping exists. If a designation is not in the map, it is left as
'     CleanText(original) -- NOT silently guessed -- and counted as unmapped
'     so MainMacro can report it for manual review.
'
' Runs in place on wsSource (modifies the real Data Entry sheet). Run this
' BEFORE ReshapeBuilder so the wide sheet is built from already-cleaned values.
' ============================================================

Public Function CleanDesignationsAndDepartments(wsSource As Worksheet, dict As Object) As Long
    Dim cDesig As Long, cDept As Long
    cDesig = FindColByHeader(wsSource, "Designation")
    cDept = FindColByHeader(wsSource, "Department")

    Dim lastRow As Long
    Dim anchorCol As Long
    anchorCol = FindColByHeader(wsSource, "S/N")
    If anchorCol = 0 Then anchorCol = 1
    lastRow = wsSource.Cells(wsSource.Rows.Count, anchorCol).End(xlUp).Row

    Dim unmappedCount As Long
    unmappedCount = 0

    Dim r As Long
    For r = 2 To lastRow
        ' Uses Helpers.SafeStr/IsErrorValue rather than a bare CStr(...Value) --
        ' a cell holding an Excel error value (#N/A, #REF!, etc., which this
        ' heavily-edited workbook has elsewhere) would otherwise raise a
        ' runtime error matching that error's code (e.g. 2042 for #N/A)
        ' instead of a normal type mismatch. Error cells are left untouched
        ' here (not overwritten with "#ERROR") since this runs in place on
        ' the real Data Entry sheet -- better to skip than to stomp on
        ' whatever the broken formula there needs fixed separately.
        If cDept > 0 And Not IsErrorValue(wsSource.Cells(r, cDept).Value) Then
            Dim deptRaw As String
            deptRaw = SafeStr(wsSource.Cells(r, cDept).Value)
            If Len(Trim(deptRaw)) > 0 Then
                wsSource.Cells(r, cDept).Value = CleanText(deptRaw)
            End If
        End If

        If cDesig > 0 And Not IsErrorValue(wsSource.Cells(r, cDesig).Value) Then
            Dim desigRaw As String
            desigRaw = SafeStr(wsSource.Cells(r, cDesig).Value)
            If Len(Trim(desigRaw)) > 0 Then
                Dim canonical As String, employmentType As String
                Dim wasMapped As Boolean
                wasMapped = CanonicalizeDesignation(desigRaw, dict, canonical, employmentType)
                wsSource.Cells(r, cDesig).Value = canonical
                If Not wasMapped Then unmappedCount = unmappedCount + 1
            End If
        End If
    Next r

    CleanDesignationsAndDepartments = unmappedCount
End Function

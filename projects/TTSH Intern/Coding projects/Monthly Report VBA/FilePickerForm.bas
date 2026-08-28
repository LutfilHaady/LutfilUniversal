VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} FilePickerForm
   Caption         =   "FC Completion Report -- Select Input Files"
   ClientHeight    =   3500
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   7500
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "FilePickerForm"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' ============================================================
' IMPORT NOTE (staff): This module is an Excel UserForm, NOT a
' standard module -- it cannot be pasted into a normal module.
' To install it from FCCompletion_All_Modules.txt:
'   1. In the VBA Editor: Insert > UserForm.
'   2. In the Properties window (F4), set (Name) = FilePickerForm.
'   3. Open the form's code window (F7) and paste everything from
'      the "Option Explicit" line above down to the end of this
'      section (skip the VERSION / Begin / Attribute lines).
' All controls are built automatically when the form opens, so you
' never need to draw anything on the form by hand.
' ============================================================

' Public properties to return the selected workbooks
Public SelectedFileA As Workbook   ' FC Summary Report
Public SelectedFileB As Workbook   ' Inflight Missed FC Report (Missed FC ticked)
Public Cancelled As Boolean

' Module-level folder tracking
Private m_lastFolder As String

' Event-enabled controls
Private WithEvents m_btnFileA As MSForms.CommandButton
Private WithEvents m_btnFileB As MSForms.CommandButton
Private WithEvents m_btnGenerate As MSForms.CommandButton
Private WithEvents m_btnCancel As MSForms.CommandButton

' Label controls (to update status/filenames)
Private m_lblFileAName As MSForms.Label
Private m_lblFileAStatus As MSForms.Label

Private m_lblFileBName As MSForms.Label
Private m_lblFileBStatus As MSForms.Label

Private m_lblWarning As MSForms.Label

' Status flags
Private m_validA As Boolean
Private m_validB As Boolean

Public Function ShowFilePicker() As Boolean
    Cancelled = True
    Set SelectedFileA = Nothing
    Set SelectedFileB = Nothing
    m_lastFolder = ""

    m_validA = False
    m_validB = False

    Me.Show vbModal

    ShowFilePicker = Not Cancelled
End Function

Private Sub UserForm_Initialize()
    Me.Caption = "FC Completion Report -- Select Input Files"
    Me.Width = 510
    Me.Height = 250
    Me.Font.Name = "Tahoma"
    Me.Font.Size = 9.5

    ' Row 1: File A -- FC Summary Report
    CreateLabel "lblFileA", "File A -- FC Summary Report", 20, 15, 460, 15, True
    Set m_btnFileA = CreateButton("btnFileA", "Browse...", 20, 32, 70, 22)
    Set m_lblFileAName = CreateLabel("lblFileAName", "(not selected)", 100, 35, 280, 15, False)
    Set m_lblFileAStatus = CreateLabel("lblFileAStatus", "O", 390, 35, 90, 15, False)
    m_lblFileAStatus.Font.Bold = True

    ' Row 2: File B -- Inflight Missed FC Report
    CreateLabel "lblFileB", "File B -- Inflight Missed FC Report", 20, 70, 460, 15, True
    Set m_btnFileB = CreateButton("btnFileB", "Browse...", 20, 87, 70, 22)
    Set m_lblFileBName = CreateLabel("lblFileBName", "(not selected)", 100, 90, 280, 15, False)
    Set m_lblFileBStatus = CreateLabel("lblFileBStatus", "O", 390, 90, 90, 15, False)
    m_lblFileBStatus.Font.Bold = True

    ' Warning label (duplicate file / blank Missed FC column)
    Set m_lblWarning = CreateLabel("lblWarning", "", 20, 122, 460, 40, False)
    m_lblWarning.ForeColor = RGB(180, 80, 0) ' Dark Orange
    m_lblWarning.Font.Bold = True
    m_lblWarning.Visible = False

    ' Bottom Buttons
    Set m_btnGenerate = CreateButton("btnGenerate", "Generate Report", 240, 175, 110, 26)
    m_btnGenerate.Enabled = False
    Set m_btnCancel = CreateButton("btnCancel", "Cancel", 365, 175, 110, 26)
End Sub

Private Function CreateLabel(name As String, caption As String, left As Single, top As Single, width As Single, height As Single, bold As Boolean) As MSForms.Label
    Dim lbl As MSForms.Label
    Set lbl = Me.Controls.Add("Forms.Label.1", name, True)
    lbl.left = left
    lbl.top = top
    lbl.width = width
    lbl.height = height
    lbl.caption = caption
    If bold Then lbl.Font.Bold = True
    Set CreateLabel = lbl
End Function

Private Function CreateButton(name As String, caption As String, left As Single, top As Single, width As Single, height As Single) As MSForms.CommandButton
    Dim btn As MSForms.CommandButton
    Set btn = Me.Controls.Add("Forms.CommandButton.1", name, True)
    btn.left = left
    btn.top = top
    btn.width = width
    btn.height = height
    btn.caption = caption
    Set CreateButton = btn
End Function

Private Function PickFileWithFolder(title As String) As Workbook
    Dim fd As FileDialog
    Set fd = Application.FileDialog(msoFileDialogFilePicker)
    fd.title = title
    fd.Filters.Clear
    fd.Filters.Add "Excel Files", "*.xlsx; *.xlsm; *.xls"

    If m_lastFolder <> "" Then fd.InitialFileName = m_lastFolder & "\"

    If fd.Show = -1 Then
        Dim filePath As String
        filePath = fd.SelectedItems(1)
        m_lastFolder = Left(filePath, InStrRev(filePath, "\") - 1)
        Set PickFileWithFolder = Workbooks.Open(filePath)
    Else
        Set PickFileWithFolder = Nothing
    End If
    AppActivate Me.Caption  ' return focus to the form after the file dialog closes
End Function

' Recomputes cross-slot state (duplicate-file conflict, Missed FC blank warning,
' and the Generate button) from the current selections. The m_validX flags hold
' ONLY header validity (set by HandleSlotPick); the duplicate conflict is tracked
' locally here so it can never leave a slot stuck invalid after the conflict is
' resolved on the other slot.
Private Sub UpdateValidationStatus()
    Dim isDuplicate As Boolean
    isDuplicate = False

    ' Clear warning
    m_lblWarning.caption = ""
    m_lblWarning.Visible = False

    ' Duplicate file check
    If Not SelectedFileA Is Nothing And Not SelectedFileB Is Nothing Then
        If UCase(SelectedFileA.FullName) = UCase(SelectedFileB.FullName) Then isDuplicate = True
    End If

    If isDuplicate Then
        m_lblWarning.caption = "Same file selected for both File A and File B!"
        m_lblWarning.Visible = True
        ' Reflect the conflict on the File B slot WITHOUT clobbering its header-validity flag.
        m_lblFileBStatus.caption = "X Same file"
        m_lblFileBStatus.ForeColor = RGB(255, 0, 0)
    ElseIf m_validB And Not SelectedFileB Is Nothing Then
        ' No conflict: restore File B's true status (it may have shown "X Same file").
        m_lblFileBStatus.caption = "Valid"
        m_lblFileBStatus.ForeColor = RGB(0, 128, 0)
    End If

    ' Missed FC column entirely blank -- workaround warning (CLAUDE.md)
    If Not isDuplicate And Not SelectedFileB Is Nothing And m_validB Then
        If IsMissedFCColumnBlank(SelectedFileB) Then
            m_lblWarning.caption = "File B's 'Missed FC' column is entirely blank." & vbNewLine & _
                "Re-export with the Missed FC indicator ticked, or use the manual " & _
                "eFC dashboard workaround export."
            m_lblWarning.Visible = True
        End If
    End If

    ' Enable Generate only when both slots are header-valid AND the two files differ.
    m_btnGenerate.Enabled = (m_validA And m_validB And Not isDuplicate)
End Sub

Private Sub m_btnFileA_Click()
    HandleSlotPick SelectedFileA, "Select File A -- FC Summary Report", "FC_SUMMARY", _
                   m_lblFileAName, m_lblFileAStatus, m_validA
End Sub

Private Sub m_btnFileB_Click()
    HandleSlotPick SelectedFileB, "Select File B -- Inflight Missed FC Report", "INFLIGHT_MISSED", _
                   m_lblFileBName, m_lblFileBStatus, m_validB
End Sub

' Shared Browse handler for both slots. Picks a file, closes the slot's previous
' workbook (UNLESS the user re-picked the same file -- Workbooks.Open returns the
' already-open instance, so closing it would invalidate the new reference and
' crash on wb.Name), validates headers, updates the file/status labels, then
' recomputes cross-slot state.
Private Sub HandleSlotPick(ByRef slotWb As Workbook, title As String, fileType As String, _
                           lblFile As MSForms.Label, lblStatus As MSForms.Label, _
                           ByRef validFlag As Boolean)
    Dim wb As Workbook
    Set wb = PickFileWithFolder(title)
    If wb Is Nothing Then Exit Sub      ' user cancelled the dialog -- keep current selection

    ' Release the slot's previous workbook, unless the user re-picked the same file
    ' (Workbooks.Open returns the already-open instance, so closing it would invalidate wb).
    If Not (slotWb Is wb) Then CloseSlotWorkbook slotWb

    Set slotWb = wb
    lblFile.caption = wb.Name
    If ValidateFileHeaders(wb, fileType) Then
        validFlag = True
        lblStatus.caption = "Valid"
        lblStatus.ForeColor = RGB(0, 128, 0)
    Else
        validFlag = False
        lblStatus.caption = "Invalid"
        lblStatus.ForeColor = RGB(255, 0, 0)
    End If

    UpdateValidationStatus
End Sub

' Closes a slot's workbook only if the OTHER slot does not still reference the
' same workbook object. (When the same file is chosen for both slots,
' Workbooks.Open hands back one shared instance; closing it for one slot would
' otherwise invalidate the other and crash on later access.)
Private Sub CloseSlotWorkbook(wbToClose As Workbook)
    If wbToClose Is Nothing Then Exit Sub
    Dim refs As Long
    If SelectedFileA Is wbToClose Then refs = refs + 1
    If SelectedFileB Is wbToClose Then refs = refs + 1
    If refs <= 1 Then
        On Error Resume Next
        wbToClose.Close SaveChanges:=False
        On Error GoTo 0
    End If
End Sub

Private Sub m_btnGenerate_Click()
    Cancelled = False
    Me.Hide
End Sub

Private Sub m_btnCancel_Click()
    Cancelled = True
    ' Close opened files
    On Error Resume Next
    If Not SelectedFileA Is Nothing Then SelectedFileA.Close SaveChanges:=False
    If Not SelectedFileB Is Nothing Then SelectedFileB.Close SaveChanges:=False
    On Error GoTo 0
    Me.Hide
End Sub

Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    If CloseMode = vbFormControlMenu Then
        Cancel = 1
        m_btnCancel_Click
    End If
End Sub

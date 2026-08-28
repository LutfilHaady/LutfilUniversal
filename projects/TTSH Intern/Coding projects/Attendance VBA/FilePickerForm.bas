VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} FilePickerForm
   Caption         =   "Attendance Report - Select Punch List File"
   ClientHeight    =   2400
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   5100
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
' To install it from Attendance_All_Modules.txt:
'   1. In the VBA Editor: Insert > UserForm.
'   2. In the Properties window (F4), set (Name) = FilePickerForm.
'   3. Open the form's code window (F7) and paste everything from
'      the "Option Explicit" line above down to the end of this
'      section (skip the VERSION / Begin / Attribute lines).
' All controls are built automatically when the form opens, so you
' never need to draw anything on the form by hand.
' ============================================================

' Public property returning the selected workbook
Public SelectedSrc As Workbook
Public Cancelled As Boolean

' Module-level folder tracking
Private m_lastFolder As String

' Event-enabled controls
Private WithEvents m_btnSrc As MSForms.CommandButton
Private WithEvents m_btnGenerate As MSForms.CommandButton
Private WithEvents m_btnCancel As MSForms.CommandButton

' Label controls (to update status/filename)
Private m_lblSrcFile As MSForms.Label
Private m_lblSrcStatus As MSForms.Label

' Status flag
Private m_validSrc As Boolean

Public Function ShowFilePicker() As Boolean
    Cancelled = True
    Set SelectedSrc = Nothing
    m_lastFolder = ""
    m_validSrc = False

    If Not m_lblSrcFile Is Nothing Then
        m_lblSrcFile.caption = "(not selected)"
        m_lblSrcStatus.caption = ChrW(9675)
        m_lblSrcStatus.ForeColor = RGB(0, 0, 0)
        m_btnGenerate.Enabled = False
    End If

    Me.Show vbModal

    ShowFilePicker = Not Cancelled
End Function

Private Sub UserForm_Initialize()
    Me.Caption = "Attendance Report - Select Punch List File"
    Me.Width = 400
    Me.Height = 220
    Me.Font.Name = "Tahoma"
    Me.Font.Size = 9.5

    CreateLabel "lblSrc", "Monthly Punch List Export", 20, 15, 340, 15, True
    Set m_btnSrc = CreateButton("btnSrc", "Browse...", 20, 32, 70, 22)
    Set m_lblSrcFile = CreateLabel("lblSrcFile", "(not selected)", 100, 35, 180, 15, False)
    Set m_lblSrcStatus = CreateLabel("lblSrcStatus", ChrW(9675), 290, 35, 70, 15, False)
    m_lblSrcStatus.Font.Bold = True

    Set m_btnGenerate = CreateButton("btnGenerate", "Generate Report", 110, 100, 110, 26)
    m_btnGenerate.Enabled = False
    Set m_btnCancel = CreateButton("btnCancel", "Cancel", 230, 100, 110, 26)
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
        Set PickFileWithFolder = Workbooks.Open(filePath, ReadOnly:=True)
    Else
        Set PickFileWithFolder = Nothing
    End If
    AppActivate Me.Caption  ' return focus to the form after the file dialog closes
End Function

Private Sub m_btnSrc_Click()
    Dim wb As Workbook
    Set wb = PickFileWithFolder("Select Monthly Punch List Export")
    If wb Is Nothing Then Exit Sub      ' user cancelled the dialog -- keep current selection

    ' Release the previous selection, unless the user re-picked the same file
    ' (Workbooks.Open returns the already-open instance for the same path).
    If Not (SelectedSrc Is wb) Then
        On Error Resume Next
        If Not SelectedSrc Is Nothing Then SelectedSrc.Close SaveChanges:=False
        On Error GoTo 0
    End If

    Set SelectedSrc = wb
    m_lblSrcFile.caption = wb.Name
    If ValidatePunchListFile(wb) Then
        m_validSrc = True
        m_lblSrcStatus.caption = ChrW(&H2713) & " Valid"
        m_lblSrcStatus.ForeColor = RGB(0, 128, 0)
    Else
        m_validSrc = False
        m_lblSrcStatus.caption = ChrW(&H2717) & " Invalid"
        m_lblSrcStatus.ForeColor = RGB(255, 0, 0)
    End If

    m_btnGenerate.Enabled = m_validSrc
End Sub

Private Sub m_btnGenerate_Click()
    Cancelled = False
    Me.Hide
End Sub

Private Sub m_btnCancel_Click()
    Cancelled = True
    On Error Resume Next
    If Not SelectedSrc Is Nothing Then SelectedSrc.Close SaveChanges:=False
    On Error GoTo 0
    Me.Hide
End Sub

Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    If CloseMode = vbFormControlMenu Then
        Cancel = 1
        m_btnCancel_Click
    End If
End Sub

VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} FilePickerForm
   Caption         =   "SMS Broadcast -- Select Input Files"
   ClientHeight    =   3200
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
' To install it from SMS_Broadcast_All_Modules.txt:
'   1. In the VBA Editor: Insert > UserForm.
'   2. In the Properties window (F4), set (Name) = FilePickerForm.
'   3. Open the form's code window (F7) and paste everything from
'      the "Option Explicit" line above down to the end of this
'      section (skip the VERSION / Begin / Attribute lines).
' All controls are built automatically when the form opens, so you
' never need to draw anything on the form by hand.
' ============================================================

' Public properties to return the selected workbooks
Public SelectedEfc As Workbook
Public SelectedEpic As Workbook
Public Cancelled As Boolean

' Module-level folder tracking
Private m_lastFolder As String

' Event-enabled controls
Private WithEvents m_btnEfc As MSForms.CommandButton
Private WithEvents m_btnEpic As MSForms.CommandButton
Private WithEvents m_btnGenerate As MSForms.CommandButton
Private WithEvents m_btnCancel As MSForms.CommandButton

' Label controls (to update status/filenames)
Private m_lblEfcFile As MSForms.Label
Private m_lblEfcStatus As MSForms.Label

Private m_lblEpicFile As MSForms.Label
Private m_lblEpicStatus As MSForms.Label

Private m_lblWarning As MSForms.Label

' Status flags
Private m_validEfc As Boolean
Private m_validEpic As Boolean

Public Function ShowFilePicker() As Boolean
    Cancelled = True
    Set SelectedEfc = Nothing
    Set SelectedEpic = Nothing
    m_lastFolder = ""

    m_validEfc = False
    m_validEpic = False

    Me.Show vbModal

    ShowFilePicker = Not Cancelled
End Function

Private Sub UserForm_Initialize()
    Me.Caption = "SMS Broadcast -- Select Input Files"
    Me.Width = 510
    Me.Height = 270
    Me.Font.Name = "Tahoma"
    Me.Font.Size = 9.5

    ' Row 1: eFC
    CreateLabel "lblEfc", "eFC Task List Report Export", 20, 15, 460, 15, True
    Set m_btnEfc = CreateButton("btnEfc", "Browse...", 20, 32, 70, 22)
    Set m_lblEfcFile = CreateLabel("lblEfcFile", "(not selected)", 100, 35, 280, 15, False)
    Set m_lblEfcStatus = CreateLabel("lblEfcStatus", "(pending)", 390, 35, 90, 15, False)
    m_lblEfcStatus.Font.Bold = True

    ' Row 2: Epic
    CreateLabel "lblEpic", "Epic Census Snapshot Report", 20, 70, 460, 15, True
    Set m_btnEpic = CreateButton("btnEpic", "Browse...", 20, 87, 70, 22)
    Set m_lblEpicFile = CreateLabel("lblEpicFile", "(not selected)", 100, 90, 280, 15, False)
    Set m_lblEpicStatus = CreateLabel("lblEpicStatus", "(pending)", 390, 90, 90, 15, False)
    m_lblEpicStatus.Font.Bold = True

    ' Warning / validation-error label
    Set m_lblWarning = CreateLabel("lblWarning", "", 20, 122, 460, 40, False)
    m_lblWarning.ForeColor = RGB(180, 0, 0)
    m_lblWarning.Font.Bold = True
    m_lblWarning.Visible = False

    ' Bottom buttons
    Set m_btnGenerate = CreateButton("btnGenerate", "Run", 240, 175, 110, 26)
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

Private Sub m_btnEfc_Click()
    HandleEfcPick
End Sub

Private Sub m_btnEpic_Click()
    HandleEpicPick
End Sub

' Picks the eFC file, validates it via Helpers.ValidateEfcFile, and shows the
' specific failure message (not a generic "invalid") if validation fails --
' Stage 1 of the design spec: fail loud here, not three steps later.
Private Sub HandleEfcPick()
    Dim wb As Workbook
    Set wb = PickFileWithFolder("Select eFC Task List Report Export")
    If wb Is Nothing Then Exit Sub      ' user cancelled the dialog -- keep current selection

    If Not (SelectedEfc Is wb) Then CloseSlotWorkbook SelectedEfc
    Set SelectedEfc = wb
    m_lblEfcFile.caption = wb.Name

    Dim errMsg As String
    If Helpers.ValidateEfcFile(wb, errMsg) Then
        m_validEfc = True
        m_lblEfcStatus.caption = "Valid"
        m_lblEfcStatus.ForeColor = RGB(0, 128, 0)
        ShowWarning ""
    Else
        m_validEfc = False
        m_lblEfcStatus.caption = "Invalid"
        m_lblEfcStatus.ForeColor = RGB(255, 0, 0)
        ShowWarning errMsg
    End If

    UpdateValidationStatus
End Sub

' Picks the Epic file, validates it via Helpers.ValidateEpicFile -- same
' fail-loud-with-specific-message behavior as HandleEfcPick.
Private Sub HandleEpicPick()
    Dim wb As Workbook
    Set wb = PickFileWithFolder("Select Epic Census Snapshot Report")
    If wb Is Nothing Then Exit Sub

    If Not (SelectedEpic Is wb) Then CloseSlotWorkbook SelectedEpic
    Set SelectedEpic = wb
    m_lblEpicFile.caption = wb.Name

    Dim errMsg As String
    If Helpers.ValidateEpicFile(wb, errMsg) Then
        m_validEpic = True
        m_lblEpicStatus.caption = "Valid"
        m_lblEpicStatus.ForeColor = RGB(0, 128, 0)
        ShowWarning ""
    Else
        m_validEpic = False
        m_lblEpicStatus.caption = "Invalid"
        m_lblEpicStatus.ForeColor = RGB(255, 0, 0)
        ShowWarning errMsg
    End If

    UpdateValidationStatus
End Sub

Private Sub ShowWarning(msg As String)
    m_lblWarning.caption = msg
    m_lblWarning.Visible = (msg <> "")
End Sub

Private Sub UpdateValidationStatus()
    If m_validEfc And m_validEpic Then ShowWarning ""
    m_btnGenerate.Enabled = (m_validEfc And m_validEpic)
End Sub

' Closes a slot's workbook only if the OTHER slot doesn't still reference the
' same workbook object (Workbooks.Open hands back the same instance if the
' user picks the same file for both slots).
Private Sub CloseSlotWorkbook(wbToClose As Workbook)
    If wbToClose Is Nothing Then Exit Sub
    Dim refs As Long
    If SelectedEfc Is wbToClose Then refs = refs + 1
    If SelectedEpic Is wbToClose Then refs = refs + 1
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
    If Not SelectedEfc Is Nothing Then SelectedEfc.Close SaveChanges:=False
    If Not SelectedEpic Is Nothing Then SelectedEpic.Close SaveChanges:=False
    On Error GoTo 0
    Me.Hide
End Sub

Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    If CloseMode = vbFormControlMenu Then
        Cancel = 1
        m_btnCancel_Click
    End If
End Sub

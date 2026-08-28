VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} FilePickerForm 
   Caption         =   "MFC Report — Select Input Files"
   ClientHeight    =   5500
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
' To install it from MFC_All_Modules.txt:
'   1. In the VBA Editor: Insert > UserForm.
'   2. In the Properties window (F4), set (Name) = FilePickerForm.
'   3. Open the form's code window (F7) and paste everything from
'      the "Option Explicit" line above down to the end of this
'      section (skip the VERSION / Begin / Attribute lines).
' All controls are built automatically when the form opens, so you
' never need to draw anything on the form by hand.
' ============================================================

' Public properties to return the selected workbooks
Public SelectedMain As Workbook
Public SelectedMissed As Workbook
Public SelectedEpic As Workbook
Public SelectedPrev As Workbook
Public Cancelled As Boolean

' Module-level folder tracking
Private m_lastFolder As String

' Event-enabled controls
Private WithEvents m_btnMain As MSForms.CommandButton
Private WithEvents m_btnMissed As MSForms.CommandButton
Private WithEvents m_btnEpic As MSForms.CommandButton
Private WithEvents m_btnPrev As MSForms.CommandButton
Private WithEvents m_btnGenerate As MSForms.CommandButton
Private WithEvents m_btnCancel As MSForms.CommandButton

' Label controls (to update status/filenames)
Private m_lblMainFile As MSForms.Label
Private m_lblMainStatus As MSForms.Label

Private m_lblMissedFile As MSForms.Label
Private m_lblMissedStatus As MSForms.Label

Private m_lblEpicFile As MSForms.Label
Private m_lblEpicStatus As MSForms.Label

Private m_lblPrevFile As MSForms.Label
Private m_lblPrevStatus As MSForms.Label

Private m_lblWarning As MSForms.Label

' Status flags
Private m_validMain As Boolean
Private m_validMissed As Boolean
Private m_validEpic As Boolean
Private m_validPrev As Boolean

Public Function ShowFilePicker() As Boolean
    Cancelled = True
    Set SelectedMain = Nothing
    Set SelectedMissed = Nothing
    Set SelectedEpic = Nothing
    Set SelectedPrev = Nothing
    m_lastFolder = ""
    
    m_validMain = False
    m_validMissed = False
    m_validEpic = False
    m_validPrev = False

    Me.Show vbModal
    
    ShowFilePicker = Not Cancelled
End Function

Private Sub UserForm_Initialize()
    ' Set up form size and styling
    Me.Caption = "MFC Report — Select Input Files"
    Me.Width = 510
    Me.Height = 370
    Me.Font.Name = "Tahoma"
    Me.Font.Size = 9.5

    ' Row 1: EFC Main
    CreateLabel "lblEFCMain", "EFC Report (without Missed FC)", 20, 15, 460, 15, True
    Set m_btnMain = CreateButton("btnMain", "Browse...", 20, 32, 70, 22)
    Set m_lblMainFile = CreateLabel("lblEFCMainFile", "(not selected)", 100, 35, 280, 15, False)
    Set m_lblMainStatus = CreateLabel("lblEFCMainStatus", "○", 390, 35, 90, 15, False)
    m_lblMainStatus.Font.Bold = True

    ' Row 2: EFC Missed
    CreateLabel "lblEFCMissed", "EFC Report (with Missed FC)", 20, 70, 460, 15, True
    Set m_btnMissed = CreateButton("btnMissed", "Browse...", 20, 87, 70, 22)
    Set m_lblMissedFile = CreateLabel("lblEFCMissedFile", "(not selected)", 100, 90, 280, 15, False)
    Set m_lblMissedStatus = CreateLabel("lblEFCMissedStatus", "○", 390, 90, 90, 15, False)
    m_lblMissedStatus.Font.Bold = True

    ' Row count warning label
    Set m_lblWarning = CreateLabel("lblWarning", "", 20, 122, 460, 25, False)
    m_lblWarning.ForeColor = RGB(180, 80, 0) ' Dark Orange
    m_lblWarning.Font.Bold = True
    m_lblWarning.Visible = False

    ' Row 3: Epic Census
    CreateLabel "lblEpic", "Epic Census Report", 20, 155, 460, 15, True
    Set m_btnEpic = CreateButton("btnEpic", "Browse...", 20, 172, 70, 22)
    Set m_lblEpicFile = CreateLabel("lblEpicFile", "(not selected)", 100, 175, 280, 15, False)
    Set m_lblEpicStatus = CreateLabel("lblEpicStatus", "○", 390, 175, 90, 15, False)
    m_lblEpicStatus.Font.Bold = True

    ' Row 4: Previous MFC
    CreateLabel "lblPrev", "Previous MFC Report", 20, 210, 460, 15, True
    Set m_btnPrev = CreateButton("btnPrev", "Browse...", 20, 227, 70, 22)
    Set m_lblPrevFile = CreateLabel("lblPrevFile", "(not selected)", 100, 230, 280, 15, False)
    Set m_lblPrevStatus = CreateLabel("lblPrevStatus", "○", 390, 230, 90, 15, False)
    m_lblPrevStatus.Font.Bold = True

    ' Bottom Buttons
    Set m_btnGenerate = CreateButton("btnGenerate", "Generate Report", 240, 285, 110, 26)
    m_btnGenerate.Enabled = False
    Set m_btnCancel = CreateButton("btnCancel", "Cancel", 365, 285, 110, 26)
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

' Recomputes all cross-slot state (duplicate-EFC conflict, row-count warning, and the
' Generate button) from the current selections. The m_validX flags hold ONLY header
' validity (set by HandleSlotPick); the duplicate conflict is tracked locally here so it
' can never leave a slot stuck invalid after the conflict is resolved on the other slot.
Private Sub UpdateValidationStatus()
    Dim isDuplicate As Boolean
    isDuplicate = False

    ' Clear warning
    m_lblWarning.caption = ""
    m_lblWarning.Visible = False

    ' Duplicate EFC check
    If Not SelectedMain Is Nothing And Not SelectedMissed Is Nothing Then
        If UCase(SelectedMain.FullName) = UCase(SelectedMissed.FullName) Then isDuplicate = True
    End If

    If isDuplicate Then
        m_lblWarning.caption = "⚠ Same file selected for both EFC reports!"
        m_lblWarning.Visible = True
        ' Reflect the conflict on the Missed slot WITHOUT clobbering its header-validity flag.
        m_lblMissedStatus.caption = "✗ Same file"
        m_lblMissedStatus.ForeColor = RGB(255, 0, 0)
    ElseIf m_validMissed And Not SelectedMissed Is Nothing Then
        ' No conflict: restore the Missed slot's true status (it may have shown "✗ Same file").
        m_lblMissedStatus.caption = "✓ Valid"
        m_lblMissedStatus.ForeColor = RGB(0, 128, 0)
    End If

    ' Row-count sanity warning (only when both EFC files are present and distinct)
    If Not isDuplicate And Not SelectedMain Is Nothing And Not SelectedMissed Is Nothing Then
        Dim mainRows As Long, missedRows As Long
        mainRows = CountDataRows(SelectedMain.Sheets(1))
        missedRows = CountDataRows(SelectedMissed.Sheets(1))
        If mainRows > 0 And missedRows > 0 Then
            If mainRows = missedRows Then
                m_lblWarning.caption = "⚠ Both EFC files have the same row count (" & mainRows & "). Verify exports."
                m_lblWarning.Visible = True
            ElseIf missedRows > mainRows Then
                m_lblWarning.caption = "⚠ Missed FC file has MORE rows than main file. Verify order."
                m_lblWarning.Visible = True
            End If
        End If
    End If

    ' Enable Generate only when all four slots are header-valid AND the two EFC files differ.
    m_btnGenerate.Enabled = (m_validMain And m_validMissed And m_validEpic And m_validPrev And Not isDuplicate)
End Sub

' Counts data rows (excluding the header) via the "Encounter No" column, which is reliably
' populated for every EFC row -- FC ID and other columns can be blank in missed-FC rows, so
' a hardcoded column index would miscount. Returns 0 if the header is absent.
Private Function CountDataRows(ws As Worksheet) As Long
    Dim col As Long
    col = FindColByHeader(ws, "Encounter No")
    If col = 0 Then
        CountDataRows = 0
    Else
        CountDataRows = ws.Cells(ws.Rows.Count, col).End(xlUp).Row - 1
    End If
End Function

Private Sub m_btnMain_Click()
    HandleSlotPick SelectedMain, "Select EFC Report WITHOUT Missed FC", "EFC", _
                   m_lblMainFile, m_lblMainStatus, m_validMain
End Sub

Private Sub m_btnMissed_Click()
    HandleSlotPick SelectedMissed, "Select EFC Report WITH Missed FC", "EFC", _
                   m_lblMissedFile, m_lblMissedStatus, m_validMissed
End Sub

Private Sub m_btnEpic_Click()
    HandleSlotPick SelectedEpic, "Select Epic Census Report", "EPIC", _
                   m_lblEpicFile, m_lblEpicStatus, m_validEpic
End Sub

Private Sub m_btnPrev_Click()
    HandleSlotPick SelectedPrev, "Select Previous MFC Report", "PREV_MFC", _
                   m_lblPrevFile, m_lblPrevStatus, m_validPrev
End Sub

' Shared Browse handler for all four slots. Picks a file, closes the slot's previous
' workbook (UNLESS the user re-picked the same file -- Workbooks.Open returns the already-
' open instance, so closing it would invalidate the new reference and crash on wb.Name),
' validates headers, updates the file/status labels, then recomputes cross-slot state.
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
        lblStatus.caption = "✓ Valid"
        lblStatus.ForeColor = RGB(0, 128, 0)
    Else
        validFlag = False
        lblStatus.caption = "✗ Invalid"
        lblStatus.ForeColor = RGB(255, 0, 0)
    End If

    UpdateValidationStatus
End Sub

' Closes a slot's workbook only if no OTHER slot still references the same workbook object.
' (When the same file is chosen for two slots, Workbooks.Open hands back one shared instance;
' closing it for one slot would otherwise invalidate the other and crash on later access.)
Private Sub CloseSlotWorkbook(wbToClose As Workbook)
    If wbToClose Is Nothing Then Exit Sub
    Dim refs As Long
    If SelectedMain Is wbToClose Then refs = refs + 1
    If SelectedMissed Is wbToClose Then refs = refs + 1
    If SelectedEpic Is wbToClose Then refs = refs + 1
    If SelectedPrev Is wbToClose Then refs = refs + 1
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
    If Not SelectedMain Is Nothing Then SelectedMain.Close SaveChanges:=False
    If Not SelectedMissed Is Nothing Then SelectedMissed.Close SaveChanges:=False
    If Not SelectedEpic Is Nothing Then SelectedEpic.Close SaveChanges:=False
    If Not SelectedPrev Is Nothing Then SelectedPrev.Close SaveChanges:=False
    On Error GoTo 0
    Me.Hide
End Sub

Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    If CloseMode = vbFormControlMenu Then
        Cancel = 1
        m_btnCancel_Click
    End If
End Sub

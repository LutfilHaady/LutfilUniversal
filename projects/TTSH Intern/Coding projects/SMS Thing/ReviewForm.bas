VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} ReviewForm
   Caption         =   "SMS Broadcast -- Review Cases"
   ClientHeight    =   6000
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   6800
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "ReviewForm"
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
'   2. In the Properties window (F4), set (Name) = ReviewForm.
'   3. Open the form's code window (F7) and paste everything from
'      the "Option Explicit" line above down to the end of this
'      section (skip the VERSION / Begin / Attribute lines).
' All controls are built automatically when the form opens, so you
' never need to draw anything on the form by hand.
' ============================================================

' Stage 3 of the design spec: a checklist grid of matched cases (default
' checked), plus informational "Needs Manual Lookup" and "Duplicates
' collapsed" sections. PSA can uncheck any row before generating the
' broadcast file -- this form is the human error-catching step; nothing
' skips it.
'
' The number of cases is unknown until runtime, so every row's controls
' are built dynamically (same technique as FilePickerForm's CreateLabel /
' CreateButton, extended with a CreateCheckBox and an auto-incrementing
' control-name generator so row count never collides with a fixed name).

Private WithEvents m_btnGenerate As MSForms.CommandButton
Private WithEvents m_btnCancel As MSForms.CommandButton

Private m_checkBoxes() As MSForms.CheckBox
Private m_caseCount As Long
Private m_confirmed As Boolean
Private m_seq As Long

Private Const ROW_HEIGHT As Single = 18
Private Const FORM_WIDTH As Single = 600
Private Const MAX_FORM_HEIGHT As Single = 560

' Shows the review grid modally. checked() is returned 1-based, sized to
' caseCount, True/False per row of the cases() array (default True).
' Returns True if the user clicked "Generate Broadcast File", False if
' Cancelled (checked() is still populated on Cancel, but MainMacro should
' not act on it).
Public Function ShowReview(cases() As SmsCase, caseCount As Long, _
                            manualLookup() As SmsCase, manualCount As Long, _
                            dupSummary() As String, dupCount As Long, _
                            ByRef checked() As Boolean) As Boolean
    m_confirmed = False
    m_caseCount = caseCount
    m_seq = 0

    Me.Caption = "SMS Broadcast -- Review Cases"
    Me.Font.Name = "Tahoma"
    Me.Font.Size = 9

    Dim y As Single
    y = 10

    y = AddSectionHeader("Cases to send (" & caseCount & ") -- uncheck any to exclude", y)
    y = AddCaseGrid(cases, caseCount, y)

    If manualCount > 0 Then
        y = y + 10
        y = AddSectionHeader("Needs Manual Lookup (" & manualCount & ") -- no Epic match, not included below", y)
        y = AddManualLookupList(manualLookup, manualCount, y)
    End If

    If dupCount > 0 Then
        y = y + 10
        y = AddSectionHeader("Duplicates collapsed (" & dupCount & ") -- kept last occurrence only", y)
        y = AddTextList(dupSummary, dupCount, y)
    End If

    y = y + 10
    Set m_btnGenerate = CreateButton("Generate Broadcast File", 10, y, 200, 26)
    Set m_btnCancel = CreateButton("Cancel", 220, y, 100, 26)
    y = y + 36

    Dim formHeight As Single
    formHeight = y + 40
    If formHeight > MAX_FORM_HEIGHT Then formHeight = MAX_FORM_HEIGHT
    Me.Width = FORM_WIDTH + 30
    Me.Height = formHeight
    Me.ScrollBars = fmScrollBarsVertical
    Me.ScrollHeight = y + 10
    Me.ScrollWidth = FORM_WIDTH

    Me.Show vbModal

    ReDim checked(1 To caseCount)
    Dim i As Long
    For i = 1 To caseCount
        checked(i) = m_checkBoxes(i).Value
    Next i

    ShowReview = m_confirmed
End Function

Private Function AddSectionHeader(caption As String, startY As Single) As Single
    CreateLabel caption, 10, startY, 580, 15, True
    AddSectionHeader = startY + ROW_HEIGHT + 4
End Function

Private Function AddCaseGrid(cases() As SmsCase, caseCount As Long, startY As Single) As Single
    Dim y As Single
    y = startY

    CreateLabel "Name", 10, y, 140, 15, True
    CreateLabel "MRN", 155, y, 70, 15, True
    CreateLabel "1st Phone", 230, y, 90, 15, True
    CreateLabel "2nd Phone", 325, y, 90, 15, True
    CreateLabel "3rd Phone", 420, y, 90, 15, True
    CreateLabel "Send?", 515, y, 50, 15, True
    y = y + ROW_HEIGHT

    ReDim m_checkBoxes(1 To caseCount)
    Dim i As Long
    For i = 1 To caseCount
        CreateLabel cases(i).PatientName, 10, y, 140, 15, False
        CreateLabel cases(i).MRN, 155, y, 70, 15, False
        CreateLabel cases(i).Phone1, 230, y, 90, 15, False
        CreateLabel cases(i).Phone2, 325, y, 90, 15, False
        CreateLabel cases(i).Phone3, 420, y, 90, 15, False
        Set m_checkBoxes(i) = CreateCheckBox(525, y)
        m_checkBoxes(i).Value = True   ' default checked
        y = y + ROW_HEIGHT
    Next i

    AddCaseGrid = y
End Function

' Informational only -- greyed out, not actionable from this form.
Private Function AddManualLookupList(items() As SmsCase, itemCount As Long, startY As Single) As Single
    Dim y As Single
    y = startY
    Dim i As Long
    Dim lbl As MSForms.Label
    For i = 1 To itemCount
        Set lbl = CreateLabel(items(i).PatientName & "  |  MRN " & items(i).MRN & "  |  Encounter " & items(i).EncounterNo & " -- no Epic match", 10, y, 580, 15, False)
        lbl.ForeColor = RGB(128, 128, 128)
        y = y + ROW_HEIGHT
    Next i
    AddManualLookupList = y
End Function

' Informational only -- greyed out, not actionable from this form.
Private Function AddTextList(items() As String, itemCount As Long, startY As Single) As Single
    Dim y As Single
    y = startY
    Dim i As Long
    Dim lbl As MSForms.Label
    For i = 1 To itemCount
        Set lbl = CreateLabel(items(i), 10, y, 580, 15, False)
        lbl.ForeColor = RGB(128, 128, 128)
        y = y + ROW_HEIGHT
    Next i
    AddTextList = y
End Function

Private Function NextCtrlName() As String
    m_seq = m_seq + 1
    NextCtrlName = "ctl" & m_seq
End Function

Private Function CreateLabel(caption As String, left As Single, top As Single, width As Single, height As Single, bold As Boolean) As MSForms.Label
    Dim lbl As MSForms.Label
    Set lbl = Me.Controls.Add("Forms.Label.1", NextCtrlName(), True)
    lbl.left = left
    lbl.top = top
    lbl.width = width
    lbl.height = height
    lbl.caption = caption
    If bold Then lbl.Font.Bold = True
    Set CreateLabel = lbl
End Function

Private Function CreateButton(caption As String, left As Single, top As Single, width As Single, height As Single) As MSForms.CommandButton
    Dim btn As MSForms.CommandButton
    Set btn = Me.Controls.Add("Forms.CommandButton.1", NextCtrlName(), True)
    btn.left = left
    btn.top = top
    btn.width = width
    btn.height = height
    btn.caption = caption
    Set CreateButton = btn
End Function

Private Function CreateCheckBox(left As Single, top As Single) As MSForms.CheckBox
    Dim chk As MSForms.CheckBox
    Set chk = Me.Controls.Add("Forms.CheckBox.1", NextCtrlName(), True)
    chk.left = left
    chk.top = top
    chk.width = 20
    chk.height = 16
    Set CreateCheckBox = chk
End Function

Private Sub m_btnGenerate_Click()
    m_confirmed = True
    Me.Hide
End Sub

Private Sub m_btnCancel_Click()
    m_confirmed = False
    Me.Hide
End Sub

Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    If CloseMode = vbFormControlMenu Then
        Cancel = 1
        m_btnCancel_Click
    End If
End Sub

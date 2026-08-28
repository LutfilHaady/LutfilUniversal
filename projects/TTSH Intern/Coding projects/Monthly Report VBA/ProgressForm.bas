VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} ProgressForm
   Caption         =   "FC Completion Report -- Generating"
   ClientHeight    =   1500
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   4200
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "ProgressForm"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' ============================================================
' IMPORT NOTE (staff): This module is an Excel UserForm, NOT a
' standard module. To install it from FCCompletion_All_Modules.txt:
'   1. In the VBA Editor: Insert > UserForm.
'   2. In the Properties window (F4), set (Name) = ProgressForm.
'   3. Open the form's code window (F7) and paste everything from
'      the "Option Explicit" line above down to the end of this
'      section (skip the VERSION / Begin / Attribute lines).
' All controls are built automatically when the form opens.
' ============================================================

' Modeless progress window shown by MainMacro during GenerateFCCompletionReport.
' The macro runs with ScreenUpdating = False, so Application.StatusBar never
' repaints; this form forces a redraw via Me.Repaint on every Update.

Private m_total As Long
Private m_lblStep As MSForms.Label
Private m_barTrack As MSForms.Label
Private m_barFill As MSForms.Label

Private Const BAR_LEFT As Single = 12
Private Const BAR_TOP As Single = 44
Private Const BAR_WIDTH As Single = 192
Private Const BAR_HEIGHT As Single = 16

Public Sub ShowProgress(totalSteps As Long)
    m_total = totalSteps
    BuildControls
    m_lblStep.Caption = "Starting..."
    m_barFill.Width = 0
    Me.Show vbModeless
    Me.Repaint
End Sub

Public Sub Update(stepNum As Long, message As String)
    BuildControls
    m_lblStep.Caption = "Step " & stepNum & " of " & m_total & " -- " & message
    If m_total > 0 Then m_barFill.Width = BAR_WIDTH * (stepNum / m_total)
    Me.Repaint
    DoEvents
End Sub

Public Sub CloseProgress()
    Unload Me
End Sub

Private Sub UserForm_Initialize()
    Me.Caption = "FC Completion Report -- Generating"
    Me.Width = 222
    Me.Height = 96
    Me.Font.Name = "Tahoma"
    Me.Font.Size = 9
    BuildControls
End Sub

' Builds the label + progress bar once. Guarded so it is safe to call repeatedly.
Private Sub BuildControls()
    If Not m_barFill Is Nothing Then Exit Sub

    Set m_lblStep = Me.Controls.Add("Forms.Label.1", "lblStep", True)
    m_lblStep.Left = BAR_LEFT
    m_lblStep.Top = 12
    m_lblStep.Width = BAR_WIDTH
    m_lblStep.Height = 24

    Set m_barTrack = Me.Controls.Add("Forms.Label.1", "barTrack", True)
    m_barTrack.Left = BAR_LEFT
    m_barTrack.Top = BAR_TOP
    m_barTrack.Width = BAR_WIDTH
    m_barTrack.Height = BAR_HEIGHT
    m_barTrack.BackColor = RGB(220, 220, 220)
    m_barTrack.BorderStyle = fmBorderStyleSingle

    Set m_barFill = Me.Controls.Add("Forms.Label.1", "barFill", True)
    m_barFill.Left = BAR_LEFT
    m_barFill.Top = BAR_TOP
    m_barFill.Width = 0
    m_barFill.Height = BAR_HEIGHT
    m_barFill.BackColor = RGB(0, 128, 0)
End Sub

' Block the user's X button so the window cannot be dismissed mid-run.
Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    If CloseMode = vbFormControlMenu Then Cancel = 1
End Sub

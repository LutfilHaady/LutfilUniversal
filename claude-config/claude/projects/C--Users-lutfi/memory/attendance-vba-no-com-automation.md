---
name: attendance-vba-no-com-automation
description: "VBA project object model access is disabled on this machine, and out-of-process Excel COM automation isn't representative of in-process VBA speed anyway — don't try to live-test/benchmark this repo's macro via PowerShell COM automation."
metadata: 
  node_type: memory
  type: project
  originSessionId: 27a0fa5c-50f2-49bf-bf1b-b937703b9e63
  modified: 2026-07-28T06:35:33.796Z
---

"Trust access to the VBA project object model" is disabled in this machine's Excel Trust Center (`HKCU:\Software\Microsoft\Office\16.0\Excel\Security\AccessVBOM` is unset/blank, not `1`). `Workbook.VBProject`/`VBComponents` calls from PowerShell COM automation return null or throw intermittently as a result.

Separately, even when reachable, driving Excel via out-of-process PowerShell COM automation (`New-Object -ComObject Excel.Application`) is drastically slower per call than in-process VBA (each `.Cells.Item().Value =` write is out-of-process marshalled) — a benchmark loop of ~24k cell writes timed out past 3 minutes, which says nothing about real in-process VBA performance and left a hung EXCEL.EXE process to clean up.

**Why:** Discovered while investigating a "the macro runs slow" report (2026-07-28) for [[attendance-vba-ideal-state]] — tried to get real timing evidence via COM automation before proposing a fix, per systematic-debugging practice, and both avenues (VBProject injection, raw cell-write benchmarking) were dead ends.

**How to apply:** Don't attempt live COM-driven reproduction/benchmarking of this repo's VBA again without first asking the user to enable AccessVBOM (a Trust Center security setting, not something to flip silently). Diagnose VBA performance/behavior issues from code reading against known VBA anti-patterns (missing `Application.Calculation = xlCalculationManual`, cell-by-cell writes vs array writes, `ScreenUpdating` toggles) instead, and say so plainly rather than presenting a guess as a measured result.

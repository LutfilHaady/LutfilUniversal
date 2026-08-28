# Timesheet Management App — Design Spec
**Date:** 2026-05-12

## Overview

A single-file (`timesheet.html`) timesheet management web app using vanilla JS, CSS, and jsPDF for PDF export. No build step, no frameworks. All data persisted in localStorage.

---

## Architecture

### File Structure
Single HTML file with three embedded sections:
- `<style>` — all CSS
- `<body>` — minimal shell (`<div id="app">`)
- `<script>` — JS organized into four sections via comments:
  - `// --- DATA ---` — localStorage read/write helpers
  - `// --- LOGIC ---` — time calculations (pure functions, no DOM)
  - `// --- RENDER ---` — all DOM-building functions
  - `// --- ROUTER ---` — hash-based navigation

### Routing
Hash-based. `window.onhashchange` + initial load handler.

| Hash | View |
|------|------|
| `#dashboard` | Employee card grid |
| `#employee/{id}/{year}/{month}` | Monthly timesheet for one employee |

Default (empty hash) → redirects to `#dashboard`.

---

## Data Model (localStorage)

### `ts_employees` — Array
```json
[
  { "id": "uuid", "name": "Alice", "department": "Engineering", "defaultStart": 7 }
]
```
- `id`: UUID generated at creation
- `defaultStart`: `7` or `8` (integers, 24h hour)

### `ts_entries` — Nested object
```json
{
  "<employeeId>": {
    "<YYYY-MM>": {
      "<YYYY-MM-DD>": { "start": 7, "clockOut": 1730 }
    }
  }
}
```
- `start`: `7` or `8` — overrides employee default for that day
- `clockOut`: integer 0000–2359 (raw 24h format, e.g. `1730`)
- Days with no entry are absent from the object (not stored as nulls)
- An entry is created/updated only when a valid clock-out is committed; changing Shift Start on a row with no clock-out is ephemeral (displayed but not persisted until a clock-out is also saved)

**Calculated fields** — never stored, always derived:
- Shift duration in minutes
- Lunch deduction (boolean + minutes)
- Daily total minutes
- Monthly total minutes

---

## Core Logic

### Time Calculation
```
startMinutes  = start * 60              // e.g. 7*60 = 420
clockMinutes  = floor(clockOut/100)*60 + (clockOut % 100)
rawMinutes    = clockMinutes - startMinutes
lunchDeducted = rawMinutes > 300        // > 5h
workedMinutes = rawMinutes - (lunchDeducted ? 60 : 0)
```

### Display Format
`workedMinutes` → `"8h 30m"`. Zero-entry days: blank (not "0h 0m").

### Monthly Total
Sum of `workedMinutes` for all days in the month that have a `clockOut` value.

### Validation Rules
- Clock-out must be digits only, exactly 4 characters (0000–2359)
- Clock-out must be strictly after shift start
- Invalid input: highlight cell/field red, block save, revert on blur/cancel

---

## UI

### Visual Style
- Background: `#f5f6fa` (light grey)
- Cards/panels: white with subtle box-shadow
- Accent: muted blue-grey (`#4a6fa5`)
- Font: system sans-serif stack
- No harsh contrast; easy on the eyes

### Dashboard
- Fixed header: app title left, "Add Employee" button right
- Responsive card grid (3 columns → 1 on mobile)
- Each card: Name, Department, current-month total (`42h 15m` or `No entries yet`)
- Card hover: lift shadow
- Card click: navigate to `#employee/{id}/{currentYear}/{currentMonth}`
- Delete icon (top-right of card): opens confirmation dialog
  - Dialog text: "Delete [Name]? This will permanently remove all their time entries."
  - Buttons: Confirm (destructive red), Cancel
  - On confirm: remove employee from `ts_employees`, remove all their data from `ts_entries`

### Add Employee Modal
- Triggered by "Add Employee" button
- Fields: Name (text, required), Department (text), Default Shift Start (radio: 7:00 / 8:00)
- Buttons: Save, Cancel
- Validates name is non-empty before saving

### Employee Monthly View

**Header:**
- Breadcrumb: "← Dashboard" link
- Employee name + department
- Month/Year dropdowns (Month: Jan–Dec, Year: 2020–2030)
- "Export PDF" button (disabled if month has no entries)

**Table columns:**
| Date | Day | Shift Start | Clock-Out | Hours Worked | Lunch Deducted | Daily Total |
|------|-----|-------------|-----------|--------------|----------------|-------------|

- Pre-populated with all calendar days for the selected month (including weekends)
- Days without a clock-out: Shift Start shows default, Hours/Lunch/Total columns blank

**Inline editing:**
- Click Shift Start cell → small dropdown (`7:00` / `8:00`)
- Click Clock-Out cell → text `<input>` (4-digit 24h)
- Enter/Tab: commit and recalculate row
- Escape: cancel, revert to previous value
- Invalid clock-out: red highlight, reverts on blur

**Row modal (edit icon per row):**
- Opens a form with Shift Start (radio) + Clock-Out (text input)
- Same validation as inline
- Save/Cancel buttons
- Accessible on mobile

**Delete day entry:**
- Small ✕ button, visible only on rows that have a clock-out value
- Clears that day's data back to blank (no confirmation — low-stakes)

**Monthly total:**
- Pinned row at bottom of table: `Total: 172h 45m`

---

## PDF Export

**Library CDN URLs:**
```
https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js
```

**PDF layout:**
- Header block: Employee Name, Department, Month Year — left aligned
- Table: Date, Day, Shift Start, Clock-Out, Hours Worked, Lunch Deducted, Daily Total
- All calendar days included; blank rows have empty Hours/Lunch/Total cells
- Footer row: "Total" label (spanning left columns), monthly total in Daily Total column
- Style: alternating light row shading, minimal borders, no gridlines on blank rows

**Filename:** `Timesheet_{EmployeeName}_{Month}_{Year}.pdf`
Example: `Timesheet_Alice_May_2026.pdf`

---

## Out of Scope (not in this version)
- Edit employee details after creation
- Data import/export (beyond PDF)
- Authentication / multi-user access
- Server-side persistence

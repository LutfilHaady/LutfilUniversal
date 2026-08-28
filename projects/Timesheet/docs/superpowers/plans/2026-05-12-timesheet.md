# Timesheet Management App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file HTML timesheet management app with multi-employee tracking, monthly time entries with inline editing, and PDF export.

**Architecture:** All code lives in `timesheet.html` — CSS in `<style>`, JS in `<script>` organized into four comment-delimited sections (`// --- DATA ---`, `// --- LOGIC ---`, `// --- RENDER ---`, `// --- ROUTER ---`). Hash-based routing (`#dashboard`, `#employee/{id}/{year}/{month}`) drives view switching. All data persisted in localStorage.

**Tech Stack:** Vanilla JS (ES2020), CSS custom properties, jsPDF 2.5.1 + jsPDF-AutoTable 3.8.2 (CDN)

---

## File Map

Single file: `timesheet.html`

JS sections within `<script>` (in order):
- `// --- DATA ---` — localStorage read/write helpers, no DOM
- `// --- LOGIC ---` — pure time-calculation functions, no DOM, no storage
- `// --- RENDER ---` — all DOM-building functions, calls DATA + LOGIC
- `// --- ROUTER ---` — hash parsing, view dispatch

Key function inventory (defined across tasks):

| Function | Section | Task |
|---|---|---|
| `getEmployees / saveEmployees` | DATA | 2 |
| `getEntries / saveEntries` | DATA | 2 |
| `addEmployee / deleteEmployee` | DATA | 2 |
| `getDayEntry / setDayEntry / clearDayEntry` | DATA | 2 |
| `getMonthEntries` | DATA | 2 |
| `clockOutToMinutes / calcDay` | LOGIC | 3 |
| `formatMinutes` | LOGIC | 3 |
| `validateClockOutInput / isClockOutAfterStart` | LOGIC | 3 |
| `getMonthDays / dateToStr / getDayName / isWeekend` | LOGIC | 3 |
| `getMonthTotalMinutes` | LOGIC | 3 |
| `MONTH_NAMES` | LOGIC | 3 |
| `renderApp / escHtml` | RENDER | 4 |
| `renderDashboard` | RENDER | 5 |
| `showModal / closeModal` | RENDER | 6 |
| `showAddEmployeeModal` | RENDER | 6 |
| `showDeleteConfirmation` | RENDER | 7 |
| `renderEmployeeView / buildTableRow` | RENDER | 8 |
| `attachMonthlyViewListeners` | RENDER | 8 |
| `attachInlineClockOutEditing / startClockOutEdit` | RENDER | 9 |
| `reRenderRow / updateMonthTotal / updateExportBtn` | RENDER | 9 |
| `attachInlineStartEditing / startStartEdit` | RENDER | 10 |
| `attachRowButtons / showRowModal / deleteDayEntry` | RENDER | 11 |
| `exportPDF` | RENDER | 12 |
| `navigate / router` | ROUTER | 4 |

---

### Task 1: HTML shell + CSS

**Files:**
- Create: `timesheet.html`

- [ ] **Create `timesheet.html` with this exact content:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timesheet</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #f5f6fa;
      --surface: #ffffff;
      --accent: #4a6fa5;
      --accent-dark: #3a5f8a;
      --danger: #c0392b;
      --danger-dark: #a93226;
      --text: #2c3e50;
      --text-muted: #7f8c8d;
      --border: #dde3ec;
      --shadow: 0 2px 8px rgba(0,0,0,0.08);
      --radius: 8px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }

    /* ── App header ── */
    #app-header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 10;
      box-shadow: var(--shadow);
    }
    #app-header h1 { font-size: 1.2rem; color: var(--accent); font-weight: 700; }

    /* ── Main content ── */
    #app-content { padding: 32px 24px; max-width: 1100px; margin: 0 auto; }

    /* ── Buttons ── */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: var(--radius);
      font-size: 0.875rem; font-weight: 500; cursor: pointer;
      border: none; transition: background 0.15s, box-shadow 0.15s;
    }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent-dark); }
    .btn-primary:disabled { background: #b0c0d8; cursor: not-allowed; }
    .btn-danger { background: var(--danger); color: #fff; }
    .btn-danger:hover { background: var(--danger-dark); }
    .btn-ghost { background: transparent; color: var(--accent); border: 1px solid var(--border); }
    .btn-ghost:hover { background: var(--bg); }

    /* ── Cards (dashboard) ── */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 20px;
      margin-top: 24px;
    }
    .employee-card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 20px;
      box-shadow: var(--shadow);
      cursor: pointer;
      position: relative;
      transition: box-shadow 0.15s, transform 0.15s;
      border: 1px solid var(--border);
    }
    .employee-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.12); transform: translateY(-2px); }
    .employee-card .emp-name { font-size: 1.1rem; font-weight: 600; margin-bottom: 4px; }
    .employee-card .emp-dept { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 12px; }
    .employee-card .emp-total { font-size: 1.3rem; font-weight: 700; color: var(--accent); }
    .employee-card .emp-total-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }
    .delete-btn {
      position: absolute; top: 12px; right: 12px;
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); font-size: 1rem; padding: 2px 6px;
      border-radius: 4px; transition: color 0.15s, background 0.15s;
    }
    .delete-btn:hover { color: var(--danger); background: #fdf0ef; }

    /* ── Modal overlay ── */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 100;
    }
    .modal {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 28px;
      width: 100%; max-width: 420px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    }
    .modal h2 { font-size: 1.1rem; margin-bottom: 20px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }

    /* ── Form fields ── */
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 6px; color: var(--text-muted); }
    .form-group input[type="text"] {
      width: 100%; padding: 8px 12px;
      border: 1px solid var(--border); border-radius: 6px;
      font-size: 0.9rem; color: var(--text);
      transition: border-color 0.15s;
    }
    .form-group input[type="text"]:focus { outline: none; border-color: var(--accent); }
    .form-group input[type="text"].error { border-color: var(--danger); }
    .radio-group { display: flex; gap: 16px; }
    .radio-group label { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; color: var(--text); cursor: pointer; font-weight: normal; }

    /* ── Employee view header ── */
    .view-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; margin-bottom: 24px;
    }
    .breadcrumb { margin-bottom: 4px; }
    .breadcrumb a { color: var(--accent); text-decoration: none; font-size: 0.9rem; }
    .breadcrumb a:hover { text-decoration: underline; }
    .view-title { font-size: 1.2rem; font-weight: 700; }
    .view-subtitle { font-size: 0.85rem; color: var(--text-muted); }
    .view-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding-top: 4px; }

    /* ── Month/Year selectors ── */
    select.month-sel, select.year-sel {
      padding: 6px 10px; border: 1px solid var(--border);
      border-radius: 6px; font-size: 0.875rem; color: var(--text);
      background: var(--surface); cursor: pointer;
    }
    select:focus { outline: none; border-color: var(--accent); }

    /* ── Timesheet table ── */
    .ts-table-wrap { overflow-x: auto; }
    .ts-table {
      width: 100%; border-collapse: collapse;
      background: var(--surface); border-radius: var(--radius);
      box-shadow: var(--shadow); overflow: hidden;
      font-size: 0.875rem;
    }
    .ts-table th {
      background: var(--accent); color: #fff;
      padding: 10px 12px; text-align: left;
      font-weight: 500; white-space: nowrap;
    }
    .ts-table td {
      padding: 8px 12px; border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    .ts-table tbody tr:last-child td { border-bottom: none; }
    .ts-table tr.weekend td { background: #f9fafc; }
    .ts-table tr.has-entry td { background: var(--surface); }
    .ts-table tr.weekend.has-entry td { background: #f9fafc; }
    .ts-table tfoot td {
      font-weight: 700; background: #eef3fa;
      border-top: 2px solid var(--border);
    }
    .ts-table td.editable { cursor: pointer; }
    .ts-table td.editable:hover { background: #eef3fa !important; }
    .ts-table td input.cell-input {
      width: 80px; border: 1px solid var(--accent);
      border-radius: 4px; padding: 2px 6px;
      font-size: 0.875rem; font-family: inherit;
    }
    .ts-table td input.cell-input.error { border-color: var(--danger); }
    .ts-table td select.cell-select {
      border: 1px solid var(--accent); border-radius: 4px;
      padding: 2px 4px; font-size: 0.875rem; font-family: inherit;
    }
    .row-actions { display: flex; gap: 4px; align-items: center; white-space: nowrap; }
    .row-edit-btn, .row-del-btn {
      background: none; border: none; cursor: pointer;
      padding: 2px 5px; border-radius: 4px; font-size: 0.85rem;
      color: var(--text-muted); transition: color 0.15s, background 0.15s;
    }
    .row-edit-btn:hover { color: var(--accent); background: #eef3fa; }
    .row-del-btn:hover { color: var(--danger); background: #fdf0ef; }

    /* ── Empty state ── */
    .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      #app-content { padding: 16px 12px; }
      .ts-table th, .ts-table td { padding: 6px 8px; font-size: 0.8rem; }
      .view-header { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    // --- DATA ---

    // --- LOGIC ---

    // --- RENDER ---

    // --- ROUTER ---
  </script>
</body>
</html>
```

- [ ] **Open `timesheet.html` in a browser (double-click the file)**

Expected: light grey background (`#f5f6fa`), no console errors, blank page (JS sections are empty stubs).

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: HTML shell and CSS foundation"
```

---

### Task 2: DATA layer

**Files:**
- Modify: `timesheet.html` — replace `// --- DATA ---` with the full DATA section

- [ ] **Replace `// --- DATA ---` with:**

```js
// --- DATA ---
const EMPLOYEES_KEY = 'ts_employees';
const ENTRIES_KEY = 'ts_entries';

function getEmployees() {
  return JSON.parse(localStorage.getItem(EMPLOYEES_KEY) || '[]');
}

function saveEmployees(employees) {
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
}

function getEntries() {
  return JSON.parse(localStorage.getItem(ENTRIES_KEY) || '{}');
}

function saveEntries(entries) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

function addEmployee(name, department, defaultStart) {
  const employees = getEmployees();
  const employee = {
    id: crypto.randomUUID(),
    name: name.trim(),
    department: department.trim(),
    defaultStart: Number(defaultStart)
  };
  employees.push(employee);
  saveEmployees(employees);
  return employee;
}

function deleteEmployee(id) {
  saveEmployees(getEmployees().filter(e => e.id !== id));
  const entries = getEntries();
  delete entries[id];
  saveEntries(entries);
}

function getDayEntry(employeeId, dateStr) {
  const entries = getEntries();
  const monthKey = dateStr.slice(0, 7);
  return entries[employeeId]?.[monthKey]?.[dateStr] ?? null;
}

function setDayEntry(employeeId, dateStr, entry) {
  const entries = getEntries();
  const monthKey = dateStr.slice(0, 7);
  if (!entries[employeeId]) entries[employeeId] = {};
  if (!entries[employeeId][monthKey]) entries[employeeId][monthKey] = {};
  entries[employeeId][monthKey][dateStr] = entry;
  saveEntries(entries);
}

function clearDayEntry(employeeId, dateStr) {
  const entries = getEntries();
  const monthKey = dateStr.slice(0, 7);
  if (entries[employeeId]?.[monthKey]?.[dateStr]) {
    delete entries[employeeId][monthKey][dateStr];
    saveEntries(entries);
  }
}

function getMonthEntries(employeeId, year, month) {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const entries = getEntries();
  return entries[employeeId]?.[monthKey] ?? {};
}
```

- [ ] **Verify in browser console (F12 → Console):**

```js
addEmployee('Alice', 'Engineering', 7)
// → { id: '...', name: 'Alice', department: 'Engineering', defaultStart: 7 }

getEmployees()
// → [{ id: '...', name: 'Alice', ... }]

const id = getEmployees()[0].id
setDayEntry(id, '2026-05-12', { start: 7, clockOut: 1730 })
getDayEntry(id, '2026-05-12')
// → { start: 7, clockOut: 1730 }

getMonthEntries(id, 2026, 5)
// → { '2026-05-12': { start: 7, clockOut: 1730 } }

clearDayEntry(id, '2026-05-12')
getDayEntry(id, '2026-05-12')
// → null
```

- [ ] **Clean up test data from console:**

```js
localStorage.removeItem('ts_employees')
localStorage.removeItem('ts_entries')
```

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: DATA layer (localStorage helpers)"
```

---

### Task 3: LOGIC layer

**Files:**
- Modify: `timesheet.html` — replace `// --- LOGIC ---` with the full LOGIC section

- [ ] **Replace `// --- LOGIC ---` with:**

```js
// --- LOGIC ---

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function clockOutToMinutes(clockOut) {
  return Math.floor(clockOut / 100) * 60 + (clockOut % 100);
}

function calcDay(start, clockOut) {
  const startMinutes = start * 60;
  const clockMinutes = clockOutToMinutes(clockOut);
  const rawMinutes = clockMinutes - startMinutes;
  const lunchDeducted = rawMinutes > 300;
  const workedMinutes = rawMinutes - (lunchDeducted ? 60 : 0);
  return { rawMinutes, lunchDeducted, workedMinutes };
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function validateClockOutInput(str) {
  if (!/^\d{4}$/.test(str)) return { valid: false, value: null, error: 'Must be 4 digits (e.g. 1730)' };
  const num = parseInt(str, 10);
  const hh = Math.floor(num / 100);
  const mm = num % 100;
  if (hh > 23 || mm > 59) return { valid: false, value: null, error: 'Invalid time (HH: 00-23, MM: 00-59)' };
  return { valid: true, value: num, error: null };
}

function isClockOutAfterStart(start, clockOut) {
  return clockOutToMinutes(clockOut) > start * 60;
}

function getMonthDays(year, month) {
  const days = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function dateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayName(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function getMonthTotalMinutes(employeeId, year, month) {
  const monthEntries = getMonthEntries(employeeId, year, month);
  return Object.values(monthEntries).reduce((sum, entry) => {
    if (!entry.clockOut) return sum;
    return sum + calcDay(entry.start, entry.clockOut).workedMinutes;
  }, 0);
}
```

- [ ] **Verify in browser console:**

```js
calcDay(7, 1730)
// → { rawMinutes: 630, lunchDeducted: true, workedMinutes: 570 }

calcDay(8, 1300)
// → { rawMinutes: 300, lunchDeducted: false, workedMinutes: 300 }

formatMinutes(570)
// → "9h 30m"

formatMinutes(300)
// → "5h 0m"

validateClockOutInput('1730')
// → { valid: true, value: 1730, error: null }

validateClockOutInput('abc')
// → { valid: false, ... error: 'Must be 4 digits...' }

validateClockOutInput('2560')
// → { valid: false, ... error: 'Invalid time...' }

isClockOutAfterStart(7, 0700)
// → false  (700 minutes = 0*60+700... wait — clockOutToMinutes(700) = 7*60+0 = 420, start=7*60=420, 420>420 is false ✓)

isClockOutAfterStart(7, 0701)
// → true

getMonthDays(2026, 5).length
// → 31

getMonthDays(2026, 2).length
// → 28

dateToStr(new Date(2026, 4, 12))
// → "2026-05-12"
```

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: LOGIC layer (pure time-calculation functions)"
```

---

### Task 4: ROUTER + app shell render

**Files:**
- Modify: `timesheet.html` — replace `// --- RENDER ---` stub with shell helpers, replace `// --- ROUTER ---` with full router

- [ ] **Replace `// --- RENDER ---` with these shell functions (the full RENDER section will be filled in subsequent tasks):**

```js
// --- RENDER ---

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderApp(content, headerRight = '') {
  document.getElementById('app').innerHTML = `
    <header id="app-header">
      <h1>Timesheet</h1>
      <div>${headerRight}</div>
    </header>
    <div id="app-content">${content}</div>
  `;
}

function renderDashboard() {
  renderApp('<div class="empty-state"><p>Dashboard loading...</p></div>');
}

function renderEmployeeView(id, year, month) {
  const emp = getEmployees().find(e => e.id === id);
  if (!emp) { navigate('#dashboard'); return; }
  renderApp(`<p>Employee view: ${escHtml(emp.name)} — ${year}/${month} (coming soon)</p>`);
}

// Forward-reference stubs — replaced by full implementations in Tasks 10–11.
// Required here so reRenderRow (Task 9) can safely wire listeners before those tasks run.
function startStartEdit() {}
function showRowModal() {}
function deleteDayEntry() {}
```

- [ ] **Replace `// --- ROUTER ---` with:**

```js
// --- ROUTER ---

function navigate(hash) {
  location.hash = hash;
}

function router() {
  const hash = location.hash || '#dashboard';
  const parts = hash.slice(1).split('/');

  if (parts[0] === 'employee' && parts[1] && parts[2] && parts[3]) {
    renderEmployeeView(parts[1], Number(parts[2]), Number(parts[3]));
  } else {
    renderDashboard();
  }
}

window.addEventListener('hashchange', router);
document.addEventListener('DOMContentLoaded', router);
```

- [ ] **Verify in browser:**

1. Open `timesheet.html` → see "Dashboard loading..."
2. In console: `navigate('#employee/abc/2026/5')` → "Employee view: coming soon" (employee not found → redirects to dashboard — this is correct)
3. In console: `addEmployee('Test','Dept',7); router()` → "Dashboard loading..." (will be replaced in Task 5)
4. In console: `navigate('#employee/' + getEmployees()[0].id + '/2026/5')` → see employee stub message
5. Browser Back button → returns to previous hash

- [ ] **Clean up test data:**

```js
localStorage.clear()
```

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: router and app shell"
```

---

### Task 5: Dashboard — employee cards

**Files:**
- Modify: `timesheet.html` — replace stub `renderDashboard` with full implementation

- [ ] **Replace the stub `renderDashboard` function with:**

```js
function renderDashboard() {
  const employees = getEmployees();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const cardsHTML = employees.length === 0
    ? `<div class="empty-state"><p>No employees yet. Add one to get started.</p></div>`
    : `<div class="card-grid">${employees.map(emp => {
        const totalMin = getMonthTotalMinutes(emp.id, year, month);
        const totalStr = totalMin > 0 ? formatMinutes(totalMin) : 'No entries yet';
        return `
          <div class="employee-card" data-id="${emp.id}" role="button" tabindex="0">
            <button class="delete-btn" data-del="${emp.id}" title="Delete employee">✕</button>
            <div class="emp-name">${escHtml(emp.name)}</div>
            <div class="emp-dept">${escHtml(emp.department)}</div>
            <div class="emp-total">${totalStr}</div>
            <div class="emp-total-label">${MONTH_NAMES[month-1]} ${year}</div>
          </div>
        `;
      }).join('')}
    </div>`;

  renderApp(
    cardsHTML,
    `<button class="btn btn-primary" id="add-emp-btn">+ Add Employee</button>`
  );

  document.querySelectorAll('.employee-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-del]')) return;
      navigate(`#employee/${card.dataset.id}/${year}/${month}`);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.target.closest('[data-del]')) {
        navigate(`#employee/${card.dataset.id}/${year}/${month}`);
      }
    });
  });

  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const emp = employees.find(em => em.id === btn.dataset.del);
      showDeleteConfirmation(emp);
    });
  });

  document.getElementById('add-emp-btn').addEventListener('click', showAddEmployeeModal);
}
```

- [ ] **Verify in browser:**

1. Open `timesheet.html` → see "No employees yet." message and sticky header with "Timesheet" title
2. In console: `addEmployee('Alice','Engineering',7); router()` → Alice's card appears
3. In console: `addEmployee('Bob','Finance',8); router()` → two cards in a grid
4. Hover a card → slight lift (shadow + translateY)
5. Click card → navigates to employee stub view (Task 8 fills this out)
6. ✕ button visible on hover of card (delete not wired yet — added in Task 7)

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: dashboard employee cards"
```

---

### Task 6: Add Employee modal

**Files:**
- Modify: `timesheet.html` — add `showModal`, `closeModal`, `showAddEmployeeModal` to RENDER section (after `renderEmployeeView`)

- [ ] **Add these three functions after `renderEmployeeView`:**

```js
function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  overlay.querySelector('[autofocus]')?.focus();
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}

function showAddEmployeeModal() {
  showModal(`
    <h2>Add Employee</h2>
    <div class="form-group">
      <label>Name *</label>
      <input type="text" id="emp-name" autofocus placeholder="Full name">
    </div>
    <div class="form-group">
      <label>Department</label>
      <input type="text" id="emp-dept" placeholder="e.g. Engineering">
    </div>
    <div class="form-group">
      <label>Default Shift Start</label>
      <div class="radio-group">
        <label><input type="radio" name="emp-start" value="7" checked> 7:00</label>
        <label><input type="radio" name="emp-start" value="8"> 8:00</label>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-emp-btn">Save</button>
    </div>
  `);

  const nameInput = document.getElementById('emp-name');
  nameInput.addEventListener('input', () => nameInput.classList.remove('error'));

  document.getElementById('save-emp-btn').addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.classList.add('error'); nameInput.focus(); return; }
    const dept = document.getElementById('emp-dept').value;
    const start = document.querySelector('input[name="emp-start"]:checked').value;
    addEmployee(name, dept, start);
    closeModal();
    router();
  });
}
```

- [ ] **Verify in browser:**

1. Click "+ Add Employee" → modal slides up with dark overlay
2. Click outside modal → closes
3. Click Save with empty name → name input turns red, focus stays on it
4. Type a name → red border clears
5. Fill in Name "Carol", Department "HR", select 8:00, click Save → Carol's card appears in the dashboard
6. Card shows "No entries yet" and the current month/year

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: add employee modal"
```

---

### Task 7: Delete Employee confirmation

**Files:**
- Modify: `timesheet.html` — add `showDeleteConfirmation` to RENDER section (after `showAddEmployeeModal`)

- [ ] **Add after `showAddEmployeeModal`:**

```js
function showDeleteConfirmation(employee) {
  showModal(`
    <h2>Delete Employee</h2>
    <p style="color: var(--text-muted); margin-bottom: 8px; line-height: 1.5;">
      Delete <strong>${escHtml(employee.name)}</strong>?
      This will permanently remove all their time entries.
    </p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="confirm-del-btn">Delete</button>
    </div>
  `);

  document.getElementById('confirm-del-btn').addEventListener('click', () => {
    deleteEmployee(employee.id);
    closeModal();
    router();
  });
}
```

- [ ] **Verify in browser:**

1. Click ✕ on an employee card → confirmation dialog appears with employee name in bold
2. Click Cancel → dialog closes, employee still present
3. Click Delete (red button) → employee card disappears, localStorage cleared for that employee
4. Adding the employee back shows "No entries yet" (data was cleared)

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: delete employee with confirmation"
```

---

### Task 8: Employee Monthly View — read-only table

**Files:**
- Modify: `timesheet.html` — replace stub `renderEmployeeView` with full implementation; add `buildTableRow` and `attachMonthlyViewListeners`

- [ ] **Replace the stub `renderEmployeeView` with this full implementation (and add the two helper functions directly after it):**

```js
function renderEmployeeView(id, year, month) {
  const emp = getEmployees().find(e => e.id === id);
  if (!emp) { navigate('#dashboard'); return; }

  const monthEntries = getMonthEntries(id, year, month);
  const days = getMonthDays(year, month);
  const totalMin = getMonthTotalMinutes(id, year, month);
  const hasEntries = Object.keys(monthEntries).length > 0;

  const monthOpts = MONTH_NAMES.map((name, i) =>
    `<option value="${i+1}" ${i+1 === month ? 'selected' : ''}>${name}</option>`
  ).join('');
  const yearOpts = Array.from({length: 11}, (_, i) => 2020 + i).map(y =>
    `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
  ).join('');

  const tableRows = days.map(date => buildTableRow(emp, date, monthEntries)).join('');

  const html = `
    <div class="view-header">
      <div>
        <div class="breadcrumb"><a href="#dashboard">← Dashboard</a></div>
        <div class="view-title">${escHtml(emp.name)}</div>
        <div class="view-subtitle">${escHtml(emp.department)}</div>
      </div>
      <div class="view-controls">
        <select class="month-sel" id="month-sel">${monthOpts}</select>
        <select class="year-sel" id="year-sel">${yearOpts}</select>
        <button class="btn btn-primary" id="export-pdf-btn" ${!hasEntries ? 'disabled' : ''}>
          Export PDF
        </button>
      </div>
    </div>
    <div class="ts-table-wrap">
      <table class="ts-table" id="ts-table">
        <thead>
          <tr>
            <th>Date</th><th>Day</th><th>Shift Start</th>
            <th>Clock-Out</th><th>Hours Worked</th>
            <th>Lunch</th><th>Daily Total</th><th></th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="6">Monthly Total</td>
            <td id="monthly-total-cell">${totalMin > 0 ? formatMinutes(totalMin) : '—'}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  renderApp(html);
  attachMonthlyViewListeners(emp, id, year, month);
}

function buildTableRow(emp, date, monthEntries) {
  const dateStr = dateToStr(date);
  const entry = monthEntries[dateStr] ?? null;
  const weekend = isWeekend(date);
  const startVal = entry ? entry.start : emp.defaultStart;

  const displayDate = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`;
  const dayName = getDayName(date);

  let hoursWorked = '', lunch = '', dailyTotal = '';
  if (entry && entry.clockOut) {
    const calc = calcDay(entry.start, entry.clockOut);
    hoursWorked = formatMinutes(calc.rawMinutes);
    lunch = calc.lunchDeducted ? 'Yes' : 'No';
    dailyTotal = formatMinutes(calc.workedMinutes);
  }

  const clockOutDisplay = entry?.clockOut ? String(entry.clockOut).padStart(4, '0') : '';
  const rowClass = [weekend ? 'weekend' : '', entry ? 'has-entry' : ''].filter(Boolean).join(' ');

  return `
    <tr class="${rowClass}" data-date="${dateStr}">
      <td>${displayDate}</td>
      <td>${dayName}</td>
      <td class="editable start-cell" data-field="start">${startVal}:00</td>
      <td class="editable clockout-cell" data-field="clockout">${clockOutDisplay}</td>
      <td>${hoursWorked}</td>
      <td>${lunch}</td>
      <td>${dailyTotal}</td>
      <td class="row-actions">
        <button class="row-edit-btn" data-date="${dateStr}" title="Edit">✎</button>
        ${entry?.clockOut ? `<button class="row-del-btn" data-date="${dateStr}" title="Clear entry">✕</button>` : ''}
      </td>
    </tr>
  `;
}

function attachMonthlyViewListeners(emp, id, year, month) {
  document.getElementById('month-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${year}/${e.target.value}`);
  });
  document.getElementById('year-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${e.target.value}/${month}`);
  });
  // Inline editing and row modal wired in Tasks 9–11
}
```

- [ ] **Verify in browser:**

1. Click an employee card → employee view loads with breadcrumb "← Dashboard"
2. Table shows all 31 rows for May 2026 (or correct count for current month)
3. Weekend rows (Sat/Sun) have a slightly different background
4. All Clock-Out cells are blank, Shift Start shows the employee's default (7:00 or 8:00)
5. Monthly total shows "—"
6. "Export PDF" button is disabled (greyed out)
7. Change Month dropdown → URL updates and table re-renders for new month
8. Change Year dropdown → same
9. Click "← Dashboard" → back to dashboard
10. Browser Back button also works

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: employee monthly view with pre-populated calendar table"
```

---

### Task 9: Inline clock-out editing

**Files:**
- Modify: `timesheet.html` — add `attachInlineClockOutEditing`, `startClockOutEdit`, `reRenderRow`, `updateMonthTotal`, `updateExportBtn`; update `attachMonthlyViewListeners`

- [ ] **Add these functions to the RENDER section (after `attachMonthlyViewListeners`):**

```js
function attachInlineClockOutEditing(emp, id, year, month) {
  document.querySelectorAll('.clockout-cell').forEach(cell => {
    cell.addEventListener('click', () => startClockOutEdit(cell, emp, id, year, month));
  });
}

function startClockOutEdit(cell, emp, id, year, month) {
  if (cell.querySelector('input')) return;
  const dateStr = cell.closest('tr').dataset.date;
  const current = cell.textContent.trim();

  const input = document.createElement('input');
  input.className = 'cell-input';
  input.value = current;
  input.maxLength = 4;
  input.placeholder = 'HHMM';
  cell.textContent = '';
  cell.appendChild(input);
  input.focus();
  input.select();

  let committed = false;

  function commit() {
    if (committed) return;
    committed = true;
    const val = input.value.trim();

    if (val === '' || val === current) {
      reRenderRow(dateStr, emp, id, year, month);
      return;
    }

    const { valid, value, error } = validateClockOutInput(val);
    if (!valid) {
      committed = false;
      input.classList.add('error');
      input.title = error;
      input.select();
      return;
    }

    const entry = getDayEntry(id, dateStr);
    const start = entry ? entry.start : emp.defaultStart;

    if (!isClockOutAfterStart(start, value)) {
      committed = false;
      input.classList.add('error');
      input.title = 'Clock-out must be after shift start';
      input.select();
      return;
    }

    setDayEntry(id, dateStr, { start, clockOut: value });
    reRenderRow(dateStr, emp, id, year, month);
    updateMonthTotal(id, year, month);
    updateExportBtn(id, year, month);
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { committed = true; reRenderRow(dateStr, emp, id, year, month); }
  });
  input.addEventListener('blur', commit);
}

function reRenderRow(dateStr, emp, id, year, month) {
  const monthEntries = getMonthEntries(id, year, month);
  const date = new Date(dateStr + 'T12:00:00');
  const newRowHtml = buildTableRow(emp, date, monthEntries);
  const row = document.querySelector(`tr[data-date="${dateStr}"]`);
  if (!row) return;
  const tmp = document.createElement('tbody');
  tmp.innerHTML = newRowHtml;
  const newRow = tmp.firstElementChild;
  row.replaceWith(newRow);

  const clockoutCell = newRow.querySelector('.clockout-cell');
  if (clockoutCell) clockoutCell.addEventListener('click', () => startClockOutEdit(clockoutCell, emp, id, year, month));
  const startCell = newRow.querySelector('.start-cell');
  if (startCell) startCell.addEventListener('click', () => startStartEdit(startCell, emp, id, year, month));
  const editBtn = newRow.querySelector('.row-edit-btn');
  if (editBtn) editBtn.addEventListener('click', () => showRowModal(editBtn.dataset.date, emp, id, year, month));
  const delBtn = newRow.querySelector('.row-del-btn');
  if (delBtn) delBtn.addEventListener('click', () => deleteDayEntry(delBtn.dataset.date, emp, id, year, month));
}

function updateMonthTotal(id, year, month) {
  const cell = document.getElementById('monthly-total-cell');
  if (!cell) return;
  const totalMin = getMonthTotalMinutes(id, year, month);
  cell.textContent = totalMin > 0 ? formatMinutes(totalMin) : '—';
}

function updateExportBtn(id, year, month) {
  const btn = document.getElementById('export-pdf-btn');
  if (!btn) return;
  btn.disabled = Object.keys(getMonthEntries(id, year, month)).length === 0;
}
```

- [ ] **Update `attachMonthlyViewListeners` to call `attachInlineClockOutEditing`:**

Replace the existing `attachMonthlyViewListeners` with:
```js
function attachMonthlyViewListeners(emp, id, year, month) {
  document.getElementById('month-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${year}/${e.target.value}`);
  });
  document.getElementById('year-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${e.target.value}/${month}`);
  });
  attachInlineClockOutEditing(emp, id, year, month);
  // Shift start inline + row modal wired in Tasks 10–11
}
```

- [ ] **Verify in browser:**

1. Click a Clock-Out cell → text input appears with `HHMM` placeholder
2. Type `1730`, press Enter → row updates: Hours Worked `10h 30m` (for 7:00 start), Lunch `Yes`, Daily Total `9h 30m`
3. Monthly total updates at bottom
4. Export PDF button becomes enabled
5. Click same Clock-Out cell, press Escape → reverts
6. Type `0700` on a 7:00 start row → red border (not after start), stays in edit mode
7. Type `abcd` → red border
8. Navigate away and back → entry persists (saved in localStorage)

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: inline clock-out editing with validation"
```

---

### Task 10: Inline shift start editing

**Files:**
- Modify: `timesheet.html` — add `attachInlineStartEditing`, `startStartEdit`; update `attachMonthlyViewListeners`

- [ ] **Add these functions after `updateExportBtn`:**

```js
function attachInlineStartEditing(emp, id, year, month) {
  document.querySelectorAll('.start-cell').forEach(cell => {
    cell.addEventListener('click', () => startStartEdit(cell, emp, id, year, month));
  });
}

function startStartEdit(cell, emp, id, year, month) {
  if (cell.querySelector('select')) return;
  const dateStr = cell.closest('tr').dataset.date;
  const entry = getDayEntry(id, dateStr);
  const currentStart = entry ? entry.start : emp.defaultStart;

  const sel = document.createElement('select');
  sel.className = 'cell-select';
  sel.innerHTML = `
    <option value="7" ${currentStart === 7 ? 'selected' : ''}>7:00</option>
    <option value="8" ${currentStart === 8 ? 'selected' : ''}>8:00</option>
  `;
  cell.textContent = '';
  cell.appendChild(sel);
  sel.focus();

  sel.addEventListener('change', () => {
    const newStart = Number(sel.value);
    if (entry && entry.clockOut) {
      setDayEntry(id, dateStr, { start: newStart, clockOut: entry.clockOut });
      reRenderRow(dateStr, emp, id, year, month);
      updateMonthTotal(id, year, month);
    } else {
      cell.textContent = `${newStart}:00`;
    }
  });

  sel.addEventListener('blur', () => {
    if (!entry?.clockOut) cell.textContent = `${currentStart}:00`;
  });

  sel.addEventListener('keydown', e => {
    if (e.key === 'Escape') cell.textContent = `${currentStart}:00`;
  });
}
```

- [ ] **Update `attachMonthlyViewListeners` again:**

```js
function attachMonthlyViewListeners(emp, id, year, month) {
  document.getElementById('month-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${year}/${e.target.value}`);
  });
  document.getElementById('year-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${e.target.value}/${month}`);
  });
  attachInlineClockOutEditing(emp, id, year, month);
  attachInlineStartEditing(emp, id, year, month);
  // Row modal wired in Task 11
}
```

- [ ] **Verify in browser:**

1. On a row WITH a clock-out: click Shift Start → dropdown shows 7:00/8:00
2. Change to 8:00 → row recalculates immediately (fewer hours, different lunch deduction), monthly total updates
3. On a row WITHOUT a clock-out: click Shift Start → dropdown appears, change it → display updates but nothing saved (verify with `getDayEntry(id, '2026-05-01')` → still null)
4. Press Escape on the dropdown → reverts to previous value

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: inline shift start editing"
```

---

### Task 11: Row edit modal and delete day entry

**Files:**
- Modify: `timesheet.html` — add `showRowModal`, `attachRowButtons`, `deleteDayEntry`; update `attachMonthlyViewListeners`

- [ ] **Add these functions after `startStartEdit`:**

```js
function showRowModal(dateStr, emp, id, year, month) {
  const entry = getDayEntry(id, dateStr);
  const currentStart = entry ? entry.start : emp.defaultStart;
  const currentClockOut = entry?.clockOut ? String(entry.clockOut).padStart(4, '0') : '';
  const date = new Date(dateStr + 'T12:00:00');
  const displayDate = date.toLocaleDateString('en-US', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  showModal(`
    <h2>Edit Entry</h2>
    <p style="color: var(--text-muted); margin-bottom: 16px; font-size: 0.9rem;">${displayDate}</p>
    <div class="form-group">
      <label>Shift Start</label>
      <div class="radio-group">
        <label><input type="radio" name="modal-start" value="7" ${currentStart === 7 ? 'checked' : ''}> 7:00</label>
        <label><input type="radio" name="modal-start" value="8" ${currentStart === 8 ? 'checked' : ''}> 8:00</label>
      </div>
    </div>
    <div class="form-group">
      <label>Clock-Out (24h, e.g. 1730)</label>
      <input type="text" id="modal-clockout" autofocus maxlength="4" placeholder="HHMM" value="${currentClockOut}">
      <div id="modal-error" style="color: var(--danger); font-size: 0.8rem; margin-top: 4px; min-height: 1.2em;"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="modal-save-btn">Save</button>
    </div>
  `);

  const clockoutInput = document.getElementById('modal-clockout');
  const errEl = document.getElementById('modal-error');

  clockoutInput.addEventListener('input', () => { errEl.textContent = ''; });
  clockoutInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('modal-save-btn').click();
    if (e.key === 'Escape') closeModal();
  });

  document.getElementById('modal-save-btn').addEventListener('click', () => {
    const clockOutStr = clockoutInput.value.trim();
    const startVal = Number(document.querySelector('input[name="modal-start"]:checked').value);

    if (!clockOutStr) {
      clearDayEntry(id, dateStr);
      closeModal();
      reRenderRow(dateStr, emp, id, year, month);
      updateMonthTotal(id, year, month);
      updateExportBtn(id, year, month);
      return;
    }

    const { valid, value, error } = validateClockOutInput(clockOutStr);
    if (!valid) { errEl.textContent = error; return; }
    if (!isClockOutAfterStart(startVal, value)) {
      errEl.textContent = 'Clock-out must be after shift start';
      return;
    }

    setDayEntry(id, dateStr, { start: startVal, clockOut: value });
    closeModal();
    reRenderRow(dateStr, emp, id, year, month);
    updateMonthTotal(id, year, month);
    updateExportBtn(id, year, month);
  });
}

function attachRowButtons(emp, id, year, month) {
  document.querySelectorAll('.row-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => showRowModal(btn.dataset.date, emp, id, year, month));
  });
  document.querySelectorAll('.row-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteDayEntry(btn.dataset.date, emp, id, year, month));
  });
}

function deleteDayEntry(dateStr, emp, id, year, month) {
  clearDayEntry(id, dateStr);
  reRenderRow(dateStr, emp, id, year, month);
  updateMonthTotal(id, year, month);
  updateExportBtn(id, year, month);
}
```

- [ ] **Update `attachMonthlyViewListeners` to its final form:**

```js
function attachMonthlyViewListeners(emp, id, year, month) {
  document.getElementById('month-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${year}/${e.target.value}`);
  });
  document.getElementById('year-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${e.target.value}/${month}`);
  });
  attachInlineClockOutEditing(emp, id, year, month);
  attachInlineStartEditing(emp, id, year, month);
  attachRowButtons(emp, id, year, month);
}
```

- [ ] **Verify in browser:**

1. Click ✎ on any row → modal opens showing the date (e.g. "Monday, 12 May 2026")
2. On a blank row: fill in start 7:00, clock-out `1600`, Save → row updates, total updates
3. Open modal again, clear clock-out field, Save → row goes blank (entry deleted)
4. On a filled row: click ✕ → row goes blank instantly (no confirmation needed)
5. Invalid clock-out in modal → error message appears below the input, modal stays open
6. Press Escape in clock-out input → modal closes
7. Press Enter in clock-out input → saves

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: row edit modal and delete day entry"
```

---

### Task 12: PDF Export

**Files:**
- Modify: `timesheet.html` — add `exportPDF`; wire up Export PDF button in `attachMonthlyViewListeners`

- [ ] **Add `exportPDF` function to RENDER section (after `deleteDayEntry`):**

```js
function exportPDF(emp, id, year, month) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const monthName = MONTH_NAMES[month - 1];

  doc.setFontSize(18);
  doc.setTextColor(74, 111, 165);
  doc.text('Timesheet', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(44, 62, 80);
  doc.text(`Employee:   ${emp.name}`, 14, 28);
  doc.text(`Department: ${emp.department}`, 14, 34);
  doc.text(`Period:     ${monthName} ${year}`, 14, 40);

  const days = getMonthDays(year, month);
  const monthEntries = getMonthEntries(id, year, month);

  const body = days.map(date => {
    const dateStr = dateToStr(date);
    const entry = monthEntries[dateStr] ?? null;
    const displayDate = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${year}`;
    const startVal = entry ? entry.start : emp.defaultStart;

    if (entry && entry.clockOut) {
      const calc = calcDay(entry.start, entry.clockOut);
      return [
        displayDate,
        getDayName(date),
        `${startVal}:00`,
        String(entry.clockOut).padStart(4, '0'),
        formatMinutes(calc.rawMinutes),
        calc.lunchDeducted ? 'Yes' : 'No',
        formatMinutes(calc.workedMinutes)
      ];
    }
    return [displayDate, getDayName(date), `${startVal}:00`, '', '', '', ''];
  });

  const totalMin = getMonthTotalMinutes(id, year, month);
  body.push(['', '', '', '', '', 'Total', totalMin > 0 ? formatMinutes(totalMin) : '—']);

  doc.autoTable({
    startY: 48,
    head: [['Date', 'Day', 'Start', 'Clock-Out', 'Hours', 'Lunch', 'Total']],
    body,
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [44, 62, 80] },
    headStyles: { fillColor: [74, 111, 165], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    didParseCell(data) {
      if (data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [238, 243, 250];
      }
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 14 },
      2: { cellWidth: 18 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 16 },
      6: { cellWidth: 22 }
    }
  });

  const safeName = emp.name.replace(/[^a-z0-9]/gi, '_');
  doc.save(`Timesheet_${safeName}_${monthName}_${year}.pdf`);
}
```

- [ ] **Update `attachMonthlyViewListeners` to wire the Export PDF button (final form):**

```js
function attachMonthlyViewListeners(emp, id, year, month) {
  document.getElementById('month-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${year}/${e.target.value}`);
  });
  document.getElementById('year-sel').addEventListener('change', e => {
    navigate(`#employee/${id}/${e.target.value}/${month}`);
  });
  attachInlineClockOutEditing(emp, id, year, month);
  attachInlineStartEditing(emp, id, year, month);
  attachRowButtons(emp, id, year, month);
  document.getElementById('export-pdf-btn').addEventListener('click', () => {
    exportPDF(emp, id, year, month);
  });
}
```

- [ ] **Verify in browser:**

1. Add several time entries for an employee across multiple days
2. Click "Export PDF" → browser downloads `Timesheet_Alice_May_2026.pdf`
3. Open the PDF:
   - Header shows employee name, department, and "Period: May 2026"
   - Table has blue header row: Date, Day, Start, Clock-Out, Hours, Lunch, Total
   - Alternating light grey/white rows
   - Filled rows show all columns; blank rows have empty Hours/Lunch/Total
   - Last row is bold with "Total" label and monthly total in the final column
4. Employee name with spaces: `"John Smith"` → filename `Timesheet_John_Smith_May_2026.pdf`
5. Month with no entries: Export PDF button is disabled (grey, non-clickable)

- [ ] **Commit**

```
git add timesheet.html
git commit -m "feat: PDF export with jsPDF AutoTable"
```

---

## Self-Review Checklist

After all tasks are implemented, verify against spec:

| Requirement | Covered by |
|---|---|
| Shift start fixed at 7 or 8 | Task 3 (`calcDay`), Task 10 |
| Clock-out keyed in 24h format | Task 9, 11 |
| Timesheet hours = duration − lunch | Task 3 (`calcDay`) |
| Lunch deduction if > 5h | Task 3 (`rawMinutes > 300`) |
| Display as hours and minutes | Task 3 (`formatMinutes`) |
| Multiple employees | Task 2 (`addEmployee`) |
| Employee: name, dept, default shift | Task 6 (`showAddEmployeeModal`) |
| Time entries per employee per day | Task 2 (`setDayEntry`) |
| Monthly totals by calendar month | Task 3 (`getMonthTotalMinutes`) |
| localStorage persistence | Task 2 |
| Dashboard with employee cards | Task 5 |
| Card: name, dept, current month total | Task 5 |
| Add employee button | Task 6 |
| Delete employee with confirmation | Task 7 |
| Click card → monthly view | Task 5 (navigate) |
| Month/Year dropdown | Task 8 |
| Table: all calendar days pre-populated | Task 8 (`buildTableRow`) |
| Shift start editable (inline) | Task 10 |
| Clock-out editable (inline) | Task 9 |
| Both inline and modal editing | Tasks 9, 10, 11 |
| Add/edit/delete day entries | Tasks 9, 11 |
| Monthly total at bottom | Task 8 (`id="monthly-total-cell"`) |
| PDF export button (disabled when empty) | Tasks 8, 12 |
| PDF: name, dept, month/year | Task 12 |
| PDF: table with all columns | Task 12 |
| PDF: all calendar days | Task 12 |
| PDF: monthly total footer row | Task 12 |
| Single HTML file, vanilla JS/CSS | Task 1 |
| jsPDF + AutoTable via CDN | Task 1 |

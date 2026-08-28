# Client Feedback Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 client-reported feedback items: (1) merge reviewed/approved fields on maintenance, (2) admin-side password reset on the Users table, (3) rearchitect mixing steps into individual sub-batches with material-code IDs and per-step QC, (4) add back buttons to all detail pages.

**Architecture:** Tasks 1, 2, and 4 are quick UI fixes. Task 3 is a significant frontend rearchitecture of the mixing flow — currently, mixing logs steps (add material / mix round) as rows in the `mixing_steps` table under one parent batch. The new model: each "Add Material" step additionally creates a child row in `batches` (with ID format `MIXC-20260618-A01-MTC1`) and immediately prompts for a QC check on that sub-batch before the next material can be added. The `mixing_steps` table continues to be the step log; the new `batches` child rows are the traceable sub-batches the client wants for compliance. No DB migrations required — the `batches` table already supports parent-child via `parent_batch_id`, and QC results already reference batch IDs.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase JS client, Playwright.

**Prerequisite:** Pull `origin/dev` before starting — Jonny's profile/password work and Ethan's sprint 5 batch features must be in the working tree. The branch should be `feature/client-feedback-fixes` based off the latest `dev`.

## Global Constraints

- All Supabase calls mocked in tests via `page.route()` — never hit the live DB.
- Do not use call counters for mock variation (AuthProvider fires effects twice).
- Feature branch workflow: `feature/client-feedback-fixes` → PR into `dev`.
- `npm test` must pass (all existing + new tests) before push.
- RLS is ON — no service-role workarounds.
- Match existing dark theme: bg `#0e0e0e`/`#111111`/`#161616`, borders `#2a2a2a`, text `#f5f5f5`/`#888888`, accent `#22c55e`.
- No DB migrations. No destructive SQL against the live DB.

---

## File structure

| File | Change | Task |
|---|---|---|
| `playwright.config.ts` | Add `sprint6` project | 1 |
| `components/machines/log-maintenance-panel.tsx` | Merge two fields into one; write value to both DB columns | 1 |
| `tests/sprint6/maintenance-reviewed-approved.spec.ts` | New — test merged field | 1 |
| `app/actions/admin-users.ts` | New `adminResetPassword` server action | 2 |
| `app/admin/page.tsx` | Add "Reset Password" button per user row + modal | 2 |
| `tests/sprint6/admin-reset-password.spec.ts` | New — test admin password reset | 2 |
| `components/mixing/mixing-operator-page.tsx` | Rearchitect: after each "Add Material", create a child batch + prompt inline QC | 3 |
| `components/subbatch/add-step-modal.tsx` | Return material code in the step result so the parent can create the sub-batch | 3 |
| `components/mixing/mixing-qc-gate.tsx` | New — inline QC form shown after each material addition sub-batch is created | 3 |
| `tests/sprint6/mixing-subbatch-qc.spec.ts` | New — test the full mixing sub-batch + QC flow | 3 |
| `app/batches/[id]/page.tsx` | Add back button | 4 |
| `app/batches/[id]/[subId]/page.tsx` | Add back button | 4 |
| `app/lots/[id]/page.tsx` | Add back button | 4 |
| `app/log/mixing/[batchId]/page.tsx` | Already has a back button (router.back()) — no change needed | 4 |
| `tests/sprint6/back-buttons.spec.ts` | New — test back buttons on all detail pages | 4 |

---

### Task 1: Merge reviewed/approved into single field + sprint6 scaffold

**Files:**
- Modify: `playwright.config.ts`
- Modify: `components/machines/log-maintenance-panel.tsx`
- Create: `tests/sprint6/maintenance-reviewed-approved.spec.ts`

**Interfaces:**
- Consumes: `equipment_maintenance` table (`reviewed_by UUID`, `approved_by UUID`)
- Produces: single "Reviewed & Approved By" text input; DB insert sends the same value to both columns

- [ ] **Step 1: Add sprint6 project to Playwright config**

Add after the sprint4 (or sprint5, if present on dev) project block:

```ts
{
  name: 'sprint6',
  testDir: './tests/sprint6',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'tests/.auth/engineer.json',
  },
  dependencies: ['setup'],
},
```

- [ ] **Step 2: Write the failing test**

Create `tests/sprint6/maintenance-reviewed-approved.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const EQ_ID = '22222222-2222-2222-2222-222222222222'

async function adminUser(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/users**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ full_name: 'Dev Admin', role_id: 'r-admin', roles: { name: 'Admin' } }),
  }))
}

async function processesMock(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/processes**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 'p1', name: 'Mixing (Cathode)' }]),
  }))
}

function machineRow() {
  return {
    id: EQ_ID, equipment_code: 'MA001', name: '60L Mixer', process_id: 'p1',
    supplier_info: null, is_active: true, created_at: '2026-06-05',
    checklist_template: [], process: { name: 'Mixing (Cathode)', code: 'MIXC' },
    equipment_maintenance: [],
  }
}

test('Log Maintenance shows single "Reviewed & Approved By" field and writes to both DB columns', async ({ page }) => {
  await adminUser(page)
  await processesMock(page)
  await page.route(`**${SB}/rest/v1/equipment**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([machineRow()]),
  }))

  let maintBody: any = null
  await page.route(`**${SB}/rest/v1/equipment_maintenance**`, async route => {
    if (route.request().method() === 'POST') {
      maintBody = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.goto('/machines')
  await page.getByRole('row', { name: /MA001/ }).click()
  await page.getByRole('button', { name: 'Log Maintenance' }).click()

  // Old separate fields should NOT exist
  await expect(page.getByLabel('Reviewed By')).toHaveCount(0)
  await expect(page.getByLabel('Approved By')).toHaveCount(0)

  // New merged field should exist
  const mergedField = page.getByLabel('Reviewed & Approved By')
  await expect(mergedField).toBeVisible()
  await mergedField.fill('John Smith')

  await page.getByPlaceholder('Describe work performed...').fill('Routine check')
  await page.getByRole('button', { name: 'Save Log' }).click()

  await expect.poll(() => maintBody?.reviewed_by).toBe('John Smith')
  await expect.poll(() => maintBody?.approved_by).toBe('John Smith')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx playwright test tests/sprint6/maintenance-reviewed-approved.spec.ts --project=sprint6`

- [ ] **Step 4: Implement the merge**

In `components/machines/log-maintenance-panel.tsx`:

1. Replace the two state variables with one:
```ts
// Replace:
const [reviewedBy, setReviewedBy]   = useState('');
const [approvedBy, setApprovedBy]   = useState('');
// With:
const [reviewedAndApprovedBy, setReviewedAndApprovedBy] = useState('');
```

2. Update `MaintenanceEntry` interface:
```ts
interface MaintenanceEntry {
  date: string;
  type: 'Preventive' | 'Corrective' | 'Calibration';
  tech: string;
  notes: string;
  reviewedAndApprovedBy?: string;
}
```

3. Update the DB insert — write the same value to both columns:
```ts
const reviewVal = reviewedAndApprovedBy.trim() || null;
// In the insert object:
reviewed_by: reviewVal,
approved_by: reviewVal,
```

4. Update the `onSaved` entry construction:
```ts
reviewedAndApprovedBy: reviewedAndApprovedBy.trim() || undefined,
```

5. Replace the two form field blocks with one:
```tsx
<div className="flex flex-col gap-1.5">
  <label htmlFor="reviewed-approved" className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Reviewed & Approved By</label>
  <input
    id="reviewed-approved"
    type="text"
    value={reviewedAndApprovedBy}
    onChange={e => setReviewedAndApprovedBy(e.target.value)}
    placeholder="Staff ID or name"
    className={inputCls}
  />
</div>
```

- [ ] **Step 5: Run all tests**

Run: `npm test`

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts components/machines/log-maintenance-panel.tsx tests/sprint6/maintenance-reviewed-approved.spec.ts
git commit -m "fix(machines): merge reviewed/approved into single field (client feedback)"
```

---

### Task 2: Admin password reset

**Files:**
- Modify: `app/actions/admin-users.ts`
- Modify: `app/admin/page.tsx`
- Create: `tests/sprint6/admin-reset-password.spec.ts`

**Interfaces:**
- Consumes: `getAdminClient()` (service-role Supabase client in server action), `admin.auth.admin.updateUserById()` (Supabase Admin API)
- Produces: `adminResetPassword(userId, newPassword)` server action; "Reset Password" button per user row in Admin Users table → opens a modal with password input → calls the server action

- [ ] **Step 1: Write the failing test**

Create `tests/sprint6/admin-reset-password.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

async function adminUser(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/users**select=full_name*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ full_name: 'Dev Admin', role_id: 'r-admin', roles: { name: 'Admin' } }),
  }))
}

const ROLES = [
  { id: 'r-admin', name: 'Admin' },
  { id: 'r-eng', name: 'Engineer' },
  { id: 'r-op', name: 'Operator' },
]

const USER_ROWS = [
  { id: 'u1', full_name: 'Alice Tan', staff_code: 'S001', role_id: 'r-eng', is_active: true, roles: { name: 'Engineer' } },
  { id: 'u2', full_name: 'Bob Lee', staff_code: 'S002', role_id: 'r-op', is_active: true, roles: { name: 'Operator' } },
]

test('Admin can reset a user password', async ({ page }) => {
  await adminUser(page)

  await page.route(`**${SB}/rest/v1/users*order=full_name*`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(USER_ROWS),
  }))
  await page.route(`**${SB}/rest/v1/roles**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(ROLES),
  }))

  await page.goto('/admin')

  // Click reset password button for Alice
  await page.getByRole('row', { name: /Alice Tan/ }).getByRole('button', { name: /Reset Password/i }).click()

  // Modal should appear
  await expect(page.getByText(/Reset password for Alice Tan/i)).toBeVisible()

  // Enter new password
  await page.getByLabel('New Password').fill('newpass123')
  await page.getByRole('button', { name: /Confirm Reset/i }).click()

  // Success feedback
  await expect(page.getByText(/password.*reset/i)).toBeVisible()
})

test('Reset password validates minimum length', async ({ page }) => {
  await adminUser(page)
  await page.route(`**${SB}/rest/v1/users*order=full_name*`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(USER_ROWS),
  }))
  await page.route(`**${SB}/rest/v1/roles**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(ROLES),
  }))

  await page.goto('/admin')
  await page.getByRole('row', { name: /Alice Tan/ }).getByRole('button', { name: /Reset Password/i }).click()

  await page.getByLabel('New Password').fill('123')
  await page.getByRole('button', { name: /Confirm Reset/i }).click()

  await expect(page.getByText(/at least 8 characters/i)).toBeVisible()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/sprint6/admin-reset-password.spec.ts --project=sprint6`

- [ ] **Step 3: Add `adminResetPassword` server action**

In `app/actions/admin-users.ts`, add at the end:

```ts
export async function adminResetPassword(
  userId: string,
  newPassword: string,
): Promise<{ error?: string }> {
  try {
    if (newPassword.length < 8) return { error: 'Password must be at least 8 characters' }
    const admin = getAdminClient()
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })
    if (authError) return { error: authError.message }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
```

- [ ] **Step 4: Add Reset Password button + modal to Admin Users table**

In `app/admin/page.tsx`:

1. Import the new action:
```ts
import {
  adminCreateUser, adminUpdateUser, adminDeleteUser, adminSetUserActive, adminResetPassword,
} from "@/app/actions/admin-users";
```

2. Add state for the reset password modal (near other modal state):
```ts
const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
const [resetPwUserName, setResetPwUserName] = useState('');
const [resetPwValue, setResetPwValue] = useState('');
const [resetPwError, setResetPwError] = useState<string | null>(null);
const [resetPwSuccess, setResetPwSuccess] = useState(false);
const [resetPwLoading, setResetPwLoading] = useState(false);
```

3. Add handler:
```ts
async function handleResetPassword() {
  if (!resetPwUserId) return;
  if (resetPwValue.length < 8) { setResetPwError('Password must be at least 8 characters'); return; }
  setResetPwLoading(true);
  setResetPwError(null);
  const result = await adminResetPassword(resetPwUserId, resetPwValue);
  setResetPwLoading(false);
  if (result.error) { setResetPwError(result.error); return; }
  setResetPwSuccess(true);
  setResetPwValue('');
}
```

4. Add a "Reset Password" button in each user row's action area (near the Edit/Delete buttons):
```tsx
<button
  onClick={() => {
    setResetPwUserId(u.id);
    setResetPwUserName(u.name);
    setResetPwValue('');
    setResetPwError(null);
    setResetPwSuccess(false);
  }}
  className="text-[12px] text-[#888888] hover:text-[#f5f5f5]"
>
  Reset Password
</button>
```

5. Add the modal (next to the existing Add User modal):
```tsx
{resetPwUserId && (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div className="w-full max-w-sm bg-[#111] border border-[#2a2a2a] rounded-2xl p-5 flex flex-col gap-4">
      <div className="text-[15px] font-semibold text-[#f5f5f5]">Reset password for {resetPwUserName}</div>
      <div className="flex flex-col gap-3">
        <label htmlFor="reset-pw" className="text-[12px] text-[#888888]">New Password</label>
        <input
          id="reset-pw"
          type="password"
          value={resetPwValue}
          onChange={e => setResetPwValue(e.target.value)}
          placeholder="Enter new password (min 8 chars)"
          className="h-10 px-3 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] outline-none focus:border-[#22c55e]"
        />
      </div>
      {resetPwError && <div className="text-[12px] text-[#fca5a5]">{resetPwError}</div>}
      {resetPwSuccess && <div className="text-[12px] text-[#22c55e]">Password has been reset successfully.</div>}
      <div className="flex gap-2 mt-1">
        <button onClick={() => setResetPwUserId(null)} className="flex-1 h-10 rounded-xl border border-[#2a2a2a] text-[13px] text-[#888888]">Cancel</button>
        <button
          onClick={handleResetPassword}
          disabled={resetPwLoading || !resetPwValue || resetPwSuccess}
          className="flex-1 h-10 rounded-xl bg-[#22c55e] text-[13px] font-semibold text-black disabled:opacity-40"
        >
          {resetPwLoading ? 'Resetting…' : 'Confirm Reset'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Run all tests**

Run: `npm test`

- [ ] **Step 6: Commit**

```bash
git add app/actions/admin-users.ts app/admin/page.tsx tests/sprint6/admin-reset-password.spec.ts
git commit -m "feat(admin): add password reset per user in Admin Users table"
```

---

### Task 3: Mixing steps as individual sub-batches with QC

This is the core rearchitecture. The flow changes from:

**Current:** Parent batch → log mixing steps (add material / mix round) → one QC at the end

**New:** Parent batch → "Add Material" creates a **child batch** (e.g. `MIXC-20260618-A01-MTC1`) in the `batches` table → inline QC gate on that child batch → next material → next child batch → next QC → … → mix rounds still logged as steps on the parent

The `mixing_steps` table continues to track the step log. Each `add_material` step now also creates a corresponding child batch row.

**Files:**
- Create: `components/mixing/mixing-qc-gate.tsx`
- Modify: `components/mixing/mixing-operator-page.tsx`
- Modify: `components/subbatch/add-step-modal.tsx`
- Create: `tests/sprint6/mixing-subbatch-qc.spec.ts`

**Interfaces:**
- Consumes: `batches` table (INSERT child batch with `parent_batch_id`), `qc_check_definitions` table (QC items for the mixing process), `qc_check_results` table (INSERT per-check results), `mixing_steps` table (existing step log), `log_mixing_step` RPC (existing), `materials` table (lookup material code from `parentMaterialId`)
- Produces: child batch rows in `batches` with `batch_number` format `{PROCESS_CODE}-{YYYYMMDD}-{SEQ}-{MATERIAL_CODE}`; `qc_check_results` rows tied to each child batch; a `MixingQCGate` component that blocks progression until QC is completed; updated `MixingOperatorPage` that orchestrates the step → sub-batch → QC → next step flow

- [ ] **Step 1: Write the failing test**

Create `tests/sprint6/mixing-subbatch-qc.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const PARENT_UUID = 'bbbb1111-1111-1111-1111-111111111111'
const CHILD_UUID  = 'cccc2222-2222-2222-2222-222222222222'

async function engineerUser(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/users*select=full_name*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ full_name: 'Dev Engineer', role_id: 'r-eng', roles: { name: 'Engineer' } }),
  }))
}

async function mockBatchLookup(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/batches*batch_number=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: PARENT_UUID, batch_number: 'MIXC-20260618-A01', material_id: 'mat-1' }),
  }))
}

async function mockProcessLookup(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/processes*code=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'proc-mix', code: 'MIXC' }),
  }))
}

async function mockMixingSteps(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/mixing_steps**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
}

async function mockMaterialCode(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/materials*id=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'mat-1', code: 'MTC1', name: 'Material C1' }),
  }))
}

async function mockQCDefs(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { id: 'qc1', qc_item_name: 'Homogeneity', method: 'VisualManual', timing: 'EndOfRun', acceptance_criteria_text: 'No visible lumps' },
    ]),
  }))
}

test('Add Material step creates a child batch and shows QC gate', async ({ page }) => {
  await engineerUser(page)
  await mockBatchLookup(page)
  await mockProcessLookup(page)
  await mockMixingSteps(page)
  await mockMaterialCode(page)
  await mockQCDefs(page)

  // Mock the log_mixing_step RPC
  await page.route(`**${SB}/rest/v1/rpc/log_mixing_step**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'step-1', batch_id: PARENT_UUID, step_number: 1, type: 'add_material',
      label: 'Add Material C1', display_ref: 'MIXC-20260618-A01 / Add Material C1 · Step 01',
      status: 'completed', params: { materialCode: 'MTC1', materialName: 'Material C1', quantity: 5, unit: 'kg' },
      operator: 'u1', created_at: '2026-06-18T10:00:00Z', completed_at: null,
    }),
  }))

  // Mock child batch creation
  let batchInsertBody: any = null
  await page.route(`**${SB}/rest/v1/batches`, async route => {
    if (route.request().method() === 'POST') {
      batchInsertBody = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: CHILD_UUID, batch_number: batchInsertBody?.batch_number ?? 'MIXC-20260618-A01-MTC1' }),
      })
    }
    return route.continue()
  })

  // Mock existing batches for sequence lookup
  await page.route(`**${SB}/rest/v1/batches*batch_number=like*`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  // Mock recipes for ratio calculator
  await page.route(`**${SB}/rest/v1/recipes**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.goto('/log/mixing/MIXC-20260618-A01')
  await page.getByRole('button', { name: /Add Step/i }).click()

  // Choose "Add Material"
  await page.getByText('Add Material').click()

  // Fill material form
  await page.locator('select').selectOption('MTC1')
  await page.getByPlaceholder('0.0').fill('5')
  await page.getByRole('button', { name: /Log Step/i }).click()

  // Child batch should have been created with material code suffix
  await expect.poll(() => batchInsertBody?.batch_number).toMatch(/MIXC-\d{8}-A01-MTC1/)
  await expect.poll(() => batchInsertBody?.parent_batch_id).toBe(PARENT_UUID)

  // QC gate should appear
  await expect(page.getByText(/QC Check/i)).toBeVisible()
  await expect(page.getByText(/Homogeneity/i)).toBeVisible()
})

test('QC gate must be completed before next material can be added', async ({ page }) => {
  await engineerUser(page)
  await mockBatchLookup(page)
  await mockProcessLookup(page)
  await mockMaterialCode(page)
  await mockQCDefs(page)
  await page.route(`**${SB}/rest/v1/recipes**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  // Start with one completed step that has a pending QC
  await page.route(`**${SB}/rest/v1/mixing_steps**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{
      id: 'step-1', batch_id: PARENT_UUID, step_number: 1, type: 'add_material',
      label: 'Add Material C1', display_ref: 'MIXC-20260618-A01 / Add Material C1 · Step 01',
      status: 'completed', params: { materialCode: 'MTC1', materialName: 'Material C1', quantity: 5, unit: 'kg' },
      operator: 'u1', created_at: '2026-06-18T10:00:00Z', completed_at: null,
    }]),
  }))

  // Mock: the child batch exists but has no QC results yet
  await page.route(`**${SB}/rest/v1/batches*parent_batch_id=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: CHILD_UUID, batch_number: 'MIXC-20260618-A01-MTC1', status: 'InProgress' }]),
  }))

  await page.route(`**${SB}/rest/v1/qc_check_results*batch_id=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.goto('/log/mixing/MIXC-20260618-A01')

  // The QC gate should be showing
  await expect(page.getByText(/QC Check/i)).toBeVisible()

  // Add Step button should be disabled while QC is pending
  const addStepBtn = page.getByRole('button', { name: /Add Step/i })
  await expect(addStepBtn).toBeDisabled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/sprint6/mixing-subbatch-qc.spec.ts --project=sprint6`

- [ ] **Step 3: Create the MixingQCGate component**

Create `components/mixing/mixing-qc-gate.tsx`:

This is an inline card shown on the mixing operator page after a material-addition sub-batch is created. It:
1. Fetches `qc_check_definitions` for the mixing process
2. Renders each QC item with a pass/fail toggle and optional text value
3. On submit, INSERTs `qc_check_results` rows for the child batch
4. Calls `onComplete(passed)` so the parent page can unlock the "Add Step" button

```tsx
'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { IconCheck, IconClose } from '@/components/icons';

interface QCDef {
  id: string;
  qc_item_name: string;
  method: string;
  timing: string;
  acceptance_criteria_text: string;
}

interface Props {
  childBatchId: string;
  childBatchNumber: string;
  processId: string;
  onComplete: (allPassed: boolean) => void;
}

export function MixingQCGate({ childBatchId, childBatchNumber, processId, onComplete }: Props) {
  const { user } = useAuth();
  const [defs, setDefs] = useState<QCDef[]>([]);
  const [results, setResults] = useState<Record<string, { passed: boolean | null; text: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('qc_check_definitions')
      .select('id, qc_item_name, method, timing, acceptance_criteria_text')
      .eq('process_id', processId)
      .then(({ data }) => {
        const rows = (data ?? []) as QCDef[];
        setDefs(rows);
        const init: Record<string, { passed: boolean | null; text: string }> = {};
        rows.forEach(d => { init[d.id] = { passed: null, text: '' }; });
        setResults(init);
        setLoading(false);
      });
  }, [processId]);

  const allAnswered = defs.length > 0 && defs.every(d => results[d.id]?.passed !== null);
  const allPassed = allAnswered && defs.every(d => results[d.id]?.passed === true);

  async function handleSubmit() {
    if (!user || !allAnswered) return;
    setSubmitting(true);
    setError(null);

    const rows = defs.map(d => ({
      batch_id: childBatchId,
      qc_definition_id: d.id,
      performed_by: user.id,
      passed: results[d.id].passed,
      result_text: results[d.id].text || null,
    }));

    const { error: insertErr } = await supabase.from('qc_check_results').insert(rows);

    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onComplete(allPassed);
  }

  if (loading) return null;
  if (defs.length === 0) {
    // No QC definitions for this process — auto-pass
    onComplete(true);
    return null;
  }

  return (
    <div className="mx-5 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-amber-400">QC Check</span>
        <span className="text-[11px] font-mono text-[#888888]">{childBatchNumber}</span>
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">
        {defs.map(d => (
          <div key={d.id} className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-[#f5f5f5]">{d.qc_item_name}</div>
              <div className="text-[10.5px] text-[#5a5a5a] mt-0.5">
                {d.method === 'VisualManual' ? 'Visual/Manual' : 'Tool/Equipment'} · {d.acceptance_criteria_text}
              </div>
              <input
                type="text"
                value={results[d.id]?.text ?? ''}
                onChange={e => setResults(prev => ({ ...prev, [d.id]: { ...prev[d.id], text: e.target.value } }))}
                placeholder="Value or remarks"
                className="mt-1.5 h-8 w-full px-2.5 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] text-[12px] text-[#f5f5f5] placeholder-[#3a3a3a] outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex gap-1.5 pt-0.5 shrink-0">
              <button
                onClick={() => setResults(prev => ({ ...prev, [d.id]: { ...prev[d.id], passed: true } }))}
                className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                  results[d.id]?.passed === true
                    ? 'bg-[#22c55e]/20 border-[#22c55e]/50 text-[#22c55e]'
                    : 'border-[#2a2a2a] text-[#5a5a5a] hover:border-[#22c55e]/30'
                }`}
                aria-label={`${d.qc_item_name} pass`}
              >
                <IconCheck size={14} />
              </button>
              <button
                onClick={() => setResults(prev => ({ ...prev, [d.id]: { ...prev[d.id], passed: false } }))}
                className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                  results[d.id]?.passed === false
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'border-[#2a2a2a] text-[#5a5a5a] hover:border-red-500/30'
                }`}
                aria-label={`${d.qc_item_name} fail`}
              >
                <IconClose size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-[11.5px] text-red-400">
          {error}
        </div>
      )}

      <div className="px-4 pb-4">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="w-full h-10 rounded-lg bg-amber-500 text-black text-[13px] font-semibold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting QC…' : 'Submit QC Results'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update MixingOperatorPage to create child batches and show QC gate**

In `components/mixing/mixing-operator-page.tsx`, the core changes are:

1. **New state** — track the child batch that's awaiting QC:
```ts
const [pendingQC, setPendingQC] = useState<{ childBatchId: string; childBatchNumber: string } | null>(null);
const [materialCode, setMaterialCode] = useState('');
```

2. **Fetch parent material code on init** — after resolving the batch UUID, also look up the material code:
```ts
// Inside the init() function, after setting batchUuid:
const { data: batchRow } = await supabase
  .from('batches')
  .select('material_id')
  .eq('id', uuid)
  .single();
if (batchRow?.material_id) {
  const { data: mat } = await supabase
    .from('materials')
    .select('code')
    .eq('id', batchRow.material_id)
    .single();
  if (!cancelled && mat?.code) setMaterialCode(mat.code);
}
```

3. **Check for pending QC on load** — after fetching steps, check if the last `add_material` step has a corresponding child batch without QC results:
```ts
async function checkPendingQC(uuid: string, currentSteps: MixingStep[]) {
  const lastAddMaterial = [...currentSteps].reverse().find(s => s.type === 'add_material' && s.status !== 'voided');
  if (!lastAddMaterial) { setPendingQC(null); return; }

  const matCode = (lastAddMaterial as AddMaterialStep).params.materialCode;
  // Look for a child batch matching this material addition
  const { data: children } = await supabase
    .from('batches')
    .select('id, batch_number')
    .eq('parent_batch_id', uuid)
    .like('batch_number', `%-${matCode}`);

  if (!children?.length) { setPendingQC(null); return; }

  const childBatch = children[children.length - 1];
  // Check if QC already done
  const { data: qcResults } = await supabase
    .from('qc_check_results')
    .select('id')
    .eq('batch_id', childBatch.id)
    .limit(1);

  if (qcResults && qcResults.length > 0) {
    setPendingQC(null); // QC already done
  } else {
    setPendingQC({ childBatchId: childBatch.id, childBatchNumber: childBatch.batch_number });
  }
}
```

4. **Modify `handleAddStep`** — after a successful `add_material` step, create the child batch:
```ts
async function handleAddStep(incoming: Omit<MixingStep, 'stepNumber' | 'displayRef'>) {
  if (!batchUuid || !user) return;
  setSubmitting(true);
  setActionError(null);

  const { error } = await supabase.rpc('log_mixing_step', {
    p_batch_id: batchUuid,
    p_type: incoming.type,
    p_label: incoming.label,
    p_params: incoming.params,
    p_operator: user.id,
  });

  if (error) {
    setActionError(error.message);
    setSubmitting(false);
    return;
  }

  await fetchSteps(batchUuid);

  // If this was an add_material step, create a child batch
  if (incoming.type === 'add_material') {
    const matParams = incoming.params as AddMaterialParams;
    const childBatchNumber = `${batchId}-${matParams.materialCode}`;

    const { data: newChild, error: childErr } = await supabase
      .from('batches')
      .insert({
        batch_number: childBatchNumber,
        parent_batch_id: batchUuid,
        material_id: null, // inherited from parent context
        status: 'InProgress',
        current_quantity: matParams.quantity,
        original_quantity: matParams.quantity,
        unit: matParams.unit,
      })
      .select('id, batch_number')
      .single();

    if (childErr || !newChild) {
      setActionError(childErr?.message ?? 'Failed to create mixing sub-batch');
    } else {
      setPendingQC({ childBatchId: newChild.id, childBatchNumber: newChild.batch_number });
    }
  }

  setShowAddStep(false);
  setSubmitting(false);
}
```

5. **QC completion handler:**
```ts
function handleQCComplete(allPassed: boolean) {
  setPendingQC(null);
  // Optionally update child batch status based on QC result
  if (pendingQC && !allPassed) {
    supabase
      .from('batches')
      .update({ status: 'OnHold' })
      .eq('id', pendingQC.childBatchId);
  }
}
```

6. **Disable "Add Step" when QC is pending:**
```ts
const canAddStep = !loading && !submitting && batchUuid !== null && activeRound === null && pendingQC === null;
```

7. **Render the QC gate** in the JSX, between the timer card and step history:
```tsx
{pendingQC && processId && (
  <MixingQCGate
    childBatchId={pendingQC.childBatchId}
    childBatchNumber={pendingQC.childBatchNumber}
    processId={processId}
    onComplete={handleQCComplete}
  />
)}
```

Add the import at the top:
```ts
import { MixingQCGate } from '@/components/mixing/mixing-qc-gate';
```

- [ ] **Step 5: Update AddStepModal to include materialCode in the callback**

In `components/subbatch/add-step-modal.tsx`, the `onSubmit` callback already passes the full step including `params.materialCode`. No structural change needed — the parent `MixingOperatorPage` reads `incoming.params.materialCode` from the callback. Verify this is the case.

- [ ] **Step 6: Run all tests**

Run: `npm test`

- [ ] **Step 7: Commit**

```bash
git add components/mixing/mixing-qc-gate.tsx components/mixing/mixing-operator-page.tsx tests/sprint6/mixing-subbatch-qc.spec.ts
git commit -m "feat(mixing): create sub-batches per material addition with inline QC gate"
```

---

### Task 4: Back buttons on all detail pages

**Files:**
- Modify: `app/batches/[id]/page.tsx`
- Modify: `app/batches/[id]/[subId]/page.tsx`
- Modify: `app/lots/[id]/page.tsx`
- Create: `tests/sprint6/back-buttons.spec.ts`
- (Skip `app/log/mixing/[batchId]/page.tsx` — already has a back button via `router.back()`)

**Interfaces:**
- Consumes: `IconChevronLeft` from `@/components/icons`, `Link` from `next/link`
- Produces: a "Back to [Parent]" link on each detail page above the main content

All three pages use the same pattern: a `Link` with `IconChevronLeft` + text, placed as the first child inside the `<main>` content area (before the data cards).

- [ ] **Step 1: Write the failing test**

Create `tests/sprint6/back-buttons.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

async function mockUser(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/users*select=full_name*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ full_name: 'Dev Engineer', role_id: 'r-eng', roles: { name: 'Engineer' } }),
  }))
}

test('Batch detail has back button to /batches', async ({ page }) => {
  await mockUser(page)
  await page.route(`**${SB}/rest/v1/batches*id=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'b1', batch_number: 'MIXC-20260618-A01', status: 'InProgress',
      material_id: 'm1', current_quantity: 100, original_quantity: 100, unit: 'kg',
      parent_batch_id: null, current_location: null, created_at: '2026-06-18',
      material: { code: 'MTC1', name: 'Material C1', type: 'Cathode Electrode' },
      batch_raw_material_intake: [], batch_status_changes: [],
    }),
  }))
  await page.route(`**${SB}/rest/v1/batches*parent_batch_id*`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/process_runs**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.goto('/batches/b1')
  const backLink = page.getByRole('link', { name: /back to batches/i })
  await expect(backLink).toBeVisible()
  await expect(backLink).toHaveAttribute('href', '/batches')
})

test('Sub-batch detail has back button to parent batch', async ({ page }) => {
  await mockUser(page)
  await page.route(`**${SB}/rest/v1/batches*id=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'sb1', batch_number: 'MIXC-20260618-A01-01', status: 'InProgress',
      material_id: 'm1', current_quantity: 50, original_quantity: 50, unit: 'kg',
      parent_batch_id: 'b1', current_location: null, created_at: '2026-06-18',
      parent_batch: { batch_number: 'MIXC-20260618-A01' },
    }),
  }))
  await page.route(`**${SB}/rest/v1/mixing_steps**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/process_runs**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/qc_check_results**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/rpc/trace_batch_genealogy**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.goto('/batches/b1/sb1')
  const backLink = page.getByRole('link', { name: /back to/i })
  await expect(backLink).toBeVisible()
  await expect(backLink).toHaveAttribute('href', '/batches/b1')
})

test('Lot detail has back button to /lots', async ({ page }) => {
  await mockUser(page)
  await page.route(`**${SB}/rest/v1/lots**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'lot-1', lot_number: 'LOT-001', status: 'Active',
      category: 'Cell', unit_count: 5, created_at: '2026-06-18',
      units: [], lot_sub_batches: [],
    }),
  }))

  await page.goto('/lots/lot-1')
  const backLink = page.getByRole('link', { name: /back to lots/i })
  await expect(backLink).toBeVisible()
  await expect(backLink).toHaveAttribute('href', '/lots')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/sprint6/back-buttons.spec.ts --project=sprint6`

- [ ] **Step 3: Add back button to batch detail**

In `app/batches/[id]/page.tsx`, add as the first element inside the `<main>` wrapper (before the error banner):

```tsx
<Link
  href="/batches"
  className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
  aria-label="Back to Batches"
>
  <IconChevronLeft size={14} />
  <span>Back to Batches</span>
</Link>
```

Import `IconChevronLeft` if not already imported (check existing imports — it might be there from the breadcrumb chevron, but that uses `IconChevronRight`). Add `IconChevronLeft` to the icons import:
```ts
import { IconChevronRight, IconPlus, IconExternal, IconLock, IconBatches, IconChevronLeft } from '@/components/icons';
```

- [ ] **Step 4: Add back button to sub-batch detail**

In `app/batches/[id]/[subId]/page.tsx`, add as the first element inside the `DataState` success block:

```tsx
<Link
  href={`/batches/${params.id}`}
  className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors mb-1"
  aria-label={`Back to ${parentBatchNumber}`}
>
  <IconChevronLeft size={14} />
  <span>Back to {parentBatchNumber}</span>
</Link>
```

Add `IconChevronLeft` to the imports.

- [ ] **Step 5: Add back button to lot detail**

In `app/lots/[id]/page.tsx`, add inside the `DataState` success block, before the info card:

```tsx
<Link
  href="/lots"
  className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors mb-1"
  aria-label="Back to Lots"
>
  <IconChevronLeft size={14} />
  <span>Back to Lots</span>
</Link>
```

Add `IconChevronLeft` to the existing icons import.

- [ ] **Step 6: Run all tests**

Run: `npm test`

- [ ] **Step 7: Commit**

```bash
git add app/batches/[id]/page.tsx app/batches/[id]/[subId]/page.tsx app/lots/[id]/page.tsx tests/sprint6/back-buttons.spec.ts
git commit -m "feat(ux): add back buttons to all detail pages"
```

---

## Post-implementation

After all 4 tasks:

1. Run full test suite: `npm test`
2. Update `docs/SESSION_LOG.md` and `docs/FLINT_REFERENCE_21052026.md`
3. Push to `feature/client-feedback-fixes`
4. Create PR into `dev`

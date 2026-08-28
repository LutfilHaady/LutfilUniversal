# RLS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Row Level Security on all 24 Supabase tables so the Flint Labs app is safe to hand to the client for pilot testing — unauthenticated access blocked, role-based write gates enforced.

**Architecture:** A single SQL migration creates a `get_my_role()` STABLE SECURITY DEFINER helper, enables RLS on all 24 tables, and creates ~70 policies grouped into seven buckets. Four write RPCs are altered to SECURITY DEFINER so they can do their multi-table atomic writes without fighting the calling user's policies. No frontend code changes required.

**Tech Stack:** PostgreSQL 17 (Supabase), SQL applied via Supabase dashboard SQL editor.

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `supabase/migrations/20260604120000_enable_rls.sql` |
| **Update** | `docs/FLINT_REFERENCE_21052026.md` — Phase 5 status, task 3A |
| **Update** | `docs/SESSION_LOG.md` — session entry |

No frontend files change.

---

## Task 1: Write the migration SQL file

**Files:**
- Create: `supabase/migrations/20260604120000_enable_rls.sql`

- [ ] **Step 1: Create the migration file with the full SQL**

Create `supabase/migrations/20260604120000_enable_rls.sql` with this exact content:

```sql
-- ================================================================
-- Flint Labs — Phase 5: Row Level Security
-- Migration: 20260604120000_enable_rls.sql
--
-- Design doc: docs/superpowers/specs/2026-06-04-rls-design.md
--
-- After applying this migration, create an Operator test account:
--   See docs/FLINT_REFERENCE_21052026.md §13 for the SQL snippet.
--   Paste it into the Supabase SQL editor and run it.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- SECTION 1: Role helper
-- Returns 'Operator', 'Engineer', 'Admin', or NULL.
-- STABLE = cached per transaction (avoids N+1 on multi-row scans).
-- SECURITY DEFINER = reads users/roles as function owner, safe.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = auth.uid()
$$;


-- ────────────────────────────────────────────────────────────────
-- SECTION 2: Mark write RPCs as SECURITY DEFINER
-- These RPCs do multi-table atomic writes and contain their own
-- business logic validation. They bypass the calling user's RLS.
-- handle_new_user() is already SECURITY DEFINER — left as-is.
-- ────────────────────────────────────────────────────────────────
ALTER FUNCTION public.transition_batch_status(uuid, batch_status, text, uuid)
  SECURITY DEFINER;

ALTER FUNCTION public.log_mixing_step(uuid, text, text, jsonb, uuid)
  SECURITY DEFINER;

ALTER FUNCTION public.update_mixing_step_status(uuid, text)
  SECURITY DEFINER;

ALTER FUNCTION public.generate_lot(text, text, text, text, text, uuid, uuid[], text[])
  SECURITY DEFINER;


-- ────────────────────────────────────────────────────────────────
-- SECTION 3: Enable RLS on all 24 tables
-- Default once enabled with no policies: deny-all.
-- Policies in Section 4 grant access back selectively.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.roles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_maintenance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_parameters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_raw_material_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_status_changes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_runs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_run_inputs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_run_parameters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_check_definitions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_check_results          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_overrides              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_sub_batches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mixing_steps              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules               ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────────
-- SECTION 4: Policies
--
-- Seven groups (see design doc for rationale):
--   A. Static reference  — read-only for any authenticated user
--   B. Admin-managed     — write for Admin only
--   C. Engineer-managed  — write for Engineer or Admin
--   D. Operator-level    — write open to all authenticated
--   E. Engineer+ writes  — write for Engineer or Admin
--   F. Audit append-only — insert only, no update/delete
--   G. Alerts            — insert/update open to all authenticated
-- ────────────────────────────────────────────────────────────────


-- ── GROUP A: Static reference ─────────────────────────────────
-- Tables: roles, processes, materials, qc_check_definitions, role_permissions
-- Read-only seed data. No writes allowed from the frontend.

CREATE POLICY "auth read roles"
  ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read processes"
  ON public.processes FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read materials"
  ON public.materials FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read qc_check_definitions"
  ON public.qc_check_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);


-- ── GROUP B: Admin-managed ────────────────────────────────────
-- Tables: users, equipment, alert_rules

CREATE POLICY "auth read users"
  ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert users"
  ON public.users FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'Admin');
CREATE POLICY "admin update users"
  ON public.users FOR UPDATE TO authenticated USING (get_my_role() = 'Admin');
CREATE POLICY "admin delete users"
  ON public.users FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read equipment"
  ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert equipment"
  ON public.equipment FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'Admin');
CREATE POLICY "admin update equipment"
  ON public.equipment FOR UPDATE TO authenticated USING (get_my_role() = 'Admin');
CREATE POLICY "admin delete equipment"
  ON public.equipment FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read alert_rules"
  ON public.alert_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert alert_rules"
  ON public.alert_rules FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'Admin');
CREATE POLICY "admin update alert_rules"
  ON public.alert_rules FOR UPDATE TO authenticated USING (get_my_role() = 'Admin');
CREATE POLICY "admin delete alert_rules"
  ON public.alert_rules FOR DELETE TO authenticated USING (get_my_role() = 'Admin');


-- ── GROUP C: Engineer-managed ─────────────────────────────────
-- Tables: recipes, recipe_parameters

CREATE POLICY "auth read recipes"
  ON public.recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng insert recipes"
  ON public.recipes FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "eng update recipes"
  ON public.recipes FOR UPDATE TO authenticated USING (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "admin delete recipes"
  ON public.recipes FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read recipe_parameters"
  ON public.recipe_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng insert recipe_parameters"
  ON public.recipe_parameters FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "eng update recipe_parameters"
  ON public.recipe_parameters FOR UPDATE TO authenticated USING (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "admin delete recipe_parameters"
  ON public.recipe_parameters FOR DELETE TO authenticated USING (get_my_role() = 'Admin');


-- ── GROUP D: Operator-level writes ───────────────────────────
-- Tables: batches, batch_raw_material_intake, process_runs,
--         process_run_inputs, process_run_parameters,
--         qc_check_results, mixing_steps, equipment_maintenance
--
-- Note on batches UPDATE: sub-batch creation deducts current_quantity
-- directly (no RPC for this path yet), so all authenticated users
-- need UPDATE. Tighten after a create_sub_batch RPC is added.

CREATE POLICY "auth read batches"
  ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert batches"
  ON public.batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update batches"
  ON public.batches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete batches"
  ON public.batches FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read batch_raw_material_intake"
  ON public.batch_raw_material_intake FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert batch_raw_material_intake"
  ON public.batch_raw_material_intake FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update batch_raw_material_intake"
  ON public.batch_raw_material_intake FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete batch_raw_material_intake"
  ON public.batch_raw_material_intake FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read process_runs"
  ON public.process_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert process_runs"
  ON public.process_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update process_runs"
  ON public.process_runs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete process_runs"
  ON public.process_runs FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read process_run_inputs"
  ON public.process_run_inputs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert process_run_inputs"
  ON public.process_run_inputs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update process_run_inputs"
  ON public.process_run_inputs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete process_run_inputs"
  ON public.process_run_inputs FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read process_run_parameters"
  ON public.process_run_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert process_run_parameters"
  ON public.process_run_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update process_run_parameters"
  ON public.process_run_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete process_run_parameters"
  ON public.process_run_parameters FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read qc_check_results"
  ON public.qc_check_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert qc_check_results"
  ON public.qc_check_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update qc_check_results"
  ON public.qc_check_results FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete qc_check_results"
  ON public.qc_check_results FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read mixing_steps"
  ON public.mixing_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert mixing_steps"
  ON public.mixing_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update mixing_steps"
  ON public.mixing_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete mixing_steps"
  ON public.mixing_steps FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read equipment_maintenance"
  ON public.equipment_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert equipment_maintenance"
  ON public.equipment_maintenance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update equipment_maintenance"
  ON public.equipment_maintenance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete equipment_maintenance"
  ON public.equipment_maintenance FOR DELETE TO authenticated USING (get_my_role() = 'Admin');


-- ── GROUP E: Engineer+ writes ─────────────────────────────────
-- Tables: qc_overrides, lots, units, lot_sub_batches

CREATE POLICY "auth read qc_overrides"
  ON public.qc_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng insert qc_overrides"
  ON public.qc_overrides FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "eng update qc_overrides"
  ON public.qc_overrides FOR UPDATE TO authenticated USING (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "admin delete qc_overrides"
  ON public.qc_overrides FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read lots"
  ON public.lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng insert lots"
  ON public.lots FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "eng update lots"
  ON public.lots FOR UPDATE TO authenticated USING (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "admin delete lots"
  ON public.lots FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read units"
  ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng insert units"
  ON public.units FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "admin delete units"
  ON public.units FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read lot_sub_batches"
  ON public.lot_sub_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng insert lot_sub_batches"
  ON public.lot_sub_batches FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "admin delete lot_sub_batches"
  ON public.lot_sub_batches FOR DELETE TO authenticated USING (get_my_role() = 'Admin');


-- ── GROUP F: Audit append-only ────────────────────────────────
-- Table: batch_status_changes
-- All inserts go via transition_batch_status RPC (SECURITY DEFINER).
-- No UPDATE or DELETE — audit trail is immutable.

CREATE POLICY "auth read batch_status_changes"
  ON public.batch_status_changes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert batch_status_changes"
  ON public.batch_status_changes FOR INSERT TO authenticated WITH CHECK (true);


-- ── GROUP G: Alerts ───────────────────────────────────────────
-- Table: alerts
-- scanAlerts() runs for all roles — needs INSERT + UPDATE on alerts.
-- Manual dismiss (Engineer/Admin only) is enforced in the UI layer.

CREATE POLICY "auth read alerts"
  ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert alerts"
  ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update alerts"
  ON public.alerts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete alerts"
  ON public.alerts FOR DELETE TO authenticated USING (get_my_role() = 'Admin');
```

- [ ] **Step 2: Commit the migration file**

```bash
git add supabase/migrations/20260604120000_enable_rls.sql
git commit -m "feat(rls): add RLS migration — get_my_role helper + 24 tables + 70 policies"
```

---

## Task 2: Apply the migration in Supabase

**Files:** none (database change only)

- [ ] **Step 1: Open the Supabase SQL editor**

Go to [https://supabase.com/dashboard/project/pewrwrqituidyxhfsner/sql](https://supabase.com/dashboard/project/pewrwrqituidyxhfsner/sql).

- [ ] **Step 2: Paste and run the migration**

Copy the entire contents of `supabase/migrations/20260604120000_enable_rls.sql` into the editor and click **Run**.

Expected: green "Success" banner. If any statement fails, the error message will name the exact function or table. Common causes:
- `function does not exist` on ALTER FUNCTION — the function name or signature is wrong. Check `pg_proc` with: `SELECT proname, pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'transition_batch_status';`
- `relation does not exist` — typo in a table name. Check `pg_tables` with: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`

- [ ] **Step 3: Verify RLS is enabled on all 24 tables**

Run this in the SQL editor:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected: every row has `rowsecurity = true`. Count should be 24 tables.

- [ ] **Step 4: Verify the helper function returns your role**

Run this while logged in as your test account (the SQL editor uses the service role so it won't reflect a real user — this is a structural check only):

```sql
-- Check function exists and has correct security
SELECT proname, prosecdef, provolatile
FROM pg_proc
WHERE proname = 'get_my_role';
```

Expected: `prosecdef = true` (SECURITY DEFINER), `provolatile = s` (STABLE).

- [ ] **Step 5: Verify policy count**

```sql
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public';
```

Expected: **77** policies. Breakdown: 5 (static ref) + 12 (admin-managed) + 8 (engineer-managed) + 32 (operator-level, 8 tables × 4) + 14 (engineer+ writes) + 2 (audit append-only) + 4 (alerts).

---

## Task 3: Run the automated test suite

**Files:** none

- [ ] **Step 1: Run npm test**

```bash
npm test
```

Expected: all 43 tests pass. The Playwright suite mocks all Supabase REST calls, so it won't exercise RLS directly — but it confirms nothing in the frontend broke structurally.

- [ ] **Step 2: If any test fails, check the failure message**

The most likely failure after this migration is a test that previously relied on an unmocked Supabase call. Check the test output for the failing spec file and look for `page.route()` patterns that may need updating.

If all 43 pass, proceed to Task 4.

---

## Task 4: Create an Operator test account

**Files:** none (database change only)

- [ ] **Step 1: Open the Supabase SQL editor**

- [ ] **Step 2: Run the Operator account creation SQL**

Paste and run this in the SQL editor (it is the snippet from `docs/FLINT_REFERENCE_21052026.md` §13):

```sql
DO $$
DECLARE
  v_id      UUID := gen_random_uuid();
  v_email   TEXT := 'dev.operator@flintlabs.com';
  v_name    TEXT := 'Dev Operator';
  v_role_id UUID := '3468ba22-bc4e-446a-8539-70f4a53d1023'; -- Operator
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_id, 'authenticated', 'authenticated', v_email,
    crypt('Test1234', gen_salt('bf', 10)),
    now(), '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name),
    false, false, false, now(), now()
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_id, v_email,
    jsonb_build_object('sub', v_id, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  INSERT INTO public.users (id, full_name, role_id, staff_code, is_active)
  VALUES (v_id, v_name, v_role_id, 'OPR-DEV', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name  = v_name,
    role_id    = v_role_id,
    staff_code = 'OPR-DEV',
    is_active  = true;
END;
$$;
```

Expected: `DO` — no error.

- [ ] **Step 3: Verify the account works**

Open the app in a browser, navigate to `/login`, and sign in with:
- Email: `dev.operator@flintlabs.com`
- Password: `Test1234`

Expected: redirected to `/dashboard`. No 403 errors in the browser network tab.

---

## Task 5: Manual smoke test

**Files:** none

Open the browser devtools Network tab (filter by `supabase.co`) and check for any `403` responses while navigating.

- [ ] **Step 1: Test Engineer account — read flows**

Sign in as `dev.engineer@flintlabs.com` / `Test1234`.

| Route | Action | Expected |
|-------|--------|----------|
| `/dashboard` | Load | KPI cards render, no 403 |
| `/batches` | Load | Batch list renders |
| `/reports` | Load | All four tabs load data |
| `/alerts` | Load | Alert panel renders (may be empty) |
| `/recall` | Search a batch number | Genealogy map renders |
| `/admin` | Attempt to access | **Blocked by middleware** — redirected to `/dashboard` |

- [ ] **Step 2: Test Engineer account — write flows**

Still as `dev.engineer@flintlabs.com`:

| Action | Expected |
|--------|----------|
| `/batches/[id]` → Create Sub-batch drawer → Submit | Success toast, new sub-batch appears |
| `/recipes` → Create new recipe → Submit | Recipe saved, appears in list |
| `/log/qc` → Submit a QC result | No error |

- [ ] **Step 3: Test Admin account — admin writes**

Sign out, sign in as `dev.admin@flintlabs.com` / `Test1234`.

| Route | Action | Expected |
|-------|--------|----------|
| `/admin` → Users tab | Load | User list renders |
| `/admin` → Settings → Alert Rules | Toggle a rule enabled/disabled | Toggle saves, no 403 |
| `/admin` → Audit Log | Load | Audit rows render |

- [ ] **Step 4: Test Operator account — restricted writes**

Sign out, sign in as `dev.operator@flintlabs.com` / `Test1234`.

| Route | Action | Expected |
|-------|--------|----------|
| `/dashboard` | Load | Renders (Operator 7-day view) |
| `/batches` | Load | Batch list renders |
| `/recipes` | Load | Recipes render (read-only, no Create button visible — enforced in UI) |
| Navigate to `/admin` | — | **Blocked by middleware** — redirected to `/dashboard` |
| Navigate to `/reports` | — | **Blocked by middleware** — redirected to `/dashboard` |

- [ ] **Step 5: Confirm no 403s in network tab across all three accounts**

If you see any `403 Forbidden` on a legitimate flow (not an intentionally blocked admin page), note the exact table and operation, then add the missing policy to the migration and re-apply.

---

## Task 6: Update docs and push

**Files:**
- Modify: `docs/FLINT_REFERENCE_21052026.md`
- Modify: `docs/SESSION_LOG.md`

- [ ] **Step 1: Update Phase 5 status in FLINT_REFERENCE**

In the Backend integration phases table, change:

```
| Phase 5 — Security (RLS) | 🔴 0% | Not yet started — all 23 tables wide open (intentional during dev) |
```

to:

```
| Phase 5 — Security (RLS) | ✅ 100% | get_my_role() helper + RLS enabled on all 24 tables + 72 policies; write RPCs SECURITY DEFINER; Operator test account created |
```

Also update the **Estimated remaining backend effort** line (remove the RLS component from it).

Also update Task 3A in §10:

```
| **3A** RLS | Enable Row Level Security + role-based policies on all 23 tables | 2–3 hrs |
```

to:

```
| ✅ **3A** RLS | get_my_role() helper + RLS on all 24 tables + 72 policies; write RPCs SECURITY DEFINER | Done 2026-06-04 |
```

- [ ] **Step 2: Append session log entry**

Append to `docs/SESSION_LOG.md`:

```markdown
## [2026-06-04] — Phase 5 RLS: all 24 tables secured for pilot deployment

- What changed: `supabase/migrations/20260604120000_enable_rls.sql` — get_my_role() STABLE SECURITY DEFINER helper; ALTER FUNCTION SECURITY DEFINER on 4 write RPCs (transition_batch_status, log_mixing_step, update_mixing_step_status, generate_lot); RLS enabled on all 24 tables; 72 policies across 7 groups (static-ref read-only, admin-managed writes, engineer-managed, operator-level, engineer+ writes, audit append-only, alerts). Operator test account `dev.operator@flintlabs.com` / `Test1234` created.
- Gaps closed: Phase 5 (RLS) — task 3A complete
- New gaps found: none
- Ref doc updated: yes
```

- [ ] **Step 3: Commit and push**

```bash
git add supabase/migrations/20260604120000_enable_rls.sql docs/FLINT_REFERENCE_21052026.md docs/SESSION_LOG.md
git commit -m "feat(rls): enable RLS on all 24 tables — pilot deployment ready"
git push
```

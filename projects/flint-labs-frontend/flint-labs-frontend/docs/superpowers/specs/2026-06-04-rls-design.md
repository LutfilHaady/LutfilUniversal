# RLS Integration Design — Flint Labs Frontend

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** Phase 5 — Security (RLS) — MVP pilot deployment gate  
**Reference:** `docs/FLINT_REFERENCE_21052026.md` §Phase 5, §Task 3A

---

## Context

All 24 tables in the Flint Supabase project are currently wide open (RLS disabled, intentional during dev). Before handing the system to the client for pilot testing, we need a security baseline that prevents unauthenticated access and stops lower-privilege users from accidentally or intentionally mutating data they shouldn't touch.

This is a **controlled pilot** with a small number of trusted Flint staff. Full row-ownership isolation (e.g. operators can only see their own batches) is out of scope — that belongs in a post-MVP hardening pass.

---

## Goals

- Unauthenticated requests to any table return zero rows / permission denied
- Operators cannot mutate admin-managed or engineer-managed data
- Engineers cannot mutate admin-only data (users, equipment, alert rules)
- The existing 43-test Playwright suite continues to pass
- No frontend code changes required — this is a pure database migration

---

## Non-Goals

- Row-level ownership isolation (operators scoped to their own runs)
- Column-level security
- Rate limiting or IP allowlisting
- Audit logging of policy violations
- Post-MVP hardening (that's Phase 5 continued, not this sprint)

---

## Architecture

### 1. `get_my_role()` helper function

```sql
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT r.name
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = auth.uid()
$$;
```

- `STABLE` — PostgreSQL caches the result within a transaction; avoids N+1 subqueries on multi-row scans
- `SECURITY DEFINER` — runs as function owner, bypasses calling user's RLS on `users`/`roles`
- Returns `'Operator'`, `'Engineer'`, `'Admin'`, or `NULL` (unauthenticated / no role assigned)
- Every policy calls this single function; no inline joins in policy expressions

### 2. RLS enabled on all 24 tables

`ALTER TABLE <table> ENABLE ROW LEVEL SECURITY` on every table. Once enabled with no policies, the default is deny-all. Policies are then created per the seven-group matrix below.

### 3. Write RPCs altered to `SECURITY DEFINER`

The four write RPCs contain their own business logic validation and perform multi-table writes atomically. Marking them `SECURITY DEFINER` lets them bypass the calling user's RLS — safe because they are already the authoritative gatekeepers for those operations.

| Function | Change | Reason |
|----------|--------|--------|
| `transition_batch_status` | `SECURITY DEFINER` | Writes `batches` + `batch_status_changes` atomically |
| `log_mixing_step` | `SECURITY DEFINER` | Writes `mixing_steps` with transaction-safe step numbering |
| `update_mixing_step_status` | `SECURITY DEFINER` | Updates `mixing_steps` |
| `generate_lot` | `SECURITY DEFINER` | Writes `lots`, `lot_sub_batches`, `units` atomically |
| `handle_new_user` (trigger fn) | `SECURITY DEFINER` | Inserts into `public.users` on Auth sign-up; without this, new accounts fail silently |
| `trace_batch_genealogy` | no change (INVOKER) | Read-only; respects caller's RLS |
| `get_process_route` | no change (INVOKER) | Read-only; respects caller's RLS |

### 4. Admin server actions

`app/actions/admin-users.ts` uses the Supabase service role key, which bypasses RLS entirely. No changes needed.

---

## Policy Matrix

Five policy groups cover all 24 tables. Shorthand: **auth** = any authenticated user · **eng+** = Engineer or Admin · **admin** = Admin only · **—** = no policy (blocked).

| Group | Tables | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|--------|
| **Static reference** | `roles`, `processes`, `materials`, `qc_check_definitions`, `role_permissions` | auth | — | — | — |
| **Admin-managed** | `users`, `equipment`, `alert_rules` | auth | admin | admin | admin |
| **Engineer-managed** | `recipes`, `recipe_parameters` | auth | eng+ | eng+ | admin |
| **Operator-level writes** | `batches`, `batch_raw_material_intake`, `process_runs`, `process_run_inputs`, `process_run_parameters`, `qc_check_results`, `mixing_steps`, `equipment_maintenance` | auth | auth | auth | admin |
| **Engineer+ writes** | `qc_overrides`, `lots`, `units`, `lot_sub_batches` | auth | eng+ | eng+ | admin |
| **Audit append-only** | `batch_status_changes` | auth | auth | — | — |
| **Alerts** | `alerts` | auth | auth | auth | admin |

### Notable decisions

- **`batches` UPDATE open to all authenticated** — sub-batch creation deducts `current_quantity` directly (no RPC wrapping this path yet); Operators need UPDATE. Acceptable for pilot; a future `create_sub_batch` RPC would let us tighten this.
- **`batch_status_changes` no UPDATE/DELETE** — immutable audit trail. All inserts go via the `transition_batch_status` RPC (SECURITY DEFINER).
- **`alerts` UPDATE open to all authenticated** — `scanAlerts()` auto-resolves rows by setting `resolved_at`; it runs for all three roles on every alert-bearing page. Manual dismiss (Engineer/Admin only) is enforced in the UI layer, not at DB level — acceptable for pilot.
- **`users` INSERT/UPDATE/DELETE admin only** — the `handle_new_user` trigger function is SECURITY DEFINER so it can insert the initial profile row without needing a policy exception.

---

## Migration File

**Path:** `supabase/migrations/20260604120000_enable_rls.sql`

Single file, applied via the Supabase dashboard SQL editor. Structure:
1. `get_my_role()` function
2. `ALTER FUNCTION ... SECURITY DEFINER` for 4 write RPCs + `handle_new_user`
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` × 24
4. `CREATE POLICY` statements grouped by bucket

A comment block at the top of the file includes the SQL snippet to create an Operator test account (from reference §13) so it can be run immediately after applying RLS.

---

## Testing Plan

### Automated
```
npm test
```
Runs the existing 43-test Playwright suite. Tests mock Supabase REST calls, so they won't catch RLS policy errors directly — but they confirm nothing in the frontend broke structurally after the migration.

### Manual smoke test (browser)
After applying the migration, log in with each account and verify no unexpected network 403s:

| Account | Route | Check |
|---------|-------|-------|
| `dev.engineer@flintlabs.com` | `/dashboard`, `/batches`, `/reports`, `/alerts` | Pages load, data visible |
| `dev.engineer@flintlabs.com` | `/batches/[id]` → Create Sub-batch | Drawer submits, new sub-batch appears |
| `dev.engineer@flintlabs.com` | `/recipes` | Can create/edit recipe |
| `dev.admin@flintlabs.com` | `/admin` → Users tab | Can see users, add user modal works |
| `dev.admin@flintlabs.com` | `/admin` → Settings → Alert Rules | Can toggle rules |
| Operator account (create after migration) | `/dashboard`, `/batches` | Pages load |
| Operator account | `/admin` | Blocked by middleware (no RLS test needed here) |

---

## Out-of-Scope (future hardening)

- Row-level ownership (operators scoped to their own `process_runs`)
- DB triggers for alert generation (task 3B)
- `create_sub_batch` RPC to allow tightening `batches` UPDATE policy
- Forgot-password reset flow
- RLS on Supabase Storage buckets (not used yet)

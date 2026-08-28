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
  ON public.users FOR UPDATE TO authenticated
  USING      (get_my_role() = 'Admin')
  WITH CHECK (get_my_role() = 'Admin');
CREATE POLICY "admin delete users"
  ON public.users FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read equipment"
  ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert equipment"
  ON public.equipment FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'Admin');
CREATE POLICY "admin update equipment"
  ON public.equipment FOR UPDATE TO authenticated
  USING      (get_my_role() = 'Admin')
  WITH CHECK (get_my_role() = 'Admin');
CREATE POLICY "admin delete equipment"
  ON public.equipment FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read alert_rules"
  ON public.alert_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert alert_rules"
  ON public.alert_rules FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'Admin');
CREATE POLICY "admin update alert_rules"
  ON public.alert_rules FOR UPDATE TO authenticated
  USING      (get_my_role() = 'Admin')
  WITH CHECK (get_my_role() = 'Admin');
CREATE POLICY "admin delete alert_rules"
  ON public.alert_rules FOR DELETE TO authenticated USING (get_my_role() = 'Admin');


-- ── GROUP C: Engineer-managed ─────────────────────────────────
-- Tables: recipes, recipe_parameters

CREATE POLICY "auth read recipes"
  ON public.recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng insert recipes"
  ON public.recipes FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "eng update recipes"
  ON public.recipes FOR UPDATE TO authenticated
  USING      (get_my_role() IN ('Engineer', 'Admin'))
  WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "admin delete recipes"
  ON public.recipes FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read recipe_parameters"
  ON public.recipe_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng insert recipe_parameters"
  ON public.recipe_parameters FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "eng update recipe_parameters"
  ON public.recipe_parameters FOR UPDATE TO authenticated
  USING      (get_my_role() IN ('Engineer', 'Admin'))
  WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
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
  ON public.qc_overrides FOR UPDATE TO authenticated
  USING      (get_my_role() IN ('Engineer', 'Admin'))
  WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "admin delete qc_overrides"
  ON public.qc_overrides FOR DELETE TO authenticated USING (get_my_role() = 'Admin');

CREATE POLICY "auth read lots"
  ON public.lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "eng insert lots"
  ON public.lots FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
CREATE POLICY "eng update lots"
  ON public.lots FOR UPDATE TO authenticated
  USING      (get_my_role() IN ('Engineer', 'Admin'))
  WITH CHECK (get_my_role() IN ('Engineer', 'Admin'));
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

-- No INSERT policy: all writes go through transition_batch_status RPC (SECURITY DEFINER).
-- Direct client inserts are intentionally blocked to protect audit trail integrity.
CREATE POLICY "auth read batch_status_changes"
  ON public.batch_status_changes FOR SELECT TO authenticated USING (true);


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

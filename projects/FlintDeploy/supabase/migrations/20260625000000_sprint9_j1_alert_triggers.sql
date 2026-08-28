-- Sprint 9 J1 — GAP-15: Server-side alert triggers
-- Mirrors scanAlerts() dedup_key format so alerts_dedup_active partial unique
-- index prevents duplicates when both code paths run.

-- ── Trigger 1: QC fail ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_alert_qc_fail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled      BOOLEAN;
  v_severity     TEXT;
  v_batch_id     UUID;
  v_batch_number TEXT;
  v_check_name   TEXT;
BEGIN
  IF NEW.passed IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT enabled, severity INTO v_enabled, v_severity
  FROM alert_rules WHERE key = 'qc_fail';
  IF NOT FOUND OR NOT v_enabled THEN
    RETURN NEW;
  END IF;

  SELECT pr.output_batch_id, b.batch_number
  INTO v_batch_id, v_batch_number
  FROM process_runs pr
  LEFT JOIN batches b ON b.id = pr.output_batch_id
  WHERE pr.id = NEW.process_run_id;

  SELECT qc_item_name INTO v_check_name
  FROM qc_check_definitions WHERE id = NEW.qc_check_definition_id;

  INSERT INTO alerts (rule_key, dedup_key, severity, message, batch_id)
  VALUES (
    'qc_fail',
    'qc_fail:' || NEW.id,
    COALESCE(v_severity, 'critical'),
    COALESCE(v_batch_number, 'Batch') || ' failed QC: ' || COALESCE(v_check_name, 'QC check'),
    v_batch_id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_alert_qc_fail
  AFTER INSERT ON public.qc_check_results
  FOR EACH ROW EXECUTE FUNCTION public.fn_alert_qc_fail();

-- ── Trigger 2: Batch held / quarantine / scrapped ─────────────────────────
CREATE OR REPLACE FUNCTION public.fn_alert_batch_held()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled  BOOLEAN;
  v_severity TEXT;
BEGIN
  IF NEW.status NOT IN ('OnHold', 'Quarantine', 'Scrapped') THEN
    RETURN NEW;
  END IF;
  -- Skip when status hasn't changed (other column update)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT enabled, severity INTO v_enabled, v_severity
  FROM alert_rules WHERE key = 'batch_held';
  IF NOT FOUND OR NOT v_enabled THEN
    RETURN NEW;
  END IF;

  INSERT INTO alerts (rule_key, dedup_key, severity, message, batch_id)
  VALUES (
    'batch_held',
    'batch_held:' || NEW.id || ':' || NEW.status,
    COALESCE(v_severity, 'warning'),
    NEW.batch_number || ' is ' || NEW.status,
    NEW.id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_alert_batch_held
  AFTER UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.fn_alert_batch_held();

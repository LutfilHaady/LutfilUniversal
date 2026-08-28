-- Customisable Alerts MVP
-- alert_rules: admin-tunable catalog of what raises alerts
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,
  label      text NOT NULL,
  enabled    boolean NOT NULL DEFAULT true,
  severity   text NOT NULL DEFAULT 'warning',
  threshold  numeric NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.alert_rules (key, label, enabled, severity, threshold) VALUES
  ('qc_fail',             'QC check failed',                    true, 'critical', NULL),
  ('batch_held',          'Batch on Hold / Quarantine / Scrap', true, 'warning',  NULL),
  ('maintenance_overdue', 'Equipment maintenance overdue',      true, 'warning',  0),
  ('expiry_soon',         'Material nearing expiry',            true, 'warning',  7)
ON CONFLICT (key) DO NOTHING;

-- alerts: dedup + provenance for scan-generated rows
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS rule_key  text NULL;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS dedup_key text NULL;

-- One active alert per condition; safety net against concurrent scans.
CREATE UNIQUE INDEX IF NOT EXISTS alerts_dedup_active
  ON public.alerts (dedup_key)
  WHERE resolved_at IS NULL AND dedup_key IS NOT NULL;

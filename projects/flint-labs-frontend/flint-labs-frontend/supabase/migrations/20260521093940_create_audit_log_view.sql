
CREATE OR REPLACE VIEW public.audit_log AS
SELECT
  'status_change'           AS event_type,
  bsc.id                    AS event_id,
  bsc.batch_id,
  b.batch_number,
  bsc.from_status::TEXT     AS from_value,
  bsc.to_status::TEXT       AS to_value,
  bsc.reason,
  bsc.changed_by            AS user_id,
  u.full_name               AS user_name,
  bsc.changed_at            AS created_at
FROM public.batch_status_changes bsc
JOIN public.batches b ON b.id = bsc.batch_id
LEFT JOIN public.users u ON u.id = bsc.changed_by

UNION ALL

SELECT
  'qc_override'             AS event_type,
  qo.id                     AS event_id,
  pr.output_batch_id        AS batch_id,
  b.batch_number,
  'Failed'                  AS from_value,
  'Overridden'              AS to_value,
  qo.override_reason        AS reason,
  qo.overridden_by          AS user_id,
  u.full_name               AS user_name,
  qo.overridden_at          AS created_at
FROM public.qc_overrides qo
JOIN public.qc_check_results qcr ON qcr.id = qo.qc_check_result_id
JOIN public.process_runs pr ON pr.id = qcr.process_run_id
LEFT JOIN public.batches b ON b.id = pr.output_batch_id
LEFT JOIN public.users u ON u.id = qo.overridden_by

ORDER BY created_at DESC;

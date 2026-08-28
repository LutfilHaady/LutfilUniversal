
CREATE OR REPLACE FUNCTION public.transition_batch_status(
  p_batch_id   UUID,
  p_new_status batch_status,
  p_reason     TEXT,
  p_user_id    UUID
)
RETURNS public.batches
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status batch_status;
  v_result     public.batches;
BEGIN
  SELECT status INTO v_old_status
  FROM public.batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch with id % not found', p_batch_id;
  END IF;

  IF NOT (
    (v_old_status = 'InProgress'  AND p_new_status IN ('Released', 'OnHold', 'Quarantine', 'Scrapped')) OR
    (v_old_status = 'OnHold'      AND p_new_status IN ('Released', 'Quarantine', 'Scrapped')) OR
    (v_old_status = 'Quarantine'  AND p_new_status IN ('Released', 'Scrapped'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_old_status, p_new_status;
  END IF;

  UPDATE public.batches
  SET status = p_new_status
  WHERE id = p_batch_id
  RETURNING * INTO v_result;

  INSERT INTO public.batch_status_changes (
    batch_id, from_status, to_status, changed_by, reason
  ) VALUES (
    p_batch_id, v_old_status, p_new_status, p_user_id, p_reason
  );

  RETURN v_result;
END;
$$;

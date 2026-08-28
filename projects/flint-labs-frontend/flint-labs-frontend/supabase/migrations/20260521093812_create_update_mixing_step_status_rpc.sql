
CREATE OR REPLACE FUNCTION public.update_mixing_step_status(
  p_step_id UUID,
  p_status  TEXT
)
RETURNS public.mixing_steps
LANGUAGE plpgsql
AS $$
DECLARE
  v_result public.mixing_steps;
BEGIN
  IF p_status NOT IN ('completed', 'voided') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be completed or voided.', p_status;
  END IF;

  UPDATE public.mixing_steps
  SET
    status       = p_status,
    completed_at = now()
  WHERE id = p_step_id
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mixing_step with id % not found', p_step_id;
  END IF;

  RETURN v_result;
END;
$$;

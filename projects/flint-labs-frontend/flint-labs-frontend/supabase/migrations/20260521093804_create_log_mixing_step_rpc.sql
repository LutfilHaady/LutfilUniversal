
CREATE OR REPLACE FUNCTION public.log_mixing_step(
  p_batch_id    UUID,
  p_type        TEXT,
  p_label       TEXT,
  p_params      JSONB,
  p_operator    UUID
)
RETURNS public.mixing_steps
LANGUAGE plpgsql
AS $$
DECLARE
  v_step_number INTEGER;
  v_display_ref TEXT;
  v_batch_number TEXT;
  v_result      public.mixing_steps;
BEGIN
  SELECT batch_number INTO v_batch_number
  FROM public.batches
  WHERE id = p_batch_id;

  SELECT COALESCE(MAX(step_number), 0) + 1
  INTO v_step_number
  FROM public.mixing_steps
  WHERE batch_id = p_batch_id
  FOR UPDATE;

  v_display_ref := v_batch_number || ' / ' || p_label || ' · Step ' || LPAD(v_step_number::TEXT, 2, '0');

  INSERT INTO public.mixing_steps (
    batch_id, step_number, type, label, display_ref, status, params, operator
  ) VALUES (
    p_batch_id, v_step_number, p_type, p_label, v_display_ref, 'in_progress', p_params, p_operator
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

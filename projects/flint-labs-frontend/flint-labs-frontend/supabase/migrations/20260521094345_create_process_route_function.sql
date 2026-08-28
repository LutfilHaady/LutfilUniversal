
CREATE OR REPLACE FUNCTION public.get_process_route(p_material_id UUID)
RETURNS TABLE (
  process_id        UUID,
  code              TEXT,
  name              TEXT,
  sequence_hint     INTEGER,
  requires_calibration BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_first_process_id UUID;
BEGIN
  SELECT first_process_id INTO v_first_process_id
  FROM public.materials
  WHERE id = p_material_id;

  IF v_first_process_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id          AS process_id,
    p.code,
    p.name,
    p.sequence_hint,
    p.requires_calibration
  FROM public.processes p
  WHERE p.sequence_hint >= (
    SELECT sequence_hint FROM public.processes WHERE id = v_first_process_id
  )
  ORDER BY p.sequence_hint;
END;
$$;

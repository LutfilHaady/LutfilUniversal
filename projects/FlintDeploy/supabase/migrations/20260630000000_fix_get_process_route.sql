-- Fix get_process_route: use materials.type to return the correct per-material
-- process sequence instead of the broken sequence_hint >= logic that caused all
-- materials to share the same flat route.

CREATE OR REPLACE FUNCTION public.get_process_route(p_material_id UUID)
RETURNS TABLE (
  process_id           UUID,
  code                 TEXT,
  name                 TEXT,
  sequence_hint        INTEGER,
  requires_calibration BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT type INTO v_type
  FROM public.materials
  WHERE id = p_material_id;

  IF v_type IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.code, p.name, p.sequence_hint, p.requires_calibration
  FROM public.processes p
  WHERE p.code = ANY(
    CASE v_type
      WHEN 'Cathode Electrode' THEN ARRAY['MIXC', 'CTGC', 'CALC', 'DICC']
      WHEN 'Anode Electrode'   THEN ARRAY['DICA']
      WHEN 'Separator'         THEN ARRAY['CUTS', 'SLTS']
      WHEN 'Casing'            THEN ARRAY['SLTC']
      WHEN 'Electrolyte'       THEN ARRAY['MIXE']
      ELSE                          ARRAY['UTPC']
    END
  )
  ORDER BY p.sequence_hint;
END;
$$;

-- Drop the old function that required client-side batch number generation
DROP FUNCTION IF EXISTS public.create_sub_batch(UUID, TEXT, TEXT, UUID, NUMERIC, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.create_sub_batch(
  p_parent_id           UUID,
  p_parent_batch_number TEXT,
  p_process_code        TEXT,
  p_material_id         UUID,
  p_quantity            NUMERIC,
  p_unit                TEXT,
  p_location            TEXT DEFAULT NULL,
  p_changed_by          UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining      NUMERIC;
  v_sub_id         UUID;
  v_material_code  TEXT;
  v_suffix         TEXT;
  v_date           TEXT;
  v_prefix         TEXT;
  v_count          INTEGER;
  v_seq            TEXT;
  v_batch_number   TEXT;
BEGIN
  -- Lock parent row to prevent concurrent splits of the same parent batch
  SELECT current_quantity INTO v_remaining
    FROM public.batches
   WHERE id = p_parent_id
     FOR UPDATE;

  IF v_remaining IS NULL THEN
    RAISE EXCEPTION 'Parent batch not found';
  END IF;

  IF p_quantity > v_remaining THEN
    RAISE EXCEPTION 'Split quantity exceeds remaining (remaining %.4f %)', v_remaining, p_unit;
  END IF;

  -- Resolve material code to construct ID suffix (e.g. MTC1 -> -C1)
  SELECT code INTO v_material_code
    FROM public.materials
   WHERE id = p_material_id;

  IF v_material_code IS NULL THEN
    v_suffix := '';
  ELSE
    v_suffix := '-' || regexp_replace(v_material_code, '^MT', '');
  END IF;

  -- Construct date prefix (YYYYMMDD) and process code prefix
  v_date := to_char(CURRENT_DATE, 'YYYYMMDD');
  v_prefix := p_process_code || '-' || v_date || '-';

  -- Count existing sibling sub-batches starting with the prefix
  SELECT COUNT(*) INTO v_count
    FROM public.batches
   WHERE batch_number LIKE v_prefix || '%';

  -- Format sequence e.g. A01, A02
  v_seq := 'A' || lpad((v_count + 1)::text, 2, '0');
  v_batch_number := v_prefix || v_seq || v_suffix;

  -- Insert sub-batch
  INSERT INTO public.batches (
    batch_number, parent_batch_id, material_id,
    status, current_quantity, original_quantity, unit, current_location
  ) VALUES (
    v_batch_number, p_parent_id, p_material_id,
    'InProgress', p_quantity, p_quantity, p_unit, p_location
  )
  RETURNING id INTO v_sub_id;

  -- Deduct from parent
  UPDATE public.batches
     SET current_quantity = current_quantity - p_quantity
   WHERE id = p_parent_id;

  -- Audit row
  INSERT INTO public.batch_status_changes (
    batch_id, from_status, to_status, changed_by, reason
  ) VALUES (
    v_sub_id, 'InProgress', 'InProgress', p_changed_by,
    'Sub-batch created from ' || p_parent_batch_number
  );

  RETURN json_build_object(
    'id', v_sub_id,
    'batch_number', v_batch_number
  );
END;
$$;

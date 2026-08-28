-- 1. Add suffix column to materials
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS suffix TEXT;

-- 2. Update create_sub_batch to prefer the suffix column
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
  v_remaining       NUMERIC;
  v_sub_id          UUID;
  v_material_code   TEXT;
  v_material_suffix TEXT;
  v_suffix          TEXT;
  v_date            TEXT;
  v_prefix          TEXT;
  v_count           INTEGER;
  v_seq             TEXT;
  v_batch_number    TEXT;
BEGIN
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

  SELECT code, suffix INTO v_material_code, v_material_suffix
    FROM public.materials
   WHERE id = p_material_id;

  IF v_material_code IS NULL THEN
    v_suffix := '';
  ELSE
    v_suffix := '-' || COALESCE(
      NULLIF(TRIM(v_material_suffix), ''),
      regexp_replace(v_material_code, '^MT', '')
    );
  END IF;

  v_date   := to_char(CURRENT_DATE, 'YYYYMMDD');
  v_prefix := p_process_code || '-' || v_date || '-';

  SELECT COUNT(*) INTO v_count
    FROM public.batches
   WHERE batch_number LIKE v_prefix || '%';

  v_seq          := 'A' || lpad((v_count + 1)::text, 2, '0');
  v_batch_number := v_prefix || v_seq || v_suffix;

  INSERT INTO public.batches (
    batch_number, parent_batch_id, material_id,
    status, current_quantity, original_quantity, unit, current_location
  ) VALUES (
    v_batch_number, p_parent_id, p_material_id,
    'InProgress', p_quantity, p_quantity, p_unit, p_location
  )
  RETURNING id INTO v_sub_id;

  UPDATE public.batches
     SET current_quantity = current_quantity - p_quantity
   WHERE id = p_parent_id;

  INSERT INTO public.batch_status_changes (
    batch_id, from_status, to_status, changed_by, reason
  ) VALUES (
    v_sub_id, 'InProgress', 'InProgress', p_changed_by,
    'Sub-batch created from ' || p_parent_batch_number
  );

  RETURN json_build_object('id', v_sub_id, 'batch_number', v_batch_number);
END;
$$;

-- 3. Material stock view (parent batches only — sub-batches are WIP, not inventory)
CREATE OR REPLACE VIEW public.material_stock_totals AS
SELECT
  material_id,
  COALESCE(SUM(current_quantity), 0)::NUMERIC AS total_stock
FROM public.batches
WHERE parent_batch_id IS NULL
  AND status IN ('InProgress', 'Released')
GROUP BY material_id;

-- 4. RLS write policies on materials
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'materials' AND policyname = 'materials_insert_engineer_admin'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY materials_insert_engineer_admin ON public.materials
        FOR INSERT
        TO authenticated
        WITH CHECK (get_my_role() IN ('Engineer', 'Admin'))
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'materials' AND policyname = 'materials_update_engineer_admin'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY materials_update_engineer_admin ON public.materials
        FOR UPDATE
        TO authenticated
        USING (get_my_role() IN ('Engineer', 'Admin'))
        WITH CHECK (get_my_role() IN ('Engineer', 'Admin'))
    $pol$;
  END IF;
END;
$do$;

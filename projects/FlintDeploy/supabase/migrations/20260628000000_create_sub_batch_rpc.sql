-- create_sub_batch RPC: atomically creates a sub-batch from a parent batch.
-- Locks the parent row, validates remaining quantity, inserts the child,
-- deducts from parent, and writes the audit row — all in one transaction.

CREATE OR REPLACE FUNCTION public.create_sub_batch(
  p_parent_id           UUID,
  p_parent_batch_number TEXT,
  p_batch_number        TEXT,
  p_material_id         UUID,
  p_quantity            NUMERIC,
  p_unit                TEXT,
  p_location            TEXT DEFAULT NULL,
  p_changed_by          UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining NUMERIC;
  v_sub_id    UUID;
BEGIN
  -- Lock parent row to prevent concurrent splits
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

  -- Insert sub-batch
  INSERT INTO public.batches (
    batch_number, parent_batch_id, material_id,
    status, current_quantity, original_quantity, unit, current_location
  ) VALUES (
    p_batch_number, p_parent_id, p_material_id,
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

  RETURN v_sub_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.generate_lot(
  p_lot_number      TEXT,
  p_category        TEXT,
  p_battery_type    TEXT,
  p_storage_location TEXT,
  p_notes           TEXT,
  p_created_by      UUID,
  p_sub_batch_ids   UUID[],
  p_unit_serials    TEXT[]
)
RETURNS public.lots
LANGUAGE plpgsql
AS $$
DECLARE
  v_lot        public.lots;
  v_serial     TEXT;
  v_batch_id   UUID;
BEGIN
  -- Insert the lot
  INSERT INTO public.lots (
    lot_number, category, battery_type, storage_location,
    notes, created_by, unit_count
  ) VALUES (
    p_lot_number, p_category, p_battery_type, p_storage_location,
    p_notes, p_created_by, array_length(p_unit_serials, 1)
  )
  RETURNING * INTO v_lot;

  -- Link sub-batches to the lot
  FOREACH v_batch_id IN ARRAY p_sub_batch_ids LOOP
    INSERT INTO public.lot_sub_batches (lot_id, sub_batch_id)
    VALUES (v_lot.id, v_batch_id);
  END LOOP;

  -- Create individual unit serial records
  FOREACH v_serial IN ARRAY p_unit_serials LOOP
    INSERT INTO public.units (serial, lot_id, sub_batch_id)
    VALUES (v_serial, v_lot.id, p_sub_batch_ids[1]);
  END LOOP;

  RETURN v_lot;
END;
$$;

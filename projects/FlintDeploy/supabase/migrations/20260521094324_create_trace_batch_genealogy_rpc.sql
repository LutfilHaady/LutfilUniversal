
CREATE OR REPLACE FUNCTION public.trace_batch_genealogy(p_batch_id UUID)
RETURNS TABLE (
  id               UUID,
  batch_number     TEXT,
  parent_batch_id  UUID,
  material_id      UUID,
  status           batch_status,
  current_quantity NUMERIC,
  unit             TEXT,
  depth            INTEGER,
  direction        TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY

  -- Walk ancestors (backward trace)
  WITH RECURSIVE ancestors AS (
    SELECT
      b.id, b.batch_number, b.parent_batch_id, b.material_id,
      b.status, b.current_quantity, b.unit,
      0 AS depth
    FROM public.batches b
    WHERE b.id = p_batch_id

    UNION ALL

    SELECT
      b.id, b.batch_number, b.parent_batch_id, b.material_id,
      b.status, b.current_quantity, b.unit,
      a.depth - 1
    FROM public.batches b
    JOIN ancestors a ON b.id = a.parent_batch_id
  ),

  -- Walk descendants (forward trace)
  descendants AS (
    SELECT
      b.id, b.batch_number, b.parent_batch_id, b.material_id,
      b.status, b.current_quantity, b.unit,
      0 AS depth
    FROM public.batches b
    WHERE b.id = p_batch_id

    UNION ALL

    SELECT
      b.id, b.batch_number, b.parent_batch_id, b.material_id,
      b.status, b.current_quantity, b.unit,
      d.depth + 1
    FROM public.batches b
    JOIN descendants d ON b.parent_batch_id = d.id
  )

  SELECT DISTINCT ON (combined.id)
    combined.id,
    combined.batch_number,
    combined.parent_batch_id,
    combined.material_id,
    combined.status,
    combined.current_quantity,
    combined.unit,
    combined.depth,
    CASE
      WHEN combined.depth < 0 THEN 'ancestor'
      WHEN combined.depth = 0 THEN 'self'
      ELSE 'descendant'
    END AS direction
  FROM (
    SELECT * FROM ancestors
    UNION ALL
    SELECT * FROM descendants WHERE depth > 0
  ) combined
  ORDER BY combined.id, combined.depth;
END;
$$;

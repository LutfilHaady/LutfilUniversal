
CREATE OR REPLACE FUNCTION public.trace_batch_genealogy(p_batch_id uuid)
RETURNS TABLE(id uuid, batch_number text, parent_batch_id uuid, material_id uuid, status batch_status, current_quantity numeric, unit text, depth integer, direction text)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY

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
  ),

  combined AS (
    SELECT * FROM ancestors
    UNION ALL
    SELECT * FROM descendants WHERE descendants.depth > 0
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
  FROM combined
  ORDER BY combined.id, combined.depth;
END;
$function$;

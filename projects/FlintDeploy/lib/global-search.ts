import supabase from '@/lib/supabase';

export type ResultKind = 'batch' | 'lot' | 'recipe' | 'machine';

export interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export const KIND_LABEL: Record<ResultKind, string> = {
  batch: 'Batches', lot: 'Lots', recipe: 'Recipes', machine: 'Machines',
};
export const KIND_TAG: Record<ResultKind, string> = {
  batch: 'BATCH', lot: 'LOT', recipe: 'RECIPE', machine: 'MACHINE',
};

// PostgREST or() filters use * as wildcard and treat ,() as syntax.
function sanitize(term: string): string {
  return term.replace(/[,()*%]/g, ' ').trim();
}

function batchResult(b: { id: string; batch_number: string; parent_batch_id: string | null; status: string }): SearchResult {
  return {
    kind: 'batch', id: b.id, title: b.batch_number,
    subtitle: `${b.parent_batch_id ? 'Sub-batch' : 'Main batch'} · ${b.status}`,
    href: b.parent_batch_id
      ? `/batches/${encodeURIComponent(b.parent_batch_id)}/${encodeURIComponent(b.id)}`
      : `/batches/${encodeURIComponent(b.id)}`,
  };
}

export async function runSearch(raw: string): Promise<SearchResult[]> {
  const term = sanitize(raw);
  if (!term) return [];
  const like = `%${term}%`;
  const orLike = `*${term}*`;

  const [batches, lots, recipes, machines] = await Promise.all([
    supabase.from('batches').select('id, batch_number, parent_batch_id, status')
      .ilike('batch_number', like).order('created_at', { ascending: false }).limit(6),
    supabase.from('lots').select('id, lot_number, status, category')
      .ilike('lot_number', like).order('created_at', { ascending: false }).limit(5),
    supabase.from('recipes').select('id, name, recipe_number, version')
      .or(`name.ilike.${orLike},recipe_number.ilike.${orLike}`).order('created_at', { ascending: false }).limit(5),
    supabase.from('equipment').select('id, equipment_code, name')
      .or(`equipment_code.ilike.${orLike},name.ilike.${orLike}`).order('equipment_code').limit(5),
  ]);

  const results: SearchResult[] = [];
  for (const b of batches.data ?? []) results.push(batchResult(b));
  for (const l of lots.data ?? []) results.push({
    kind: 'lot', id: l.id, title: l.lot_number,
    subtitle: [l.category, l.status].filter(Boolean).join(' · '),
    href: `/lots/${encodeURIComponent(l.id)}`,
  });
  for (const r of recipes.data ?? []) results.push({
    kind: 'recipe', id: r.id, title: r.name,
    subtitle: [r.recipe_number, r.version ? `v${r.version}` : null].filter(Boolean).join(' · '),
    href: `/recipes?q=${encodeURIComponent(r.recipe_number ?? r.name)}`,
  });
  for (const m of machines.data ?? []) results.push({
    kind: 'machine', id: m.id, title: m.name, subtitle: m.equipment_code,
    href: `/machines?q=${encodeURIComponent(m.equipment_code)}`,
  });
  return results;
}

// Exact (case-insensitive) match for QR scans. Order: batch, lot, recipe, machine.
export async function resolveExactMatch(raw: string): Promise<SearchResult | null> {
  const term = sanitize(raw);
  if (!term) return null;

  const batch = await supabase.from('batches')
    .select('id, batch_number, parent_batch_id, status')
    .ilike('batch_number', term).limit(1).maybeSingle();
  if (batch.data) return batchResult(batch.data);

  const lot = await supabase.from('lots').select('id, lot_number, status, category')
    .ilike('lot_number', term).limit(1).maybeSingle();
  if (lot.data) return {
    kind: 'lot', id: lot.data.id, title: lot.data.lot_number,
    subtitle: [lot.data.category, lot.data.status].filter(Boolean).join(' · '),
    href: `/lots/${encodeURIComponent(lot.data.id)}`,
  };

  const recipe = await supabase.from('recipes').select('id, name, recipe_number, version')
    .ilike('recipe_number', term).limit(1).maybeSingle();
  if (recipe.data) return {
    kind: 'recipe', id: recipe.data.id, title: recipe.data.name,
    subtitle: [recipe.data.recipe_number, recipe.data.version ? `v${recipe.data.version}` : null].filter(Boolean).join(' · '),
    href: `/recipes?q=${encodeURIComponent(recipe.data.recipe_number ?? recipe.data.name)}`,
  };

  const eq = await supabase.from('equipment').select('id, equipment_code, name')
    .ilike('equipment_code', term).limit(1).maybeSingle();
  if (eq.data) return {
    kind: 'machine', id: eq.data.id, title: eq.data.name, subtitle: eq.data.equipment_code,
    href: `/machines?q=${encodeURIComponent(eq.data.equipment_code)}`,
  };

  return null;
}

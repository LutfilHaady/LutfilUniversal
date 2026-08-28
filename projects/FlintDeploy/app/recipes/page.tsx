'use client';
import { useState, Fragment } from 'react';
import { Shell } from '@/components/shell';
import { useAuth } from '@/lib/auth-context';
import { IconPlus, IconChevronDown, IconChevronRight } from '@/components/icons';
import type { Recipe, RecipeProcess, ParamField } from '@/lib/types';
import { PROCESS_PARAM_FIELDS } from '@/lib/constants';
import { RecipePanel } from '@/components/recipes/recipe-panel';
import { useRecipes } from '@/lib/hooks/useRecipes';
import { DataState } from '@/components/data-state';
import { mutate } from 'swr';
import supabase from '@/lib/supabase';

// DB process names (e.g. "Mixing (Cathode)") may not match RecipeProcess keys exactly.
// This map normalises them so PROCESS_PARAM_FIELDS can be looked up correctly.
const DB_PROCESS_TO_RECIPE_PROCESS: Record<string, RecipeProcess> = {
  'Mixing (Cathode)':      'Mixing',
  'Mixing (Electrolyte)':  'Mixing',
  'Coating & Oven Drying': 'Coating & Oven Drying',
  'Calendaring':           'Calendaring',
  'Die Cutting (Cathode)': 'Die Cutting',
  'Die Cutting (Anode)':   'Die Cutting',
  'Cutting (Separator)':   'Cutting',
  'Slitting (Separator)':  'Slitting',
  'Slitting (Casing)':     'Slitting',
  'Assembly':              'Assembly',
};

function toRecipeProcess(dbName: string | undefined | null): RecipeProcess | null {
  if (!dbName) return null;
  return DB_PROCESS_TO_RECIPE_PROCESS[dbName] ?? (dbName as RecipeProcess);
}

// Render a JSONB leaf value (number | string | undefined) for display.
function fmtParam(v: unknown): string {
  return v === undefined || v === null || v === '' ? '—' : String(v);
}

type PanelState =
  | { mode: 'new' }
  | { mode: 'edit'; recipe: Recipe }
  | { mode: 'newVersion'; recipe: Recipe };

export default function RecipesPage() {
  const { user } = useAuth();
  const canEdit = (user?.role ?? 'Operator') === 'Engineer' || (user?.role ?? 'Operator') === 'Admin';
  const { recipes: fetchedRecipes, loading, error } = useRecipes();
  const [localRecipes, setLocalRecipes] = useState<Recipe[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flipping, setFlipping] = useState<Set<string>>(new Set());

  // local additions/edits take precedence; fetched data fills the rest
  const unsortedRecipes = [
    ...localRecipes.filter(lr => !fetchedRecipes.find(fr => fr.id === lr.id)),
    ...fetchedRecipes.map(fr => localRecipes.find(lr => lr.id === fr.id) ?? fr),
  ];

  const recipes = [...unsortedRecipes].sort((a, b) => {
    const aSimplified = !!a.params?.simplified_ratios;
    const bSimplified = !!b.params?.simplified_ratios;
    if (aSimplified && !bSimplified) return -1;
    if (!aSimplified && bSimplified) return 1;
    return 0;
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function flipActive(id: string) {
    if (flipping.has(id)) return;
    const base = recipes.find(r => r.id === id);
    if (!base) return;
    const next = !base.is_active;

    setFlipping(prev => new Set(prev).add(id));
    try {
      const { error: updateError } = await supabase
        .from('recipes')
        .update({ is_active: next })
        .eq('id', id);

      if (updateError) {
        showToast('Could not update recipe — try again');
        return;
      }

      const updated = { ...base, is_active: next };
      setLocalRecipes(prev => {
        const exists = prev.find(r => r.id === id);
        return exists ? prev.map(r => r.id === id ? updated : r) : [...prev, updated];
      });
    } finally {
      setFlipping(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  function handleSave(_newRecipe: Recipe, _oldRecipeId?: string) {
    setPanel(null);
    setLocalRecipes([]);
    mutate('recipes');
    showToast('Recipe saved');
  }

  return (
    <Shell
      title="Recipes"
      subtitle="/ Process parameters"
      headerActions={
        canEdit ? (
          <button
            onClick={() => setPanel({ mode: 'new' })}
            className="max-md:hidden h-9 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <IconPlus size={14} /> New Recipe
          </button>
        ) : undefined
      }
    >
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">
        <DataState loading={loading} error={error} empty={recipes.length === 0} emptyMessage="No recipes found">
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['', 'Recipe', 'Process', 'Version', 'Created by', 'Last updated', 'Active'].map(h => (
                    <th key={h} className={`px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] whitespace-nowrap ${['Version', 'Created by', 'Last updated'].includes(h) ? 'max-md:hidden' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {recipes.map(r => {
                  const isOpen = expanded.has(r.id);
                  const muted = !r.is_active;
                  const isSimplified = !!r.params?.simplified_ratios;

                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={'hover:bg-[#141414] transition-colors cursor-pointer' + (muted ? ' opacity-60' : '')}
                        onClick={() => toggle(r.id)}
                      >
                        <td className="px-4 py-3 w-8">
                          {isOpen
                            ? <IconChevronDown size={14} className="text-[#5a5a5a]" />
                            : <IconChevronRight size={14} className="text-[#5a5a5a]" />}
                        </td>
                        <td className="px-5 py-3">
                          <div className={`text-[12.5px] font-medium ${muted ? (isSimplified ? 'text-emerald-700' : 'text-[#4a4a4a]') : (isSimplified ? 'text-[#22c55e]' : 'text-[#f5f5f5]')}`}>{r.name}</div>
                          <div className={`text-[10.5px] font-mono ${muted ? 'text-[#3a3a3a]' : 'text-[#5a5a5a]'}`}>{r.recipe_number ?? 'ID not available'}</div>
                        </td>
                        <td className={`px-5 py-3 text-[12px] ${muted ? 'text-[#3a3a3a]' : 'text-[#888888]'}`}>{r.process?.name ?? '—'}</td>
                        <td className={`px-5 py-3 font-mono text-[12px] max-md:hidden ${muted ? 'text-[#3a3a3a]' : 'text-[#888888]'}`}>v{r.version}</td>
                        <td className={`px-5 py-3 text-[12px] max-md:hidden ${muted ? 'text-[#3a3a3a]' : 'text-[#888888]'}`}>{r.creator?.full_name ?? '—'}</td>
                        <td className={`px-5 py-3 text-[12px] font-mono max-md:hidden ${muted ? 'text-[#3a3a3a]' : 'text-[#888888]'}`}>{r.created_at}</td>
                        <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                          {canEdit && (
                            <button
                              onClick={() => flipActive(r.id)}
                              disabled={flipping.has(r.id)}
                              className={'relative inline-flex h-5 w-9 rounded-full transition-colors ' + (r.is_active ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]')}
                            >
                              <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ' + (r.is_active ? 'translate-x-4' : 'translate-x-0.5')} />
                            </button>
                          )}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-[#0d0d0d]">
                          <td colSpan={7} className="px-4 md:px-10 py-3 md:py-4">
                            {/* Expanded header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Parameters</div>
                              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                {canEdit && (
                                  <>
                                    <button
                                      onClick={() => setPanel({ mode: 'edit', recipe: r })}
                                      className="max-md:hidden h-7 px-3 rounded border border-[#2a2a2a] text-[11.5px] text-[#888888] hover:text-[#f5f5f5] hover:border-[#3a3a3a] hover:bg-[#1a1a1a] transition-colors"
                                    >
                                      Edit Parameters
                                    </button>
                                    <button
                                      onClick={() => setPanel({ mode: 'newVersion', recipe: r })}
                                      className="max-md:hidden h-7 px-3 rounded border border-[#2a2a2a] text-[11.5px] text-[#888888] hover:text-[#f5f5f5] hover:border-[#3a3a3a] hover:bg-[#1a1a1a] transition-colors"
                                    >
                                      + New Version
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Parameter cards */}
                            {(() => {
                              const params = r.params ?? {};
                              
                              if (params.simplified_ratios) {
                                const ratios = params.simplified_ratios as { material: string; amount: number; unit: string }[];
                                return (
                                  <div className="flex flex-col gap-2">
                                    <div className="text-[10px] font-mono text-[#5a5a5a] mb-1">Simplified Material Ratios</div>
                                    <div className="rounded-lg border border-[#1e1e1e] overflow-hidden">
                                      <table className="w-full text-left">
                                        <thead>
                                          <tr className="bg-[#0f0f0f]">
                                            <th className="px-2 md:px-3 py-1.5 md:py-2 text-[10px] font-mono text-[#5a5a5a] whitespace-nowrap">Material</th>
                                            <th className="px-2 md:px-3 py-1.5 md:py-2 text-[10px] font-mono text-[#5a5a5a] whitespace-nowrap">Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {ratios.map((row, ri) => (
                                            <tr key={ri} className="border-t border-[#1a1a1a]">
                                              <td className="px-2 md:px-3 py-1.5 md:py-2 text-[12px] font-mono text-[#f5f5f5] whitespace-nowrap">{fmtParam(row.material)}</td>
                                              <td className="px-2 md:px-3 py-1.5 md:py-2 text-[12px] font-mono text-[#f5f5f5] whitespace-nowrap">
                                                {fmtParam(row.amount)} <span className="text-[#888888] ml-1">{row.unit}</span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              }

                              const recipeProcess = toRecipeProcess(r.process?.name);
                              const fields = recipeProcess ? (PROCESS_PARAM_FIELDS[recipeProcess] ?? []) : [];
                              if (fields.length === 0) {
                                return <div className="text-[12px] text-[#5a5a5a] italic">No parameter fields defined for this process.</div>;
                              }
                              const scalars = fields.filter((f): f is Extract<ParamField, { kind: 'scalar' }> => f.kind === 'scalar');
                              const arrays  = fields.filter((f): f is Extract<ParamField, { kind: 'array'  }> => f.kind === 'array');
                              const rowDefs = fields.filter((f): f is Extract<ParamField, { kind: 'rows'   }> => f.kind === 'rows');
                              return (
                                <div className="flex flex-col gap-4">
                                  {scalars.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                      {scalars.map(f => (
                                        <div key={f.key} className="rounded-lg border border-[#1e1e1e] bg-[#111] px-2 md:px-3 py-1.5 md:py-2">
                                          <div className="text-[10px] font-mono text-[#5a5a5a]">{f.label} <span className="text-[#3a3a3a]">{f.unit}</span></div>
                                          <div className="text-[13px] font-mono text-[#f5f5f5] mt-1">{fmtParam(params[f.key])}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {arrays.map(f => (
                                    <div key={f.key}>
                                      <div className="text-[10px] font-mono text-[#5a5a5a] mb-1.5">{f.label} <span className="text-[#3a3a3a]">{f.unit}</span></div>
                                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                        {Array.from({ length: f.length }).map((_, i) => (
                                          <div key={i} className="rounded-lg border border-[#1e1e1e] bg-[#111] px-2 md:px-3 py-1.5 md:py-2">
                                            <div className="text-[10px] font-mono text-[#5a5a5a]">{f.itemLabels[i] ?? `#${i + 1}`}</div>
                                            <div className="text-[13px] font-mono text-[#f5f5f5] mt-1">{fmtParam((params[f.key] as unknown[] | undefined)?.[i])}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                  {rowDefs.map(f => (
                                    <div key={f.key}>
                                      <div className="text-[10px] font-mono text-[#5a5a5a] mb-1.5">{f.label}</div>
                                      <div className="rounded-lg border border-[#1e1e1e] overflow-hidden">
                                        <table className="w-full text-left">
                                          <thead>
                                            <tr className="bg-[#0f0f0f]">
                                              {f.columns.map(c => (
                                                <th key={c.key} className="px-2 md:px-3 py-1.5 md:py-2 text-[10px] font-mono text-[#5a5a5a] whitespace-nowrap">
                                                  {c.label}{c.unit ? ` (${c.unit})` : ''}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {((params[f.key] as Record<string, unknown>[] | undefined) ?? []).map((row, ri) => (
                                              <tr key={ri} className="border-t border-[#1a1a1a]">
                                                {f.columns.map(c => (
                                                  <td key={c.key} className="px-2 md:px-3 py-1.5 md:py-2 text-[12px] font-mono text-[#f5f5f5] whitespace-nowrap">{fmtParam(row?.[c.key])}</td>
                                                ))}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
        <footer className="pt-2 pb-1 text-[11px] font-mono text-[#5a5a5a]">FLINT TRACEABILITY v2 · BUILD 2026.04.30</footer>
      </main>

      {panel && (
        <RecipePanel
          mode={panel.mode}
          recipe={panel.mode !== 'new' ? panel.recipe : undefined}
          allRecipes={recipes}
          onClose={() => setPanel(null)}
          onSave={handleSave}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[13px] text-[#f5f5f5] shadow-xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
          {toast}
        </div>
      )}
    </Shell>
  );
}

'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase';
import { IconClose } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import type { Recipe, RecipeProcess } from '@/lib/types';
import { RECIPE_PROCESSES, PROCESS_MATERIALS, PROCESS_PARAM_FIELDS, PROCESS_MATERIAL_TO_DB_NAME } from '@/lib/constants';
import { initDraft, emptyRow, buildParams, isDraftValid, type RecipeDraft } from '@/lib/recipe-params';

export type PanelMode = 'new' | 'edit' | 'newVersion';

interface RecipePanelProps {
  mode: PanelMode;
  recipe?: Recipe;
  allRecipes: Recipe[];
  onClose: () => void;
  onSave: (recipe: Recipe, oldRecipeId?: string) => void;
}

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

function resolveRecipeProcess(dbName: string | null | undefined): RecipeProcess {
  if (!dbName) return 'Mixing';
  return DB_PROCESS_TO_RECIPE_PROCESS[dbName] ?? (dbName as RecipeProcess);
}

export function RecipePanel({ mode, recipe, allRecipes, onClose, onSave }: RecipePanelProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  const [dbProcesses, setDbProcesses] = useState<{ id: string; name: string }[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    supabase
      .from('processes')
      .select('id, name')
      .then(({ data }) => setDbProcesses(data ?? []));
  }, []);

  const initialProcess = resolveRecipeProcess(recipe?.process?.name);

  const [name, setName] = useState(recipe?.name ?? '');
  const [process, setProcess] = useState<RecipeProcess>(initialProcess);
  const [material, setMaterial] = useState<string>(() => {
    return PROCESS_MATERIALS[initialProcess]?.[0] ?? '';
  });
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [active, setActive] = useState(recipe?.is_active ?? true);
  const [draft, setDraft] = useState<RecipeDraft>(() =>
    initDraft(PROCESS_PARAM_FIELDS[resolveRecipeProcess(recipe?.process?.name)], recipe?.params),
  );

  const isLocked = mode === 'edit' || mode === 'newVersion';
  const isAssembly = process === 'Assembly';
  const nextMajor = recipe ? parseInt(recipe.version.split('.')[0], 10) + 1 : 1;

  const title =
    mode === 'new' ? 'New Recipe'
    : mode === 'edit' ? `Edit Recipe — ${recipe!.name}`
    : `New Version — ${recipe!.name}`;

  function handleProcessChange(p: RecipeProcess) {
    setProcess(p);
    setMaterial(PROCESS_MATERIALS[p][0] ?? '');
    setDraft(initDraft(PROCESS_PARAM_FIELDS[p]));
  }

  function setScalar(key: string, val: string) {
    setDraft(prev => ({ ...prev, [key]: val }));
  }
  function setArrayItem(key: string, i: number, val: string) {
    setDraft(prev => {
      const arr = [...(prev[key] as string[])];
      arr[i] = val;
      return { ...prev, [key]: arr };
    });
  }
  function setRowCell(key: string, rowIdx: number, colKey: string, val: string) {
    setDraft(prev => {
      const rows = (prev[key] as Record<string, string>[]).map((r, i) =>
        i === rowIdx ? { ...r, [colKey]: val } : r,
      );
      return { ...prev, [key]: rows };
    });
  }
  function addRow(key: string, columns: { key: string }[]) {
    setDraft(prev => ({ ...prev, [key]: [...(prev[key] as Record<string, string>[]), emptyRow(columns as never)] }));
  }
  function removeRow(key: string, rowIdx: number) {
    setDraft(prev => ({ ...prev, [key]: (prev[key] as Record<string, string>[]).filter((_, i) => i !== rowIdx) }));
  }

  const fields = PROCESS_PARAM_FIELDS[process];

  const step1Valid = name.trim() !== '';
  const step2Valid = isDraftValid(fields, draft);

  // Resolve the exact DB process_id from the selected process + material.
  function resolveProcessId(p: RecipeProcess, mat: string): string {
    const dbName = PROCESS_MATERIAL_TO_DB_NAME[`${p}|${mat}`];
    return dbProcesses.find(dp => dp.name === dbName)?.id ?? '';
  }

  async function handleSave() {
    if (!user) return;
    setSubmitError(null);
    setSubmitting(true);

    const builtParams = buildParams(fields, draft);

    try {
      if (mode === 'new') {
        const processId = resolveProcessId(process, material);
        if (!processId) {
          setSubmitError('Could not resolve the process for this material. Please try again.');
          return;
        }

        const { data: newRecipe, error: recipeError } = await supabase
          .from('recipes')
          .insert({
            name:             name.trim(),
            version:          '1.0',
            process_id:       processId,
            created_by:       user.id,
            parent_recipe_id: null,
            is_active:        active,
            notes:            notes.trim() || null,
            params:           builtParams,
          })
          .select('id, name, version, process_id, created_by, parent_recipe_id, is_active, created_at, notes, params')
          .single();

        if (recipeError) {
          setSubmitError(
            recipeError.code === '23505'
              ? 'A recipe with this name and version already exists.'
              : 'Could not create recipe. Please try again.'
          );
          return;
        }

        onSave({
          ...newRecipe,
          recipe_number: null,
          params: builtParams,
          process: null,
          creator: user ? { full_name: user.name } : null,
        });

      } else if (mode === 'edit') {
        const { error: updateError } = await supabase
          .from('recipes')
          .update({
            name:      name.trim(),
            notes:     notes.trim() || null,
            is_active: active,
            params:    builtParams,
          })
          .eq('id', recipe!.id);

        if (updateError) {
          setSubmitError(
            updateError.code === '23505'
              ? 'A recipe with this name and version already exists.'
              : 'Could not update recipe. Please try again.'
          );
          return;
        }

        onSave({
          ...recipe!,
          name:      name.trim(),
          notes:     notes.trim() || null,
          is_active: active,
          params:    builtParams,
        });

      } else {
        const newVersion = `${parseInt(recipe!.version.split('.')[0], 10) + 1}.0`;

        const { data: newVersionRow, error: versionError } = await supabase
          .from('recipes')
          .insert({
            name:             name.trim(),
            version:          newVersion,
            process_id:       recipe!.process_id,
            created_by:       user.id,
            parent_recipe_id: recipe!.id,
            is_active:        true,
            notes:            notes.trim() || null,
            params:           builtParams,
          })
          .select('id, name, version, process_id, created_by, parent_recipe_id, is_active, created_at, notes, params')
          .single();

        if (versionError) {
          setSubmitError(
            versionError.code === '23505'
              ? 'This version already exists for this recipe.'
              : 'Could not create new version. Please try again.'
          );
          return;
        }

        onSave(
          {
            ...newVersionRow,
            recipe_number: null,
            params: builtParams,
            process: recipe!.process,
            creator: recipe!.creator,
          },
          recipe!.id,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] ' +
    'placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors w-full';
  const selectCls = inputCls + ' cursor-pointer';
  const labelCls = 'text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]';
  const lockedCls =
    'h-9 px-3 rounded-md border border-[#1e1e1e] bg-[#141414] text-[13px] text-[#5a5a5a] flex items-center';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />

      <div className="w-[540px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#2a2a2a]">
          <div className="flex flex-col gap-1.5">
            <div className="text-[15px] font-semibold text-[#f5f5f5]">{title}</div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className={step === 1 ? 'text-[#22c55e]' : 'text-[#5a5a5a]'}>1. Details</span>
              <span className="text-[#3a3a3a]">→</span>
              <span className={step === 2 ? 'text-[#22c55e]' : 'text-[#5a5a5a]'}>2. Parameters</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors shrink-0"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {step === 1 && (
            <>
              {mode === 'newVersion' && (
                <div className="px-4 py-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] font-mono text-[#888888] leading-relaxed">
                  Creating v{nextMajor}.0 — previous version will be preserved as read-only
                </div>
              )}

              {/* Recipe Name */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>
                  Recipe Name <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Standard Cathode Coat v4"
                  className={inputCls}
                />
              </div>

              {/* Process */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>
                  Process <span className="text-[#ef4444]">*</span>
                </label>
                {isLocked ? (
                  <div className={lockedCls}>{process}</div>
                ) : (
                  <select
                    value={process}
                    onChange={e => handleProcessChange(e.target.value as RecipeProcess)}
                    className={selectCls}
                  >
                    {RECIPE_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
              </div>

              {/* Material */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Material</label>
                {isAssembly ? (
                  <div className={lockedCls}>All materials</div>
                ) : isLocked ? (
                  <div className={lockedCls}>{material}</div>
                ) : (
                  <select
                    value={material}
                    onChange={e => setMaterial(e.target.value)}
                    className={selectCls}
                  >
                    {PROCESS_MATERIALS[process].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe intended use or conditions..."
                  className="px-3 py-2.5 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors resize-none"
                />
              </div>

              {/* Set as Active */}
              <div className="flex items-center justify-between py-1">
                <span className={labelCls}>Set as Active</span>
                <button
                  type="button"
                  onClick={() => setActive(v => !v)}
                  className={'relative inline-flex h-5 w-9 rounded-full transition-colors ' + (active ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]')}
                >
                  <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ' + (active ? 'translate-x-4' : 'translate-x-0.5')} />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Summary */}
              <div className="px-4 py-3 rounded-md border border-[#1e1e1e] bg-[#141414] flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono text-[#5a5a5a] uppercase tracking-[0.1em]">Recipe</span>
                  <span className="text-[13px] text-[#f5f5f5]">{name}</span>
                </div>
                <div className="w-px h-8 bg-[#2a2a2a]" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono text-[#5a5a5a] uppercase tracking-[0.1em]">Process</span>
                  <span className="text-[13px] text-[#888888]">{process}</span>
                </div>
              </div>

              {fields.length === 0 ? (
                <div className="px-4 py-4 rounded-md border border-[#2a2a2a] bg-[#141414] text-[13px] text-[#888888] leading-relaxed">
                  This process has no configurable machine parameters.
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {fields.map(f => {
                    if (f.kind === 'scalar') {
                      return (
                        <div key={f.key} className="flex flex-col gap-1.5">
                          <label className={labelCls}>
                            {f.label} <span className="text-[#5a5a5a] normal-case font-normal">{f.unit}</span>
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={draft[f.key] as string}
                            onChange={e => setScalar(f.key, e.target.value)}
                            className={inputCls}
                          />
                        </div>
                      );
                    }
                    if (f.kind === 'array') {
                      return (
                        <div key={f.key} className="flex flex-col gap-2">
                          <div className={labelCls}>{f.label} <span className="text-[#5a5a5a] normal-case font-normal">{f.unit}</span></div>
                          <div className="grid grid-cols-6 gap-2">
                            {Array.from({ length: f.length }).map((_, i) => (
                              <div key={i} className="flex flex-col gap-1">
                                <span className="text-[10px] font-mono text-[#5a5a5a]">{f.itemLabels[i] ?? `#${i + 1}`}</span>
                                <input
                                  type="number"
                                  step="any"
                                  value={(draft[f.key] as string[])[i] ?? ''}
                                  onChange={e => setArrayItem(f.key, i, e.target.value)}
                                  className="h-8 px-1 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-center text-[#f5f5f5] outline-none focus:border-[#22c55e] transition-colors w-full"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    // f.kind === 'rows'
                    const rows = draft[f.key] as Record<string, string>[];
                    return (
                      <div key={f.key} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className={labelCls}>{f.label}</div>
                          <button
                            type="button"
                            onClick={() => addRow(f.key, f.columns)}
                            className="h-7 px-3 rounded border border-[#2a2a2a] text-[11.5px] text-[#22c55e] hover:bg-[#1a1a1a] transition-colors"
                          >
                            + {f.addLabel}
                          </button>
                        </div>
                        {rows.length === 0 && (
                          <div className="text-[12px] text-[#5a5a5a] italic">No steps yet — add at least one.</div>
                        )}
                        {rows.map((row, ri) => (
                          <div key={ri} className="rounded-md border border-[#1e1e1e] bg-[#111] p-3 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-[#5a5a5a]">Step {ri + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeRow(f.key, ri)}
                                className="text-[11px] text-[#ef4444] hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {f.columns.map(c => (
                                <div key={c.key} className="flex flex-col gap-1">
                                  <span className="text-[10px] font-mono text-[#5a5a5a]">{c.label}{c.unit ? ` (${c.unit})` : ''}</span>
                                  <input
                                    type={c.type === 'text' ? 'text' : 'number'}
                                    step={c.type === 'text' ? undefined : 'any'}
                                    value={row[c.key] ?? ''}
                                    onChange={e => setRowCell(f.key, ri, c.key, e.target.value)}
                                    className="h-8 px-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#f5f5f5] outline-none focus:border-[#22c55e] transition-colors w-full"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] flex gap-3">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-black text-[13px] font-semibold transition-colors"
              >
                Next: Set Parameters →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
              >
                ← Back
              </button>
              <div className="flex-1 flex flex-col gap-2">
                {submitError && (
                  <div className="text-[11.5px] text-[#f87171]">{submitError}</div>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!step2Valid || submitting}
                  className="w-full h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-black text-[13px] font-semibold transition-colors"
                >
                  {submitting ? 'Saving…' : 'Save Recipe'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

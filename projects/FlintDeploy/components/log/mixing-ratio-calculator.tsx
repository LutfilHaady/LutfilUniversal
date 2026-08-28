'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { toRatioRows, type RatioRow } from '@/lib/mixing/ratio-plan';
import type { MixingStep, AddMaterialStep } from '@/lib/types';

interface RecipeOption {
  id: string;
  recipe_number: string | null;
  version: string;
  rows: RatioRow[];
}

interface Props {
  processId: string | null;
  steps?: MixingStep[];
  className?: string;
}

export function MixingRatioCalculator({ processId, steps, className }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [basis, setBasis] = useState('total'); // 'total' or materialCode
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (!processId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('recipes')
      .select('id, recipe_number, version, params')
      .eq('process_id', processId)
      .eq('is_active', true)
      .then(({ data }) => {
        if (cancelled) return;
        const opts = (data ?? []).map(r => ({
          id: r.id as string,
          recipe_number: r.recipe_number as string | null,
          version: r.version as string,
          rows: toRatioRows(r.params as Record<string, unknown> | null),
        }));
        setRecipes(opts);
        setSelectedId(opts[0]?.id ?? '');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [processId]);

  const selected = recipes.find(r => r.id === selectedId) ?? null;
  const ratioSum = selected ? selected.rows.reduce((sum, r) => sum + r.amountKg, 0) : 0;

  // Check for logged material steps (completed only)
  const loggedMaterials = (steps ?? []).filter(
    (s): s is AddMaterialStep => s.type === 'add_material' && s.status === 'completed'
  );
  const firstLoggedStep = loggedMaterials[0] ?? null;

  const lockedAnchor = firstLoggedStep
    ? {
        material: firstLoggedStep.params.materialCode,
        quantity: firstLoggedStep.params.quantity,
      }
    : null;

  const currentBasis = lockedAnchor ? lockedAnchor.material : basis;
  const currentQtyVal = lockedAnchor ? lockedAnchor.quantity : parseFloat(inputValue);
  const hasQty = lockedAnchor
    ? true
    : (inputValue.trim() !== '' && !Number.isNaN(currentQtyVal) && currentQtyVal > 0);

  const basisOptions = [
    { value: 'total', label: 'Total Batch Size' },
    ...(selected ? selected.rows.map(r => ({ value: r.material, label: `${r.material} Basis` })) : []),
  ];

  return (
    <div className={className ?? "mx-5 mt-3 rounded-xl border border-[#1e1e1e] bg-[#0e0e0e] shrink-0"}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[12.5px] font-semibold text-[#f5f5f5]">Mixing Ratio Calculator</span>
        <span className="text-[11px] font-mono text-[#5a5a5a]">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {loading ? (
            <div className="text-[12px] text-[#5a5a5a]">Loading recipe…</div>
          ) : recipes.length === 0 ? (
            <div className="text-[12px] text-[#5a5a5a]">No active recipe configured for this process.</div>
          ) : (
            <>
              {recipes.length > 1 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">Recipe</label>
                  <select
                    value={selectedId}
                    onChange={e => setSelectedId(e.target.value)}
                    className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e]"
                  >
                    {recipes.map(r => (
                      <option key={r.id} value={r.id}>{r.recipe_number ?? 'ID not available'} v{r.version}</option>
                    ))}
                  </select>
                </div>
              )}

              {ratioSum === 0 ? (
                <div className="text-[12px] text-[#5a5a5a]">Recipe has no per-material ratios configured.</div>
              ) : (
                <>
                  {lockedAnchor ? (
                    <div className="rounded-md border border-[#22c55e]/20 bg-[#0e160e] px-3.5 py-2.5">
                      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#22c55e] font-semibold">
                        Locked to first logged step
                      </div>
                      <div className="text-[13px] font-mono text-[#86efac] mt-0.5">
                        {lockedAnchor.material} — {lockedAnchor.quantity} kg
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">Basis</label>
                        <select
                          value={basis}
                          onChange={e => {
                            setBasis(e.target.value);
                            setInputValue('');
                          }}
                          className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e]"
                        >
                          {basisOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">
                          {basis === 'total' ? 'Total Batch Size (kg)' : `${basis} Qty (kg)`}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={inputValue}
                          onChange={e => setInputValue(e.target.value)}
                          placeholder="0.0"
                          className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-[#1e1e1e] overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#111]">
                          <th className="px-3 py-2 text-[10px] font-mono text-[#5a5a5a]">Material</th>
                          <th className="px-3 py-2 text-[10px] font-mono text-[#5a5a5a]">Ratio (kg)</th>
                          <th className="px-3 py-2 text-[10px] font-mono text-[#5a5a5a]">Quantity (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected!.rows.map((r, i) => {
                          let qty: number | null = null;
                          if (hasQty && currentQtyVal !== null && !Number.isNaN(currentQtyVal)) {
                            if (currentBasis === 'total') {
                              qty = (r.amountKg / ratioSum) * currentQtyVal;
                            } else {
                              const anchorRow = selected!.rows.find(row => row.material === currentBasis);
                              const anchorRatio = anchorRow ? anchorRow.amountKg : 0;
                              qty = anchorRatio > 0 ? (r.amountKg / anchorRatio) * currentQtyVal : null;
                            }
                          }
                          return (
                            <tr key={i} className="border-t border-[#1a1a1a]">
                              <td className="px-3 py-2 text-[12px] text-[#f5f5f5]">{r.material}</td>
                              <td className="px-3 py-2 text-[12px] font-mono text-[#888888]">{r.amountKg}</td>
                              <td className="px-3 py-2 text-[12px] font-mono text-[#f5f5f5]">
                                {qty === null ? '—' : qty.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

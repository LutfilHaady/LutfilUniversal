'use client';

import { useState, useEffect } from 'react';
import { Shell } from '@/components/shell';
import { useAuth } from '@/lib/auth-context';
import { useMaterials, type Material } from '@/lib/hooks/useMaterials';
import { CATEGORIES } from '@/lib/constants';
import supabase from '@/lib/supabase';

interface Process { id: string; code: string; name: string }

// ── helpers ────────────────────────────────────────────────────────────────

function stockBadge(mat: Material): { label: string; color: string } {
  const { total_stock, min_storage_threshold } = mat;
  if (min_storage_threshold == null) return { label: '—', color: '#5a5a5a' };
  if (total_stock === 0) return { label: 'Empty', color: '#ef4444' };
  if (total_stock < min_storage_threshold) return { label: 'Low', color: '#f59e0b' };
  return { label: 'OK', color: '#22c55e' };
}

const inputCls =
  'h-10 px-3 rounded-md bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#e0e0e0] ' +
  'placeholder:text-[#555] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-colors w-full';

// ── Modal ──────────────────────────────────────────────────────────────────

function MaterialModal({
  initial,
  processes,
  onClose,
  onSaved,
}: {
  initial: Material | null;
  processes: Process[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial !== null;
  const [code, setCode]             = useState(initial?.code ?? '');
  const [name, setName]             = useState(initial?.name ?? '');
  const [suffix, setSuffix]         = useState(initial?.suffix ?? '');
  const [type, setType]             = useState(initial?.type ?? '');
  const [threshold, setThreshold]   = useState(String(initial?.min_storage_threshold ?? ''));
  const [shelfLife, setShelfLife]   = useState(String(initial?.shelf_life_days ?? ''));
  const [processId, setProcessId]   = useState(initial?.first_process_id ?? '');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!isEdit && !code.trim()) { setError('Code is required.'); return; }
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name:                   name.trim(),
      suffix:                 suffix.trim() || null,
      type:                   type || null,
      min_storage_threshold:  threshold ? parseFloat(threshold) : null,
      shelf_life_days:        shelfLife ? parseInt(shelfLife, 10) : null,
      first_process_id:       processId || null,
    };

    let err;
    if (isEdit) {
      ({ error: err } = await supabase
        .from('materials')
        .update(payload)
        .eq('id', initial!.id));
    } else {
      payload.code = code.trim().toUpperCase();
      ({ error: err } = await supabase.from('materials').insert(payload));
    }

    setSaving(false);
    if (err) {
      if ((err as { code?: string }).code === '23505') setError('A material with that code already exists.');
      else setError((err as { message: string }).message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        data-testid="material-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit material' : 'Register material'}
        className="relative z-10 w-[480px] max-w-[92vw] bg-[#0a0a0a] border border-[#363636] rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-[16px] font-semibold text-[#f5f5f5]">{isEdit ? 'Edit material' : 'Register material'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="px-4 py-2.5 rounded-md bg-[rgba(239,68,68,.12)] border border-[rgba(239,68,68,.3)] text-[12px] text-[#fca5a5] font-mono">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-code" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">Code</label>
            <input
              id="mat-code"
              aria-label="Code"
              className={inputCls + (isEdit ? ' opacity-50 cursor-not-allowed' : '')}
              placeholder="e.g. MTB9"
              value={code}
              readOnly={isEdit}
              onChange={e => setCode(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-name" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">Name</label>
            <input
              id="mat-name"
              aria-label="Name"
              className={inputCls}
              placeholder="e.g. Material B9"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-suffix" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
              Suffix <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
            </label>
            <input
              id="mat-suffix"
              aria-label="Suffix"
              className={inputCls}
              placeholder="e.g. B9 (defaults to stripping MT prefix)"
              value={suffix}
              onChange={e => setSuffix(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-type" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
              Category <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
            </label>
            <select
              id="mat-type"
              aria-label="Category"
              className={inputCls + ' bg-[#161616]'}
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="">— Select category —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label htmlFor="mat-threshold" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
                Min Threshold <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
              </label>
              <input
                id="mat-threshold"
                aria-label="Min Threshold"
                className={inputCls}
                placeholder="0"
                inputMode="decimal"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label htmlFor="mat-shelf" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
                Shelf Life (days) <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
              </label>
              <input
                id="mat-shelf"
                aria-label="Shelf Life Days"
                className={inputCls}
                placeholder="365"
                inputMode="numeric"
                value={shelfLife}
                onChange={e => setShelfLife(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-process" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
              First Process <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
            </label>
            <select
              id="mat-process"
              aria-label="First Process"
              className={inputCls + ' bg-[#161616]'}
              value={processId}
              onChange={e => setProcessId(e.target.value)}
            >
              <option value="">— Select process —</option>
              {processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-[#2a2a2a] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] hover:text-[#f5f5f5] text-[12.5px] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save material'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function MaterialsPage() {
  const { user } = useAuth();
  const { materials, loading, error, mutate } = useMaterials();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [modalMaterial, setModalMaterial] = useState<Material | 'new' | null>(null);

  const canWrite = user?.role === 'Engineer' || user?.role === 'Admin';

  useEffect(() => {
    supabase.from('processes').select('id, code, name').order('sequence_hint')
      .then(({ data }) => setProcesses((data ?? []) as Process[]));
  }, []);

  const totalCount       = materials.length;
  const lowStockCount    = materials.filter(
    m => m.min_storage_threshold != null && m.total_stock < m.min_storage_threshold
  ).length;
  const totalInventory   = materials.reduce((sum, m) => sum + m.total_stock, 0);

  return (
    <Shell>
      <main className="flex-1 min-h-0 px-6 py-6 overflow-y-auto flex flex-col gap-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold text-[#f5f5f5]">Materials</h1>
            <p className="text-[12.5px] text-[#888888] mt-0.5">Raw material master data and current stock levels</p>
          </div>
          {canWrite && (
            <button
              data-testid="register-material-btn"
              onClick={() => setModalMaterial('new')}
              className="h-9 px-4 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold transition-colors"
            >
              + Register material
            </button>
          )}
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div data-testid="materials-kpi-total" className="bg-[#161616] border border-[#2a2a2a] rounded-md px-5 py-4 flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Total Materials</div>
            <div className="text-[28px] leading-none font-semibold font-mono tabular-nums text-[#f5f5f5]">{loading ? '—' : totalCount}</div>
          </div>
          <div data-testid="materials-kpi-low-stock" className="bg-[#161616] border border-[#2a2a2a] rounded-md px-5 py-4 flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Low Stock Alerts</div>
            <div
              className="text-[28px] leading-none font-semibold font-mono tabular-nums"
              style={{ color: lowStockCount > 0 ? '#f59e0b' : '#22c55e' }}
            >
              {loading ? '—' : lowStockCount}
            </div>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-md border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-[12.5px] text-[#fca5a5]">
            {error}
          </div>
        )}

        {/* ── Materials grid ─────────────────────────────────────────── */}
        <section className="bg-[#161616] border border-[#2a2a2a] rounded-md flex flex-col">
          <div className="px-5 pt-4 pb-3 border-b border-[#2a2a2a]">
            <h2 className="text-[14px] font-semibold text-[#f5f5f5]">All materials</h2>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-[12px] font-mono text-[#5a5a5a]">Loading…</div>
          ) : materials.length === 0 ? (
            <div className="px-5 py-12 text-center text-[12px] font-mono text-[#5a5a5a]">No materials configured.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full md:min-w-[800px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[0.12em] text-[#5a5a5a] font-medium">
                    <th className="pl-5 pr-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Suffix</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Stock</th>
                    <th className="px-3 py-2.5">Min Threshold</th>
                    <th className="px-3 py-2.5">Status</th>
                    {canWrite && <th className="pr-5 px-3 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {materials.map(mat => {
                    const badge = stockBadge(mat);
                    return (
                      <tr key={mat.id} className="border-t border-[#2a2a2a] hover:bg-[#1c1c1c] transition-colors">
                        <td className="pl-5 pr-3 py-3 font-mono text-[12px] text-[#22c55e]">{mat.code}</td>
                        <td className="px-3 py-3 text-[13px] text-[#f5f5f5]">{mat.name}</td>
                        <td className="px-3 py-3 font-mono text-[12px] text-[#888888]">
                          {mat.suffix ?? <span className="text-[#5a5a5a]">auto</span>}
                        </td>
                        <td className="px-3 py-3 text-[12.5px] text-[#888888]">{mat.type ?? '—'}</td>
                        <td className="px-3 py-3 font-mono text-[12.5px] text-[#f5f5f5] tabular-nums">{mat.total_stock.toLocaleString()}</td>
                        <td className="px-3 py-3 font-mono text-[12.5px] text-[#888888] tabular-nums">
                          {mat.min_storage_threshold != null ? mat.min_storage_threshold.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            data-testid={`stock-badge-${mat.id}`}
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold font-mono"
                            style={{ color: badge.color, background: `${badge.color}22`, border: `1px solid ${badge.color}66` }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        {canWrite && (
                          <td className="pr-5 px-3 py-3 text-right">
                            <button
                              data-testid={`edit-material-${mat.id}`}
                              onClick={() => setModalMaterial(mat)}
                              className="text-[11.5px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {modalMaterial !== null && (
        <MaterialModal
          initial={modalMaterial === 'new' ? null : modalMaterial}
          processes={processes}
          onClose={() => setModalMaterial(null)}
          onSaved={() => mutate()}
        />
      )}
    </Shell>
  );
}

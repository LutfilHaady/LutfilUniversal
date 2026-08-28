'use client';

import { useState } from 'react';
import { IconClose, IconPlus } from '@/components/icons';
import { CATEGORIES } from '@/lib/data';

interface CreateBatchModalProps {
  onClose: () => void;
}

const SUPPLIERS: Record<string, string[]> = {
  'Cathode Electrode': ['Targray Industries', 'Umicore', 'BASF Catalysts'],
  'Anode Electrode':   ['BTR New Material', 'Showa Denko', 'Hitachi Chemical'],
  'Separator':         ['Asahi Kasei', 'Celgard', 'Toray Industries'],
  'Electrolyte':       ['Stella Chemifa', 'Kanto Chemical', 'Soulbrain'],
  'Cell Assembly':     ['Internal', 'Samsung SDI', 'Panasonic Energy'],
};

const MACHINES: Record<string, string[]> = {
  'Cathode Electrode': ['Coating Line A', 'Coating Line B'],
  'Anode Electrode':   ['Calendaring A', 'Calendaring B'],
  'Separator':         ['Slitting Line 1', 'Slitting Line 2'],
  'Electrolyte':       ['Filling Station 1', 'Filling Station 2'],
  'Cell Assembly':     ['Assembly Line 1', 'Assembly Line 2'],
};

export function CreateBatchModal({ onClose }: CreateBatchModalProps) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [qty, setQty] = useState('');
  const [supplier, setSupplier] = useState('');
  const [machine, setMachine] = useState('');
  const [operator, setOperator] = useState('');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  const suppliers = SUPPLIERS[category] ?? [];
  const machines = MACHINES[category] ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="w-[440px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div>
            <div className="text-[15px] font-semibold text-[#f5f5f5]">New Batch</div>
            <div className="text-[11px] text-[#888888] font-mono mt-0.5">
              Step {step} of 2 — {step === 1 ? 'Material & Qty' : 'Process Setup'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-6 pt-4">
          {[1, 2].map((s) => (
            <div
              key={s}
              className="flex-1 h-0.5 rounded-full"
              style={{ background: s <= step ? '#22c55e' : '#2a2a2a' }}
            />
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {step === 1 ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Category</label>
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setSupplier(''); setMachine(''); }}
                  className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e] transition-colors"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Total Quantity (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="e.g. 50.0"
                  className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Supplier</label>
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e] transition-colors"
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Received Date</label>
                <input
                  type="date"
                  defaultValue="2026-04-30"
                  className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Machine / Line</label>
                <select
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e] transition-colors"
                >
                  <option value="">Select machine…</option>
                  {machines.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Operator</label>
                <input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="e.g. L. Tan"
                  className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Sub-batch Qty (kg each)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 12.5"
                  className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional run notes…"
                  className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors resize-none"
                />
              </div>

              {/* Summary card */}
              <div className="rounded-lg border border-[#2a2a2a] bg-[#161616] p-4 flex flex-col gap-2">
                <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] mb-1">Summary</div>
                {[
                  ['Category', category],
                  ['Qty', qty ? `${qty} kg` : '—'],
                  ['Supplier', supplier || '—'],
                  ['Machine', machine || '—'],
                  ['Operator', operator || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-[11.5px] text-[#888888]">{k}</span>
                    <span className="text-[11.5px] font-mono text-[#f5f5f5]">{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] flex items-center gap-3">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit as any}
            className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            {step === 1 ? 'Next →' : <><IconPlus size={14} /> Create Batch</>}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { IconClose } from '@/components/icons';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface EditSubBatchDrawerProps {
  subBatchId: string;
  batchNumber: string;
  currentQty: number | null;
  unit: string | null;
  location: string | null;
  notes: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditSubBatchDrawer({
  subBatchId,
  batchNumber,
  currentQty,
  unit,
  location,
  notes,
  onClose,
  onUpdated,
}: EditSubBatchDrawerProps) {
  const { user } = useAuth();
  
  // Enter animation
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const [qtyValue, setQtyValue] = useState(currentQty?.toString() ?? '');
  const [locValue, setLocValue] = useState(location ?? '');
  const [notesValue, setNotesValue] = useState(notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const qtyNum = qtyValue === '' ? null : parseFloat(qtyValue);
    if (qtyNum !== null && (Number.isNaN(qtyNum) || qtyNum < 0)) {
      setError('Please enter a valid non-negative quantity.');
      setSubmitting(false);
      return;
    }

    try {
      const { error: updateErr } = await supabase
        .from('batches')
        .update({
          current_quantity: qtyNum,
          current_location: locValue.trim() || null,
          notes: notesValue.trim() || null,
        })
        .eq('id', subBatchId);

      if (updateErr) {
        setError(updateErr.message || `DB error (${updateErr.code})`);
        setSubmitting(false);
        return;
      }

      onUpdated();
      onClose();
    } catch (err) {
      console.error('[EditSubBatch] unexpected error', err);
      setError(err instanceof Error ? err.message : 'Unexpected error — check console');
      setSubmitting(false);
    }
  }

  const drawerInputCls =
    'h-10 px-3 rounded-md bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#e0e0e0] ' +
    'placeholder:text-[#555] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-colors w-full';

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className={'absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 ' + (shown ? 'opacity-100' : 'opacity-0')}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={
          'absolute right-0 top-0 h-full w-[480px] max-w-[92vw] bg-[#0a0a0a] border-l border-[#363636] flex flex-col shadow-2xl ' +
          'transition-transform duration-300 ease-out ' + (shown ? 'translate-x-0' : 'translate-x-full')
        }
      >
        <div className="shrink-0 px-6 py-4 border-b border-[#2a2a2a] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold leading-tight text-[#f5f5f5]">Edit sub-batch</h2>
            <div className="mt-1 text-[12px] text-[#888888] flex items-center gap-1.5">
              <span>Editing</span>
              <span className="font-mono text-[#f5f5f5]/80 text-[12px]">{batchNumber}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 -mr-1 -mt-0.5 rounded-md text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1c1c1c] flex items-center justify-center transition-colors"
          >
            <IconClose size={17} />
          </button>
        </div>

        <form id="edit-subbatch-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-5 px-4 py-2.5 rounded-md bg-[rgba(239,68,68,.12)] border border-[rgba(239,68,68,.3)] text-[12px] text-[#fca5a5] font-mono">
              {error}
            </div>
          )}

          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-qty" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
                Current Quantity
              </label>
              <div className="flex gap-2">
                <input
                  id="edit-qty"
                  type="number"
                  step="0.01"
                  min="0"
                  className={drawerInputCls + ' flex-1 font-mono tabular-nums'}
                  placeholder="0"
                  value={qtyValue}
                  onChange={(e) => setQtyValue(e.target.value)}
                />
                {unit && (
                  <div className="shrink-0 h-10 px-3 flex items-center rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] font-mono text-[#888888]">
                    {unit}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-[#1f1f1f] pt-4">
              <div className="flex items-center gap-2">
                <label htmlFor="edit-location" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
                  Storage Location
                </label>
                <span className="text-[10px] text-[#5a5a5a] font-mono lowercase tracking-normal">optional</span>
              </div>
              <input
                id="edit-location"
                className={drawerInputCls}
                placeholder="e.g. Store A · Rack 2"
                value={locValue}
                onChange={(e) => setLocValue(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 border-t border-[#1f1f1f] pt-4">
              <div className="flex items-center gap-2">
                <label htmlFor="edit-notes" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
                  Notes
                </label>
                <span className="text-[10px] text-[#5a5a5a] font-mono lowercase tracking-normal">optional</span>
              </div>
              <textarea
                id="edit-notes"
                className={drawerInputCls + ' h-24 py-2.5 resize-none leading-relaxed'}
                placeholder="Any additional notes for this sub-batch…"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
              />
            </div>
            
            <div className="mt-2 flex items-center justify-between border-t border-[#1f1f1f] pt-4">
              <span className="text-[11.5px] text-[#5a5a5a]">Edited by</span>
              <span className="text-[11.5px] font-mono text-[#888888]">{user?.name ?? '—'}</span>
            </div>
          </div>
        </form>

        <div className="shrink-0 px-6 py-3.5 border-t border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] hover:text-[#f5f5f5] text-[12.5px] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-subbatch-form"
            disabled={submitting}
            className="h-9 px-4 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

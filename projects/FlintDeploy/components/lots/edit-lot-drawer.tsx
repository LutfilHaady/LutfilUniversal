'use client';

import { useState, useEffect } from 'react';
import { IconClose, IconPlus, IconTrash, IconAlert } from '@/components/icons';
import supabase from '@/lib/supabase';
import type { Lot } from '@/lib/types';
import { mutate } from 'swr';

export function EditLotDrawer({ lot, onClose }: { lot: Lot, onClose: () => void }) {
  const [availableSubBatches, setAvailableSubBatches] = useState<any[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For adding unit
  const [newUnitSerial, setNewUnitSerial] = useState('');
  const [newUnitSubBatch, setNewUnitSubBatch] = useState('');

  // Fetch eligible sub-batches
  useEffect(() => {
    async function fetchEligible() {
      const { data, error } = await supabase
        .from('batches')
        .select('id, batch_number, materials(name), lot_sub_batches(lot_id)')
        .eq('status', 'Released')
        .not('parent_batch_id', 'is', null);

      if (error) {
        setError('Failed to fetch eligible sub-batches');
        setLoadingEligible(false);
        return;
      }
      
      // Enforce one-lot-per-sub-batch: keep only those without a lot_sub_batches entry
      const eligible = (data ?? []).filter((b: any) => !b.lot_sub_batches || b.lot_sub_batches.length === 0);
      setAvailableSubBatches(eligible);
      setLoadingEligible(false);
    }
    fetchEligible();
  }, []);

  async function refreshLot() {
    await mutate(['lot', lot.id]);
  }

  async function handleAddSubBatch(subBatchId: string) {
    if (!subBatchId) return;
    setSubmitting(true);
    setError(null);
    const { error: dbError } = await supabase.from('lot_sub_batches').insert({
      lot_id: lot.id,
      sub_batch_id: subBatchId
    });
    if (dbError) {
      setError(dbError.message);
    } else {
      setAvailableSubBatches(prev => prev.filter(sb => sb.id !== subBatchId));
      await refreshLot();
    }
    setSubmitting(false);
  }

  async function handleRemoveSubBatch(subBatchId: string) {
    // Cannot remove if units exist for this sub-batch
    if (lot.units?.some(u => u.sub_batch_id === subBatchId)) {
      setError('Cannot remove sub-batch: it has units assigned to it. Remove units first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: dbError } = await supabase.from('lot_sub_batches')
      .delete()
      .eq('lot_id', lot.id)
      .eq('sub_batch_id', subBatchId);
    if (dbError) {
      setError(dbError.message);
    } else {
      await refreshLot();
      // Re-fetch eligible sub-batches to make it available again
      const { data } = await supabase
        .from('batches')
        .select('id, batch_number, materials(name)')
        .eq('id', subBatchId)
        .single();
      if (data) setAvailableSubBatches(prev => [...prev, { ...data, lot_sub_batches: [] }]);
    }
    setSubmitting(false);
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!newUnitSerial.trim() || !newUnitSubBatch) return;
    setSubmitting(true);
    setError(null);
    const { error: dbError } = await supabase.from('units').insert({
      serial: newUnitSerial.trim(),
      lot_id: lot.id,
      sub_batch_id: newUnitSubBatch,
    });
    if (dbError) {
      setError(dbError.message);
    } else {
      setNewUnitSerial('');
      setNewUnitSubBatch('');
      await refreshLot();
    }
    setSubmitting(false);
  }

  async function handleRemoveUnit(serial: string) {
    setSubmitting(true);
    setError(null);
    const { error: dbError } = await supabase.from('units')
      .delete()
      .eq('serial', serial);
    if (dbError) {
      setError(dbError.message);
    } else {
      await refreshLot();
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={submitting ? undefined : onClose} />
      
      <div className="relative w-[480px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a2a] shrink-0 sticky top-0 bg-[#0e0e0e] z-10">
          <div>
            <div className="text-[15px] font-semibold text-[#f5f5f5]">Edit Lot Composition</div>
            <div className="text-[11.5px] font-mono text-[#5a5a5a]">{lot.lot_number}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-8">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2.5 text-[12px] text-[#ef4444]">
              <IconAlert size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sub-batches Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#f5f5f5] border-b border-[#2a2a2a] pb-2">Sub-Batches</h3>
            
            <div className="flex flex-col gap-2">
              {lot.lot_sub_batches.length === 0 ? (
                <div className="text-[12px] text-[#5a5a5a]">No sub-batches assigned.</div>
              ) : (
                lot.lot_sub_batches.map(({ sub_batch_id, sub_batch }) => (
                  <div key={sub_batch_id} className="flex items-center justify-between bg-[#111111] border border-[#2a2a2a] p-2.5 rounded-md">
                    <span className="font-mono text-[12px] text-[#93c5fd]">{sub_batch?.batch_number ?? 'Unknown'}</span>
                    <button 
                      onClick={() => handleRemoveSubBatch(sub_batch_id)}
                      disabled={submitting}
                      className="text-[#888888] hover:text-red-400 p-1 disabled:opacity-50"
                      title="Remove sub-batch"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2 mt-2 p-3 bg-[#111] border border-[#2a2a2a] rounded-md">
              <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Add Sub-Batch</label>
              {loadingEligible ? (
                <div className="text-[12px] text-[#5a5a5a]">Loading eligible sub-batches...</div>
              ) : availableSubBatches.length === 0 ? (
                <div className="text-[12px] text-[#5a5a5a]">No unassigned released sub-batches found.</div>
              ) : (
                <div className="flex gap-2">
                  <select 
                    className="flex-1 h-8 px-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#f5f5f5] outline-none"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddSubBatch(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    disabled={submitting}
                    defaultValue=""
                  >
                    <option value="" disabled>Select a sub-batch to add...</option>
                    {availableSubBatches.map(sb => {
                       const catName = Array.isArray(sb.materials) ? sb.materials[0]?.name : sb.materials?.name ?? 'Uncategorized';
                       return (
                         <option key={sb.id} value={sb.id}>{sb.batch_number} ({catName})</option>
                       );
                    })}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Units Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#f5f5f5] border-b border-[#2a2a2a] pb-2">Units</h3>
            
            <div className="flex flex-col gap-2">
              {(lot.units ?? []).length === 0 ? (
                <div className="text-[12px] text-[#5a5a5a]">No units serialized.</div>
              ) : (
                (lot.units ?? []).map(u => (
                  <div key={u.serial} className="flex items-center justify-between bg-[#111111] border border-[#2a2a2a] p-2.5 rounded-md">
                    <div className="flex flex-col">
                      <span className="font-mono text-[12px] text-[#f5f5f5]">{u.serial}</span>
                      <span className="font-mono text-[10px] text-[#5a5a5a]">From: {u.sub_batch?.batch_number ?? 'Unknown'}</span>
                    </div>
                    <button 
                      onClick={() => handleRemoveUnit(u.serial)}
                      disabled={submitting}
                      className="text-[#888888] hover:text-red-400 p-1 disabled:opacity-50"
                      title="Remove unit"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddUnit} className="flex flex-col gap-3 mt-2 p-3 bg-[#111] border border-[#2a2a2a] rounded-md">
              <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Add Unit</label>
              
              <select 
                value={newUnitSubBatch}
                onChange={e => setNewUnitSubBatch(e.target.value)}
                required
                disabled={submitting || lot.lot_sub_batches.length === 0}
                className="h-8 px-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#f5f5f5] outline-none disabled:opacity-50"
              >
                <option value="" disabled>Select source sub-batch...</option>
                {lot.lot_sub_batches.map(({ sub_batch_id, sub_batch }) => (
                  <option key={sub_batch_id} value={sub_batch_id}>{sub_batch?.batch_number ?? 'Unknown'}</option>
                ))}
              </select>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUnitSerial}
                  onChange={e => setNewUnitSerial(e.target.value)}
                  placeholder="New serial number"
                  required
                  disabled={submitting || lot.lot_sub_batches.length === 0}
                  className="flex-1 h-8 px-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none disabled:opacity-50"
                />
                <button 
                  type="submit"
                  disabled={submitting || lot.lot_sub_batches.length === 0}
                  className="h-8 px-3 rounded-md bg-[#22c55e] text-black text-[11px] font-semibold disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

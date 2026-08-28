'use client';

import { useState, useMemo } from 'react';
import { IconClose, IconAlert, IconCheck } from '@/components/icons';
import type { Lot, SubBatch } from '@/lib/types';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface GenerateLotPanelProps {
  existingLots: Lot[];
  availableSubBatches: SubBatch[];
  onClose: () => void;
  onGenerated: (lot: Lot) => void;
}

const MATERIAL_ORDER = [
  'Cathode Electrode',
  'Anode Electrode',
  'Electrolyte',
  'Separator',
  'Casing',
];

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

const inputCls =
  'h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] ' +
  'placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors w-full';

export function GenerateLotPanel({
  existingLots,
  availableSubBatches,
  onClose,
  onGenerated,
}: GenerateLotPanelProps) {
  const { user } = useAuth();
  const [batteryType, setBatteryType]       = useState('');
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [unitCount, setUnitCount]           = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes]                   = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState<string | null>(null);

  const ymd = useMemo(() => todayYMD(), []);

  // Group available sub-batches by material type
  const grouped = useMemo(() => { 
    const map: Record<string, SubBatch[]> = {};
    for (const sb of availableSubBatches) {
      const key = sb.category ?? 'Uncategorized';
      (map[key] ??= []).push(sb);
    }
    return map;
  }, [availableSubBatches]);

  // Live selection analysis
  const selectedSubBatches = availableSubBatches.filter(sb => selectedIds.has(sb.id));
  const selectedCategories = new Set(selectedSubBatches.map(sb => sb.category ?? 'Uncategorized'));
  const missingTypes = MATERIAL_ORDER.filter(t => !selectedCategories.has(t));
  const allCovered = missingTypes.length === 0;

  // Auto-generated lot ID
  const lotId = useMemo(() => {
    const prefix = `L-${ymd}-`;
    const maxNum = existingLots
      .filter(l => l.id.startsWith(prefix))
      .reduce((max, l) => {
        const n = parseInt(l.id.split('-')[2]);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  }, [existingLots, ymd]);

  // Starting serial number for this lot
  const serialStart = useMemo(() => {
    const prefix = `U-${ymd}-`;
    const max = existingLots
      .flatMap(l => l.units ?? [])
      .filter(u => u.serial.startsWith(prefix))
      .reduce((m, u) => {
        const n = parseInt(u.serial.split('-')[2]);
        return isNaN(n) ? m : Math.max(m, n);
      }, 0); 
    return max + 1;
  }, [existingLots, ymd]);

  const count = Math.max(0, parseInt(unitCount) || 0);

  const serialPreview = useMemo(
    () => Array.from({ length: Math.min(count, 3) }, (_, i) => 
      `U-${ymd}-${String(serialStart + i).padStart(3, '0')}`
    ),
    [count, serialStart, ymd]
  );

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0 || count < 1) return;

    // Dominant category — most-represented; tie-break by MATERIAL_ORDER
    const catCounts: Record<string, number> = {};
    for (const sb of selectedSubBatches) {
      const cat = sb.category ?? 'Uncategorized';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    let dominantCat = 'Cathode Electrode';
    let maxCount = 0;
    for (const [cat, n] of Object.entries(catCounts)) {
      const beats = n > maxCount ||
        (n === maxCount && MATERIAL_ORDER.indexOf(cat) < MATERIAL_ORDER.indexOf(dominantCat));
      if (beats) { maxCount = n; dominantCat = cat; }
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data: newLot, error } = await supabase.rpc('generate_lot', {
        p_lot_number:       lotId,
        p_category:         dominantCat,
        p_battery_type:     batteryType.trim() || null,
        p_storage_location: storageLocation.trim() || null,
        p_notes:            notes.trim() || null,
        p_created_by:       user?.id ?? null,
        p_sub_batch_ids:    Array.from(selectedIds),
        p_unit_serials:     Array.from({ length: count }, (_, i) =>
          `U-${ymd}-${String(serialStart + i).padStart(3, '0')}`
        ),
      });

      if (error) {
        setSubmitError(error.message ?? 'Failed to generate lot. Please try again.');
        return;
      }

      // generate_lot returns a flat lots row — reconstruct the nested arrays
      // so the parent page can render lot_sub_batches and units immediately.
      const enrichedLot = {
        ...(newLot as any),
        lot_sub_batches: Array.from(selectedIds).map(sid => ({ sub_batch_id: sid })),
        units: Array.from({ length: count }, (_, i) => ({
          serial: `U-${ymd}-${String(serialStart + i).padStart(3, '0')}`,
          lot_id: (newLot as any).id,
          sub_batch_id: Array.from(selectedIds)[i % selectedIds.size],
          created_at: new Date().toISOString(),
        })),
      } as unknown as Lot;

      onGenerated(enrichedLot);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={submitting ? undefined : onClose} />

      <div className="w-[520px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a2a]">
          <div className="text-[15px] font-semibold text-[#f5f5f5]">Generate Lot</div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Form */}
        <form id="glf" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* a. Battery Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Battery Type <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              value={batteryType}
              onChange={e => setBatteryType(e.target.value)}
              placeholder="e.g. Flint Cell Gen-2"
              required
              className={inputCls}
            />
          </div>

          {/* b. Source sub-batches */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Source Sub-Batches <span className="text-[#ef4444]">*</span>
            </label>

            {availableSubBatches.length === 0 ? (
              <div className="rounded-lg border border-[#2a2a2a] px-4 py-6 text-center text-[12px] font-mono text-[#5a5a5a]">
                No Released unassigned sub-batches available.
              </div>
            ) : (
              <div className="rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] overflow-hidden max-h-56 overflow-y-auto divide-y divide-[#1a1a1a]">
                {MATERIAL_ORDER.map(matType => {
                  const subs = grouped[matType];
                  if (!subs?.length) return null;
                  return (
                    <div key={matType}>
                      <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] bg-[#111111] sticky top-0">
                        {matType}
                      </div>
                      {subs.map(sb => (
                        <label
                          key={sb.id}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#141414] transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(sb.id)}
                            onChange={() => toggleId(sb.id)}
                            className="w-3.5 h-3.5 rounded accent-[#22c55e] shrink-0"
                          />
                          <span className="font-mono text-[11.5px] text-[#93c5fd] w-44 shrink-0 truncate">{sb.batch_number ?? 'ID not available'}</span>
                          <span className="font-mono text-[11.5px] text-[#888888] w-16 shrink-0">{sb.qty}</span>
                          <span className="text-[11.5px] text-[#5a5a5a] truncate">{sb.machine}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Live summary */}
            {selectedIds.size > 0 && (
              <div className="flex flex-col gap-1 mt-0.5">
                <span className="text-[11.5px] text-[#888888]">
                  Selected:{' '}
                  <span className="text-[#f5f5f5] font-mono">{selectedIds.size}</span>{' '}
                  sub-batch{selectedIds.size !== 1 ? 'es' : ''} across{' '}
                  <span className="text-[#f5f5f5] font-mono">{selectedCategories.size}</span>{' '}
                  material type{selectedCategories.size !== 1 ? 's' : ''}
                </span>
                {allCovered ? (
                  <div className="flex items-center gap-1.5 text-[11.5px] text-[#22c55e]">
                    <IconCheck size={12} />
                    <span>All material streams covered</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: '#F59E0B' }}>
                    <IconAlert size={12} />
                    <span>Missing: {missingTypes.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* c. Unit Count */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Number of Battery Units <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="number"
              value={unitCount}
              onChange={e => setUnitCount(e.target.value)}
              placeholder="e.g. 10"
              min="1"
              step="1"
              required
              className={inputCls}
            />
            <span className="text-[10.5px] font-mono text-[#5a5a5a]">Each unit will receive a unique serial</span>
          </div>

          {/* d. Storage Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Storage Location</label>
            <input
              type="text"
              value={storageLocation}
              onChange={e => setStorageLocation(e.target.value)}
              placeholder="e.g. WH-1, Rack B"
              className={inputCls}
            />
          </div>

          {/* e. Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Assembly notes, inspection ref, QC hold info..."
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors resize-none"
            />
          </div>

          {/* Auto-generated preview */}
          <div className="flex flex-col gap-3 rounded-lg border border-[#2a2a2a] bg-[#141414] px-4 py-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
              Auto-Generated Preview
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline gap-3">
                <span className="text-[10.5px] font-mono text-[#5a5a5a] w-16 shrink-0">Lot ID</span>
                <span className="font-mono text-[12px] text-[#93c5fd]">{lotId}</span>
              </div>
              {count > 0 && (
                <div className="flex items-start gap-3">
                  <span className="text-[10.5px] font-mono text-[#5a5a5a] w-16 shrink-0 mt-0.5">Serials</span>
                  <div className="flex flex-col gap-0.5">
                    {serialPreview.map(s => (
                      <span key={s} className="font-mono text-[11.5px] text-[#888888]">{s}</span>
                    ))}
                    {count > 3 && (
                      <span className="font-mono text-[11px] text-[#5a5a5a] mt-0.5">
                        …and {count - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              {count === 0 && (
                <div className="text-[11px] font-mono text-[#3a3a3a]">Enter unit count to preview serials</div>
              )}
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] flex flex-col gap-3">
          {submitError && (
            <div className="flex items-start gap-2 rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2.5 text-[12px] text-[#ef4444]">
              <IconAlert size={14} className="shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="glf"
              disabled={submitting}
              className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Generating…' : 'Generate Lot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

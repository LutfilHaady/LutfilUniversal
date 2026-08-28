'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { IconPlus, IconBatches, IconCheck, IconBox, IconClose } from '@/components/icons';
import { LOTS, SUB_BATCHES, type Lot, type Unit } from '@/lib/data';

const TODAY_DATE = '20260501';
const TODAY_DISPLAY = '2026-05-01';

/* ── Toast ────────────────────────────────────────────────────────────────── */
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] shadow-2xl text-[13px] text-[#f5f5f5]">
      <IconCheck size={14} className="text-[#22c55e] shrink-0" />
      {message}
    </div>
  );
}

/* ── Generate Lot Modal ───────────────────────────────────────────────────── */
function GenerateLotModal({
  lots,
  onClose,
  onGenerate,
}: {
  lots: Lot[];
  onClose: () => void;
  onGenerate: (lot: Lot) => void;
}) {
  const [batteryType, setBatteryType] = useState('');
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [unitCount, setUnitCount] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const usedIds = new Set(lots.flatMap(l => l.sourceSubBatches));
  const availableSubs = SUB_BATCHES.filter(sb => sb.status === 'Released' && !usedIds.has(sb.id));

  function toggleSub(id: string) {
    setSelectedSubs(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setErrors(p => { const n = { ...p }; delete n.subs; return n; });
  }

  function clearErr(k: string) { setErrors(p => { const n = { ...p }; delete n[k]; return n; }); }

  function validate() {
    const e: Record<string, string> = {};
    if (!batteryType.trim()) e.batteryType = 'Battery Type is required';
    if (selectedSubs.size === 0) e.subs = 'Select at least one source sub-batch';
    const count = parseInt(unitCount, 10);
    if (!unitCount || isNaN(count) || count < 1) e.unitCount = 'Unit Count must be at least 1';
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const count = parseInt(unitCount, 10);
    const subsArray = Array.from(selectedSubs);

    const todayLots = lots.filter(l => l.id.includes(TODAY_DATE));
    const lotNum = String(todayLots.length + 1).padStart(3, '0');
    const lotId = `L-${TODAY_DATE}-${lotNum}`;

    const todaySerialNums = lots
      .flatMap(l => l.units)
      .filter(u => u.serial.startsWith(`U-${TODAY_DATE}-`))
      .map(u => parseInt(u.serial.split('-').pop() ?? '0', 10));
    const nextSerial = todaySerialNums.length > 0 ? Math.max(...todaySerialNums) + 1 : 1;

    const units: Unit[] = Array.from({ length: count }, (_, i) => ({
      serial: `U-${TODAY_DATE}-${String(nextSerial + i).padStart(4, '0')}`,
      subBatchId: subsArray[i % subsArray.length],
      createdAt: `${TODAY_DISPLAY} 10:00`,
    }));

    onGenerate({
      id: lotId,
      batteryType: batteryType.trim(),
      storageLocation: storageLocation.trim() || '—',
      unitCount: count,
      sourceSubBatches: subsArray,
      createdAt: `${TODAY_DISPLAY} 10:00`,
      status: 'InProgress',
      units,
    });
  }

  const previewReady = batteryType.trim() && selectedSubs.size > 0 && parseInt(unitCount) >= 1;
  const todayLotCount = lots.filter(l => l.id.includes(TODAY_DATE)).length;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[460px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div className="text-[15px] font-semibold text-[#f5f5f5]">Generate Finished Lot</div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors">
            <IconClose size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Battery Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Battery Type <span className="text-red-400">*</span></label>
            <input
              value={batteryType}
              onChange={e => { setBatteryType(e.target.value); clearErr('batteryType'); }}
              placeholder="e.g. Flint Cell Gen-2"
              className={`h-9 px-3 rounded-md border bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none transition-colors ${errors.batteryType ? 'border-red-500' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`}
            />
            {errors.batteryType && <span className="text-[11px] text-red-400">{errors.batteryType}</span>}
          </div>

          {/* Source Sub-batches */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Source Sub-batches <span className="text-red-400">*</span>
              <span className="ml-2 normal-case tracking-normal text-[#5a5a5a] font-sans">Released · not yet assigned</span>
            </label>
            <div className={`rounded-md border bg-[#161616] overflow-hidden ${errors.subs ? 'border-red-500' : 'border-[#2a2a2a]'}`}>
              {availableSubs.length === 0 ? (
                <div className="px-4 py-3 text-[12px] text-[#5a5a5a]">No available sub-batches.</div>
              ) : (
                availableSubs.map(sb => {
                  const checked = selectedSubs.has(sb.id);
                  return (
                    <label
                      key={sb.id}
                      className="flex items-center gap-3 px-3 py-2.5 border-b border-[#1e1e1e] last:border-0 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSub(sb.id)}
                        className="accent-[#22c55e] w-3.5 h-3.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[12px] text-[#f5f5f5] truncate">{sb.id}</div>
                        <div className="text-[11px] text-[#888888]">{sb.category} · {sb.qty}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            {errors.subs && <span className="text-[11px] text-red-400">{errors.subs}</span>}
          </div>

          {/* Unit Count */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Unit Count <span className="text-red-400">*</span></label>
            <input
              type="number"
              min="1"
              value={unitCount}
              onChange={e => { setUnitCount(e.target.value); clearErr('unitCount'); }}
              placeholder="e.g. 10"
              className={`h-9 px-3 rounded-md border bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none transition-colors ${errors.unitCount ? 'border-red-500' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`}
            />
            {errors.unitCount && <span className="text-[11px] text-red-400">{errors.unitCount}</span>}
          </div>

          {/* Storage Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Storage Location</label>
            <input
              value={storageLocation}
              onChange={e => setStorageLocation(e.target.value)}
              placeholder="e.g. WH-1"
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes…"
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors resize-none"
            />
          </div>

          {/* Preview */}
          {previewReady && (
            <div className="rounded-lg border border-[#2a2a2a] bg-[#161616] p-4 flex flex-col gap-2">
              <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] mb-1">Will generate</div>
              {[
                ['Lot ID', `L-${TODAY_DATE}-${String(todayLotCount + 1).padStart(3, '0')}`],
                ['Units', `${unitCount} serialized batteries`],
                ['Streams', `${selectedSubs.size} material stream${selectedSubs.size !== 1 ? 's' : ''}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-[11.5px] text-[#888888]">{k}</span>
                  <span className="text-[11.5px] font-mono text-[#f5f5f5]">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#2a2a2a] flex items-center gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit}
            className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5">
            <IconPlus size={14} /> Generate Lot
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function LotsPage() {
  const [lots, setLots] = useState<Lot[]>(LOTS);
  const [showGenModal, setShowGenModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const totalLots = lots.length;
  const totalUnits = lots.reduce((s, l) => s + l.unitCount, 0);
  const totalSourceSubs = new Set(lots.flatMap(l => l.sourceSubBatches)).size;

  function handleGenerate(lot: Lot) {
    setLots(prev => [lot, ...prev]);
    setToast(`Lot ${lot.id} generated with ${lot.unitCount} units`);
    setShowGenModal(false);
  }

  return (
    <Shell
      title="Lots"
      headerActions={
        <button
          onClick={() => setShowGenModal(true)}
          className="h-9 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors">
          <IconPlus size={14} /> Generate Lot
        </button>
      }
    >
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Lots',         value: String(totalLots),       sub: 'across all battery types',                Icon: IconBox,     accent: '#22c55e' },
            { label: 'Units Serialized',   value: String(totalUnits),      sub: 'individual battery units',                Icon: IconCheck,   accent: '#3b82f6' },
            { label: 'Source Sub-batches', value: String(totalSourceSubs), sub: 'material streams contributing to lots',   Icon: IconBatches, accent: '#a855f7' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border border-[#2a2a2a] bg-[#111111] px-5 py-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#888888]">{k.label}</span>
                <div className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: `${k.accent}18`, border: `1px solid ${k.accent}33` }}>
                  <k.Icon size={14} style={{ color: k.accent }} />
                </div>
              </div>
              <div className="text-[34px] leading-none font-semibold font-mono num-tnum text-[#f5f5f5]">{k.value}</div>
              <div className="text-[11px] text-[#888888]">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
            <span className="text-[13px] font-semibold text-[#f5f5f5]">All Lots</span>
            <span className="text-[11px] font-mono text-[#5a5a5a]">{lots.length} lots</span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Lot ID', 'Battery Type', 'Units', 'Storage', 'Source Sub-batches', 'Created', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {lots.map(lot => (
                <tr key={lot.id} className="hover:bg-[#141414] transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/lots/${encodeURIComponent(lot.id)}`} className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors">
                      {lot.id}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-[#f5f5f5]">{lot.batteryType}</td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#f5f5f5] num-tnum">{lot.unitCount}</td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{lot.storageLocation}</td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{lot.sourceSubBatches.length}</td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{lot.createdAt}</td>
                  <td className="px-5 py-3"><StatusBadge status={lot.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/lots/${encodeURIComponent(lot.id)}`} className="text-[#5a5a5a] hover:text-[#888888] transition-colors inline-flex items-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="pt-2 pb-1 flex items-center justify-between text-[11px] font-mono text-[#5a5a5a]">
          <span>FLINT TRACEABILITY v2 · BUILD 2026.04.30</span>
          <span>SHIFT DAY · 11:42 SGT</span>
        </footer>
      </main>

      {showGenModal && (
        <GenerateLotModal
          lots={lots}
          onClose={() => setShowGenModal(false)}
          onGenerate={handleGenerate}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </Shell>
  );
}

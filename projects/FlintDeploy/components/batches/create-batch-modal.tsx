'use client';

import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { IconClose, IconDownload } from '@/components/icons';
import { exportQR } from '@/lib/utils';
import type { MainBatch } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';

interface DbMaterial {
  id: string;
  code: string;
  name: string;
}

// Category → which material codes from the DB belong to it
const CATEGORY_CONFIG = [
  { label: 'Cathode Electrode', dot: '#22c55e', codes: ['MTC1', 'MTC2', 'MTC3', 'MTC4', 'MTCR'] },
  { label: 'Anode Electrode',   dot: '#3b82f6', codes: ['MTAR'] },
  { label: 'Electrolyte',       dot: '#a855f7', codes: ['MTE1', 'MTE2', 'MTE3'] },
  { label: 'Separator',         dot: '#f59e0b', codes: ['MTSR'] },
  { label: 'Casing',            dot: '#888888', codes: ['MTPP'] },
] as const;

const UNITS = ['kg', 'rolls', 'units'] as const;
type Unit = typeof UNITS[number];

function buildBatchNumber(materialCode: string): string {
  const d = new Date();
  const yyyymmdd =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, '0')}` +
    `${String(d.getDate()).padStart(2, '0')}`;
  const nn = String(Math.floor(Math.random() * 90) + 10);
  return `${materialCode}-${yyyymmdd}-A${nn}`;
}

function auditTimestamp(): string {
  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[now.getMonth()]} ${now.getDate()} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} SGT`;
}

interface CreateBatchModalProps {
  onClose: () => void;
  onCreated: (batch: MainBatch) => void;
}

const inputCls =
  'h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] ' +
  'placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors w-full';

export function CreateBatchModal({ onClose, onCreated }: CreateBatchModalProps) {
  const { user } = useAuth();
  const [auditTime] = useState(() => auditTimestamp());

  // Materials fetched from DB
  const [allMaterials, setAllMaterials]     = useState<DbMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);

  // Form state
  const [categoryLabel, setCategoryLabel]   = useState<string>(CATEGORY_CONFIG[0].label);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [batchNumber, setBatchNumber]       = useState('—');
  const [batchName, setBatchName]           = useState('');
  const [supplier, setSupplier]             = useState('');
  const [qty, setQty]                       = useState('');
  const [unit, setUnit]                     = useState<Unit>('kg');
  const [lotRef, setLotRef]                 = useState('');
  const [notes, setNotes]                   = useState('');
  // Lab QC gate — defaults to NOT approved; an unapproved batch registers OnHold
  // until the lab clears the sample collected from the bulk material.
  const [qcApproved, setQcApproved]         = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [successBatch, setSuccessBatch]     = useState<{ batchNumber: string; created: MainBatch } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('materials')
          .select('id, code, name')
          .order('code');
        if (cancelled) return;
        if (!err && data) setAllMaterials(data as DbMaterial[]);
      } finally {
        if (!cancelled) setMaterialsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const currentCategory = CATEGORY_CONFIG.find((c) => c.label === categoryLabel)!;
  const filteredMaterials = allMaterials.filter((m) =>
    (currentCategory.codes as readonly string[]).includes(m.code),
  );
  const selectedMaterial = allMaterials.find((m) => m.id === selectedMaterialId);

  function pickCategory(label: string) {
    setCategoryLabel(label);
    setSelectedMaterialId('');
    setBatchNumber('—');
  }

  function pickMaterial(id: string, code: string) {
    setSelectedMaterialId(id);
    setBatchNumber(buildBatchNumber(code));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedMaterialId) { setError('Select a specific material.'); return; }
    if (!qty) { setError('Quantity is required.'); return; }

    setSubmitting(true);
    setError(null);

    // Lab QC gate: an unapproved batch is held until the lab clears the sample.
    const initialStatus: MainBatch['status'] = qcApproved ? 'InProgress' : 'OnHold';

    try {
      // Step 1: insert batch
      const { error: insertErr } = await supabase
        .from('batches')
        .insert({
          batch_number:      batchNumber,
          material_id:       selectedMaterialId,
          status:            initialStatus,
          current_quantity:  parseFloat(qty),
          original_quantity: parseFloat(qty),
          unit,
        });

      if (insertErr) {
        setError(insertErr.message || `DB error (${insertErr.code})`);
        setSubmitting(false);
        return;
      }

      // Step 2: fetch the created row to get its UUID
      const { data: row } = await supabase
        .from('batches')
        .select('id, batch_number, created_at')
        .eq('batch_number', batchNumber)
        .single();

      const batchId = row?.id ?? '';

      // Step 3: persist intake record — supplier/lot info for raw material traceability
      const { error: intakeError } = await supabase
        .from('batch_raw_material_intake')
        .insert({
          batch_id:         batchId,
          supplier_name:    supplier.trim() || null,
          supplier_batch_no: lotRef.trim() || null,
          date_received:    new Date().toISOString(),
          sampled_by:       user?.id ?? null,
        });

      if (intakeError) {
        setError(
          `Batch ${batchNumber} was created but the intake record failed to save: ${intakeError.message}. ` +
          `Please record the intake details manually using the batch detail page.`
        );
        setSubmitting(false);
        // Don't return — batch exists, still surface it via success screen with the warning
      }

      // Step 4: initial audit row (fire-and-forget — batch already committed)
      await supabase.from('batch_status_changes').insert({
        batch_id:    batchId,
        changed_by:  user?.id ?? null,
        from_status: initialStatus,
        to_status:   initialStatus,
        reason:      qcApproved
          ? 'Raw material intake — initial registration (lab QC approved)'
          : 'Raw material intake — On Hold pending lab QC approval',
      });

      const createdBatch: MainBatch = {
        id:               batchId,
        batch_number:     row?.batch_number ?? batchNumber,
        parent_batch_id:  null,
        material_id:      selectedMaterialId,
        status:           initialStatus,
        current_quantity: parseFloat(qty),
        original_quantity: parseFloat(qty),
        unit,
        current_location: null,
        created_at:       (row as { created_at?: string } | null)?.created_at ?? new Date().toISOString(),
        updated_at:       (row as { created_at?: string } | null)?.created_at ?? new Date().toISOString(),
        material:         selectedMaterial
          ? { name: selectedMaterial.name, code: selectedMaterial.code, type: '' }
          : null,
        intake:           { supplier_name: supplier.trim() || null, date_received: null },
        sub_batches:      [],
      };

      // Step 5: show QR success screen — operator can print/attach before closing
      setSuccessBatch({ batchNumber: row?.batch_number ?? batchNumber, created: createdBatch });
    } catch (err) {
      console.error('[CreateBatch] unexpected error', err);
      setError(err instanceof Error ? err.message : 'Unexpected error — check console');
      setSubmitting(false);
    }
  }

  // QR success screen — shown after all inserts complete
  if (successBatch) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/50" onClick={() => { onCreated(successBatch.created); onClose(); }} />
        <div className="w-[480px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">
          <div className="flex items-start justify-between px-6 py-5 border-b border-[#2a2a2a]">
            <div className="text-[15px] font-semibold text-[#f5f5f5]">Batch registered</div>
            <button type="button" onClick={() => { onCreated(successBatch.created); onClose(); }}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
            >
              <IconClose size={16} />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-10">
            {error && (
              <div className="w-full px-4 py-2.5 rounded-lg bg-[rgba(239,68,68,.12)] border border-[rgba(239,68,68,.3)] text-[12px] text-[#fca5a5] font-mono">
                {error}
              </div>
            )}
            <div className="flex flex-col items-center gap-2">
              <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#888888]">Batch ID</div>
              <div className="text-[18px] font-semibold font-mono text-[#f5f5f5]">{successBatch.batchNumber}</div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-lg flex items-center justify-center">
              <svg id="batch-qr-export" viewBox="0 0 256 290" width={256} height={290} style={{ backgroundColor: 'white' }}>
                <g transform="translate(28, 28)">
                  <QRCode value={successBatch.batchNumber} size={200} />
                </g>
                <text x="128" y="265" fontFamily="monospace" fontSize="16" fontWeight="bold" textAnchor="middle" fill="black">
                  {successBatch.batchNumber}
                </text>
              </svg>
            </div>
            <div className="w-full flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => exportQR('batch-qr-export', successBatch.batchNumber, 'svg')}
                  className="flex-1 h-9 rounded-md border border-[#2a2a2a] hover:bg-[#1a1a1a] text-[#f5f5f5] text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <IconDownload size={14} /> SVG
                </button>
                <button 
                  onClick={() => exportQR('batch-qr-export', successBatch.batchNumber, 'jpg')}
                  className="flex-1 h-9 rounded-md border border-[#2a2a2a] hover:bg-[#1a1a1a] text-[#f5f5f5] text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <IconDownload size={14} /> JPG
                </button>
              </div>
            </div>
            <div className="text-[11.5px] text-[#5a5a5a] text-center mt-2">
              Print or export this QR code and attach it to the batch container.
            </div>
          </div>
          <div className="px-6 py-4 border-t border-[#2a2a2a]">
            <button type="button" onClick={() => { onCreated(successBatch.created); onClose(); }}
              className="w-full h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[13px] font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />

      <div className="w-[480px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#2a2a2a]">
          <div className="flex flex-col gap-3 flex-1 mr-4">
            <div className="text-[15px] font-semibold text-[#f5f5f5]">Register material batch</div>
            <div className="flex flex-col gap-1">
              <div className="px-3 py-2 rounded-md bg-[#161616] border border-[#2a2a2a] font-mono text-[13px] text-[#888888]">
                {batchNumber}
              </div>
              <div className="text-[10.5px] font-mono text-[#5a5a5a]">Final ID assigned on save</div>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors shrink-0"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Form */}
        <form id="rbf" onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5"
        >
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-[rgba(239,68,68,.12)] border border-[rgba(239,68,68,.3)] text-[12px] text-[#fca5a5] font-mono">
              {error}
            </div>
          )}

          {/* a. Category */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Material Category <span className="text-[#ef4444]">*</span>
            </label>
            <div className="flex flex-col gap-1">
              {CATEGORY_CONFIG.map((c) => (
                <button key={c.label} type="button" onClick={() => pickCategory(c.label)}
                  className={
                    'flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition-colors ' +
                    (categoryLabel === c.label
                      ? 'border-[#363636] bg-[#1a1a1a]'
                      : 'border-transparent hover:border-[#2a2a2a] hover:bg-[#141414]')
                  }
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.dot }} />
                  <span className={`text-[13px] ${categoryLabel === c.label ? 'text-[#f5f5f5]' : 'text-[#888888]'}`}>
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* b. Specific Material */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Specific Material <span className="text-[#ef4444]">*</span>
            </label>
            {materialsLoading ? (
              <div className="text-[12px] text-[#5a5a5a] font-mono py-2">Loading…</div>
            ) : filteredMaterials.length === 0 ? (
              <div className="text-[12px] text-[#5a5a5a] font-mono py-2">No materials for this category</div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredMaterials.map((m) => {
                  const active = selectedMaterialId === m.id;
                  return (
                    <button key={m.id} type="button" onClick={() => pickMaterial(m.id, m.code)}
                      className={
                        'flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition-colors ' +
                        (active
                          ? 'border-[#22c55e] bg-[rgba(34,197,94,.06)]'
                          : 'border-[#2a2a2a] hover:border-[#363636] hover:bg-[#141414]')
                      }
                    >
                      <span className="text-[11px] font-mono text-[#5a5a5a] w-10 shrink-0">{m.code}</span>
                      <span className={`text-[13px] ${active ? 'text-[#f5f5f5]' : 'text-[#888888]'}`}>
                        {m.name}
                      </span>
                      {active && <span className="ml-auto text-[#22c55e] text-[11px] font-mono">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* c. Batch Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Batch Name</label>
            <input type="text" value={batchName} onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g. Cathode mix · Q2 lot 03" className={inputCls} />
          </div>

          {/* d. Supplier */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Supplier <span className="text-[#ef4444]">*</span>
            </label>
            <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)}
              placeholder="e.g. Targray Industries" required className={inputCls} />
          </div>

          {/* e. Quantity + unit */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Total Quantity <span className="text-[#ef4444]">*</span>
            </label>
            <div className="flex gap-2">
              <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
                min="0" step="0.1" placeholder="0.0" required
                className="flex-1 h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors"
              />
              <div className="flex rounded-md border border-[#2a2a2a] bg-[#161616] overflow-hidden shrink-0">
                {UNITS.map((u) => (
                  <button key={u} type="button" onClick={() => setUnit(u)}
                    className={
                      'px-3 h-9 text-[12px] font-mono transition-colors ' +
                      (unit === u ? 'bg-[#2a2a2a] text-[#f5f5f5]' : 'text-[#5a5a5a] hover:text-[#888888]')
                    }
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* f. Lot Reference */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Lot Reference</label>
            <input type="text" value={lotRef} onChange={(e) => setLotRef(e.target.value)}
              placeholder="e.g. TGR-CTH-9821-A" className={inputCls} />
            <span className="text-[10.5px] font-mono text-[#5a5a5a]">Supplier lot number</span>
          </div>

          {/* g. Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Receiving notes, COA reference, deviations…"
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors resize-none"
            />
          </div>

          {/* h. Lab QC gate */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              QC Approved from Lab? <span className="text-[#ef4444]">*</span>
            </label>
            <div className="flex rounded-md border border-[#2a2a2a] bg-[#161616] overflow-hidden">
              <button type="button" onClick={() => setQcApproved(false)}
                className={
                  'flex-1 h-9 text-[12px] font-mono transition-colors ' +
                  (!qcApproved ? 'bg-[#3a2a2a] text-[#fca5a5]' : 'text-[#5a5a5a] hover:text-[#888888]')
                }
              >
                No
              </button>
              <button type="button" onClick={() => setQcApproved(true)}
                className={
                  'flex-1 h-9 text-[12px] font-mono transition-colors ' +
                  (qcApproved ? 'bg-[rgba(34,197,94,.15)] text-[#22c55e]' : 'text-[#5a5a5a] hover:text-[#888888]')
                }
              >
                Yes
              </button>
            </div>
            <span className="text-[10.5px] font-mono text-[#5a5a5a]">
              {qcApproved
                ? 'Batch will register as In Progress.'
                : 'Batch will be placed On Hold until the lab clears the sample.'}
            </span>
          </div>

          {/* Audit */}
          <div className="flex flex-col gap-2 pt-3 border-t border-[#1a1a1a]">
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Audit</div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-[#5a5a5a]">Registered by</span>
                <span className="text-[11.5px] font-mono text-[#888888]">{user?.name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-[#5a5a5a]">Timestamp</span>
                <span className="text-[11.5px] font-mono text-[#888888]">{auditTime}</span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] flex flex-col gap-3">
          <div className="text-[10.5px] font-mono text-[#5a5a5a]">Sub-batches can be split after creation.</div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
            >
              Cancel
            </button>
            <button type="submit" form="rbf"
              disabled={submitting || !selectedMaterialId}
              className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Create Batch'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

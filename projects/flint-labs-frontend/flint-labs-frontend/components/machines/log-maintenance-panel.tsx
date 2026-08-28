'use client';

import { useState } from 'react';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { IconClose } from '@/components/icons';

// TODO: update to use the new Machine / MaintenanceEntry types from ./types once
// AddEquipmentPanel and LogMaintenancePanel are refactored to write to Supabase.
// For now, the page casts to these legacy shapes at the call site.
interface MaintenanceEntry {
  date: string;
  type: 'Preventive' | 'Corrective' | 'Calibration';
  tech: string;
  notes: string;
  reviewedBy?: string;
  approvedBy?: string;
}

interface Machine {
  code: string;
  name: string;
  process: string;
  supplier?: string;
  status: 'Active' | 'Inactive';
  lastMaint: string;
  nextDue: string;
  notes?: string;
  log: MaintenanceEntry[];
}

interface LogMaintenancePanelProps {
  machine: any;
  onClose: () => void;
  onSaved: (code: string, entry: MaintenanceEntry, nextDue?: string) => void;
}

const MAINT_TYPES = ['Preventive', 'Corrective', 'Calibration'] as const;
type MaintType = typeof MAINT_TYPES[number];

const TYPE_DOTS: Record<MaintType, string> = {
  Preventive:  '#22c55e',
  Corrective:  '#ef4444',
  Calibration: '#3b82f6',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputCls =
  'h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] ' +
  'placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors w-full';

export function LogMaintenancePanel({ machine, onClose, onSaved }: LogMaintenancePanelProps) {
  const [date, setDate]               = useState(todayISO);
  const [type, setType]               = useState<MaintType>('Preventive');
  const [performedBy, setPerformedBy] = useState<'Internal' | 'Vendor'>('Internal');
  const [vendorName, setVendorName]   = useState('');
  const [description, setDescription] = useState('');
  const [nextDue, setNextDue]         = useState('');
  const [reviewedBy, setReviewedBy]   = useState('');
  const [approvedBy, setApprovedBy]   = useState('');

  const { user }                      = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('equipment_maintenance')
        .insert({
          equipment_id:     machine.id,
          performed_by:     user.id,
          reviewed_by:      null,
          approved_by:      null,
          maintenance_date: date,
          next_due_date:    nextDue || null,
          notes:            description.trim(),
        });

      if (error) {
        setSubmitError('Could not log maintenance. Please try again.');
        return;
      }

      const entry: MaintenanceEntry = {
        date,
        type,
        tech: performedBy === 'Vendor' ? `Vendor – ${vendorName.trim()}` : 'Internal',
        notes: description.trim(),
        reviewedBy: reviewedBy.trim() || undefined,
        approvedBy: approvedBy.trim() || undefined,
      };
      onSaved(machine.code ?? machine.equipment_code, entry, nextDue || undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />

      <div className="w-[480px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#2a2a2a]">
          <div className="flex flex-col gap-0.5">
            <div className="text-[15px] font-semibold text-[#f5f5f5]">Log Maintenance</div>
            <div className="text-[11.5px] font-mono text-[#5a5a5a]">
              {machine.name} · {machine.code}
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

        {/* Form */}
        <form id="lmf" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* a. Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Date <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          {/* b. Type — radio cards */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Type <span className="text-[#ef4444]">*</span>
            </label>
            <div className="flex flex-col gap-1">
              {MAINT_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={
                    'flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition-colors ' +
                    (type === t
                      ? 'border-[#363636] bg-[#1a1a1a]'
                      : 'border-transparent hover:border-[#2a2a2a] hover:bg-[#141414]')
                  }
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_DOTS[t] }} />
                  <span className={`text-[13px] ${type === t ? 'text-[#f5f5f5]' : 'text-[#888888]'}`}>{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* c. Performed By */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Performed By <span className="text-[#ef4444]">*</span>
            </label>
            <div className="flex rounded-md border border-[#2a2a2a] bg-[#161616] overflow-hidden w-fit">
              {(['Internal', 'Vendor'] as const).map(pb => (
                <button
                  key={pb}
                  type="button"
                  onClick={() => setPerformedBy(pb)}
                  className={
                    'px-4 h-9 text-[13px] font-medium transition-colors ' +
                    (performedBy === pb ? 'bg-[#2a2a2a] text-[#f5f5f5]' : 'text-[#5a5a5a] hover:text-[#888888]')
                  }
                >
                  {pb}
                </button>
              ))}
            </div>
            {performedBy === 'Vendor' && (
              <input
                type="text"
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="Vendor name"
                required
                className={inputCls}
              />
            )}
          </div>

          {/* d. Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Description <span className="text-[#ef4444]">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe work performed..."
              required
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors resize-none"
            />
          </div>

          {/* e. Next Maintenance Due */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Next Maintenance Due</label>
            <input
              type="date"
              value={nextDue}
              onChange={e => setNextDue(e.target.value)}
              className={inputCls}
            />
            <span className="text-[10.5px] font-mono text-[#5a5a5a]">
              Leave blank to keep existing: {machine.nextDue}
            </span>
          </div>

          {/* f. Reviewed By */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Reviewed By</label>
            <input
              type="text"
              value={reviewedBy}
              onChange={e => setReviewedBy(e.target.value)}
              placeholder="Staff ID or name"
              className={inputCls}
            />
          </div>

          {/* g. Approved By */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Approved By</label>
            <input
              type="text"
              value={approvedBy}
              onChange={e => setApprovedBy(e.target.value)}
              placeholder="Staff ID or name"
              className={inputCls}
            />
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] flex flex-col gap-3">
          {submitError && (
            <div className="text-[11.5px] text-[#f87171] px-1">{submitError}</div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="lmf"
              disabled={submitting || !user}
              className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[13px] font-semibold transition-colors"
            >
              {submitting ? 'Saving…' : 'Save Log'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

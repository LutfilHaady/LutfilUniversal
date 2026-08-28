'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase';
import { IconClose } from '@/components/icons';

interface AddEquipmentPanelProps {
  onClose: () => void;
  // Called when adding a new machine
  onAdded?: (machine: any) => void;
  // Called when editing an existing machine
  onSaved?: (machine: any) => void;
  // Optional initial machine to edit (relaxed typing)
  initial?: any | null;
}

const inputCls =
  'h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] ' +
  'placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors w-full';

export function AddEquipmentPanel({ onClose, onAdded, onSaved, initial = null }: AddEquipmentPanelProps) {
  const [code, setCode]           = useState('');
  const [name, setName]           = useState('');
  const [supplier, setSupplier]   = useState('');
  const [status, setStatus]       = useState<'Active' | 'Inactive'>('Active');

  const [processes, setProcesses]                     = useState<{ id: string; name: string }[]>([]);
  const [selectedProcessId, setSelectedProcessId]     = useState('');
  const [submitError, setSubmitError]                 = useState<string | null>(null);
  const [submitting, setSubmitting]                   = useState(false);

  // Initialize from 'initial' when editing
  useEffect(() => {
    if (initial) {
      setCode(initial.equipment_code || initial.code || '');
      setName(initial.name || '');
      setSupplier(initial.supplier_info || initial.supplier || '');
      setStatus(initial.is_active === false ? 'Inactive' : 'Active');
      setSelectedProcessId(initial.process_id || '');
    }
  }, [initial]);

  useEffect(() => {
    supabase
      .from('processes')
      .select('id, name')
      .order('name')
      .then(({ data }) => setProcesses(data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const payload = {
      equipment_code: code.trim().toUpperCase(),
      name:           name.trim(),
      process_id:     selectedProcessId,
      supplier_info:  supplier.trim() || null,
      is_active:      status === 'Active',
    };

    try {
      if (initial?.id) {
        const { data: updated, error } = await supabase
          .from('equipment')
          .update(payload)
          .eq('id', initial.id)
          .select('id, equipment_code, name, is_active, supplier_info, process_id, process:processes(name, code)')
          .single();
        if (error) {
          setSubmitError(
            error.code === '23505'
              ? 'Equipment code already exists.'
              : 'Could not update equipment. Please try again.'
          );
          return;
        }
        onSaved?.({ ...updated, equipment_maintenance: initial.equipment_maintenance ?? [] });
      } else {
        const { data: newEquipment, error } = await supabase
          .from('equipment')
          .insert(payload)
          .select('id, equipment_code, name, is_active, supplier_info, process_id, process:processes(name, code)')
          .single();
        if (error) {
          setSubmitError(
            error.code === '23505'
              ? 'Equipment code already exists.'
              : 'Could not save equipment. Please try again.'
          );
          return;
        }
        onAdded?.({ ...newEquipment, equipment_maintenance: [] });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />

      <div className="w-[480px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a2a]">
          <div className="text-[15px] font-semibold text-[#f5f5f5]">{initial ? 'Edit Equipment' : 'Add Equipment'}</div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Form */}
        <form id="aef" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* a. Equipment Code */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Equipment Code <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. MIX-02"
              required
              className={inputCls}
            />
          </div>

          {/* b. Equipment Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Equipment Name <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Mixer B"
              required
              className={inputCls}
            />
          </div>

          {/* c. Process */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">
              Process <span className="text-[#ef4444]">*</span>
            </label>
            <select
              value={selectedProcessId}
              onChange={e => setSelectedProcessId(e.target.value)}
              required
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e] transition-colors"
            >
              <option value="" disabled>Select process…</option>
              {processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* d. Supplier */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Supplier</label>
            <input
              type="text"
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              placeholder="e.g. Primix Corp"
              className={inputCls}
            />
          </div>

          {/* e. Status */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Status</label>
            <div className="flex rounded-md border border-[#2a2a2a] bg-[#161616] overflow-hidden w-fit">
              {(['Active', 'Inactive'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={
                    'px-4 h-9 text-[13px] font-medium transition-colors ' +
                    (status === s ? 'bg-[#2a2a2a] text-[#f5f5f5]' : 'text-[#5a5a5a] hover:text-[#888888]')
                  }
                >
                  {s}
                </button>
              ))}
            </div>
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
              form="aef"
              disabled={submitting}
              className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[13px] font-semibold transition-colors"
            >
              {submitting ? 'Saving…' : initial ? 'Save Changes' : 'Add Equipment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

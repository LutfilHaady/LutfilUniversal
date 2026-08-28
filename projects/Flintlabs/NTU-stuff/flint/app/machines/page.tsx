'use client';
import { useState, Fragment, useRef, useEffect } from 'react';
import { Shell } from '@/components/shell';
import {
  IconPlus, IconChevronDown, IconChevronRight, IconAlert,
  IconClose, IconCheck, IconInfo,
} from '@/components/icons';

const today = new Date('2026-04-30');
function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86400000);
}

const TODAY_STR = '2026-05-01';
const PROCESSES = ['Mixing', 'Coating', 'Calendaring', 'Die Cutting', 'Cutting', 'Slitting', 'Assembly'];
const CODE_PATTERN = /^[A-Za-z]+-\d+$/;

type LogEntry = { date: string; type: string; tech: string; notes: string };
type Machine = {
  code: string; name: string; process: string; supplier: string;
  status: string; lastMaint: string; nextDue: string; log: LogEntry[];
};

const INITIAL_MACHINES: Machine[] = [
  { code: 'CLA-001', name: 'Coating Line A', process: 'Coating',     supplier: 'Hirano Tecseed', status: 'Active',   lastMaint: '2026-03-15', nextDue: '2026-05-15',
    log: [{ date: '2026-03-15', type: 'Preventive', tech: 'Vendor',    notes: 'Full service, belt replaced' }, { date: '2026-01-10', type: 'Corrective', tech: 'Internal', notes: 'Tension roller replaced' }] },
  { code: 'CLB-001', name: 'Coating Line B', process: 'Coating',     supplier: 'Hirano Tecseed', status: 'Active',   lastMaint: '2026-04-01', nextDue: '2026-06-01',
    log: [{ date: '2026-04-01', type: 'Preventive', tech: 'Vendor',    notes: 'Routine inspection' }] },
  { code: 'CAL-01',  name: 'Calendaring A',  process: 'Calendaring', supplier: 'Yuri Co.',       status: 'Active',   lastMaint: '2026-03-20', nextDue: '2026-05-04',
    log: [{ date: '2026-03-20', type: 'Preventive', tech: 'Internal',  notes: 'Roll alignment check' }] },
  { code: 'CAL-02',  name: 'Calendaring B',  process: 'Calendaring', supplier: 'Yuri Co.',       status: 'Active',   lastMaint: '2026-02-28', nextDue: '2026-04-28',
    log: [{ date: '2026-02-28', type: 'Preventive', tech: 'Internal',  notes: 'Bearing lubrication' }] },
  { code: 'SLT-01',  name: 'Slitting Line 1',process: 'Slitting',    supplier: 'Kampf GmbH',     status: 'Active',   lastMaint: '2026-04-10', nextDue: '2026-07-10',
    log: [{ date: '2026-04-10', type: 'Preventive', tech: 'Vendor',    notes: 'Blade set replaced' }] },
  { code: 'MIX-01',  name: 'Mixer A',        process: 'Mixing',      supplier: 'Primix Corp',    status: 'Inactive', lastMaint: '2026-01-05', nextDue: '2026-04-05',
    log: [{ date: '2026-01-05', type: 'Corrective', tech: 'Internal',  notes: 'Motor replaced' }] },
];

/* ── Process combobox ─────────────────────────────────────────────────────── */
function ProcessCombobox({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = PROCESSES.filter(p => p.toLowerCase().includes(value.toLowerCase()));
  const exactMatch = PROCESSES.some(p => p.toLowerCase() === value.toLowerCase());
  const showAdd = value.trim().length > 0 && !exactMatch;

  function select(v: string) { onChange(v); setOpen(false); }

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. Coating"
        className={`w-full h-9 px-3 rounded-md border bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none transition-colors ${error ? 'border-red-500' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`}
      />
      {open && (filtered.length > 0 || showAdd) && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-lg overflow-hidden">
          {filtered.map(p => (
            <button key={p} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(p)}
              className="w-full px-3 py-2 text-left text-[13px] text-[#f5f5f5] hover:bg-[#2a2a2a] transition-colors">
              {p}
            </button>
          ))}
          {showAdd && (
            <button type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(value.trim())}
              className="w-full px-3 py-2 text-left text-[13px] text-[#22c55e] hover:bg-[#2a2a2a] transition-colors border-t border-[#2a2a2a]">
              + Add &ldquo;{value.trim()}&rdquo; as new process
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Toast ────────────────────────────────────────────────────────────────── */
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] shadow-2xl text-[13px] text-[#f5f5f5]">
      <IconCheck size={14} className="text-[#22c55e] shrink-0" />
      {message}
    </div>
  );
}

/* ── Add Equipment Modal ──────────────────────────────────────────────────── */
function AddEquipmentModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Machine) => void }) {
  const [code, setCode]       = useState('');
  const [name, setName]       = useState('');
  const [process, setProcess] = useState('');
  const [supplier, setSupplier] = useState('');
  const [status, setStatus]   = useState<'Active' | 'Inactive'>('Active');
  const [notes, setNotes]     = useState('');
  const [errors, setErrors]   = useState<Record<string, string>>({});

  function clearErr(k: string) { setErrors(p => { const n = { ...p }; delete n[k]; return n; }); }

  function validate() {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = 'Equipment Code is required';
    else if (!CODE_PATTERN.test(code.trim())) e.code = 'Invalid format. Use e.g. CLA-002';
    if (!name.trim()) e.name = 'Equipment Name is required';
    if (!process.trim()) e.process = 'Process is required';
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onAdd({ code: code.trim(), name: name.trim(), process: process.trim(), supplier: supplier.trim(), status, lastMaint: '—', nextDue: '—', log: [] });
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[440px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div className="text-[15px] font-semibold text-[#f5f5f5]">Add Equipment</div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors">
            <IconClose size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Equipment Code */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Equipment Code <span className="text-red-400">*</span></label>
            <input value={code} onChange={e => { setCode(e.target.value); clearErr('code'); }} placeholder="e.g. CLA-002"
              className={`h-9 px-3 rounded-md border bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none transition-colors ${errors.code ? 'border-red-500' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`} />
            {errors.code
              ? <span className="text-[11px] text-red-400">{errors.code}</span>
              : <span className="text-[11px] text-[#5a5a5a]">Hint: {'{'+'PROCESS_CODE'+'}'}-{'{'+'NUM'+'}'} e.g. CLA-002</span>}
          </div>

          {/* Equipment Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Equipment Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => { setName(e.target.value); clearErr('name'); }} placeholder="e.g. Coating Line C"
              className={`h-9 px-3 rounded-md border bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none transition-colors ${errors.name ? 'border-red-500' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`} />
            {errors.name && <span className="text-[11px] text-red-400">{errors.name}</span>}
          </div>

          {/* Process */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Process <span className="text-red-400">*</span></label>
            <ProcessCombobox value={process} onChange={v => { setProcess(v); clearErr('process'); }} error={errors.process} />
            {errors.process && <span className="text-[11px] text-red-400">{errors.process}</span>}
            <div className="flex items-start gap-1.5 px-3 py-2 rounded-md bg-[#161616] border border-[#2a2a2a]">
              <IconInfo size={12} className="text-[#5a5a5a] mt-0.5 shrink-0" />
              <span className="text-[11px] text-[#5a5a5a]">New processes will be available for selection in future equipment and recipe forms</span>
            </div>
          </div>

          {/* Supplier */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Supplier</label>
            <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Hirano Tecseed"
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors" />
          </div>

          {/* Status toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Status</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStatus(s => s === 'Active' ? 'Inactive' : 'Active')}
                className={`relative w-10 h-5 rounded-full transition-colors ${status === 'Active' ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${status === 'Active' ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className={`text-[13px] ${status === 'Active' ? 'text-[#86efac]' : 'text-[#5a5a5a]'}`}>{status}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional notes…"
              className="px-3 py-2 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#2a2a2a] flex items-center gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit}
            className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5">
            <IconPlus size={14} /> Add Equipment
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Log Maintenance Modal ────────────────────────────────────────────────── */
function LogMaintenanceModal({ machine, onClose, onLog }: {
  machine: Machine;
  onClose: () => void;
  onLog: (code: string, entry: LogEntry, nextDue?: string) => void;
}) {
  const [date, setDate]           = useState(TODAY_STR);
  const [nextDue, setNextDue]     = useState('');
  const [type, setType]           = useState('Preventive');
  const [performedBy, setPerformedBy] = useState('');
  const [reviewedBy, setReviewedBy]   = useState('');
  const [approvedBy, setApprovedBy]   = useState('');
  const [notes, setNotes]         = useState('');
  const [errors, setErrors]       = useState<Record<string, string>>({});

  function clearErr(k: string) { setErrors(p => { const n = { ...p }; delete n[k]; return n; }); }

  function validate() {
    const e: Record<string, string> = {};
    if (!date) e.date = 'Maintenance Date is required';
    if (!performedBy.trim()) e.performedBy = 'Performed By is required';
    if (!notes.trim()) e.notes = 'Notes are required';
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onLog(machine.code, { date, type, tech: performedBy.trim(), notes: notes.trim() }, nextDue || undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[440px] bg-[#0e0e0e] border-l border-[#2a2a2a] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div>
            <div className="text-[15px] font-semibold text-[#f5f5f5]">Log Maintenance</div>
            <div className="text-[11px] text-[#888888] font-mono mt-0.5">— {machine.name}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors">
            <IconClose size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Maintenance Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Maintenance Date <span className="text-red-400">*</span></label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); clearErr('date'); }}
              className={`h-9 px-3 rounded-md border bg-[#161616] text-[13px] text-[#f5f5f5] outline-none transition-colors ${errors.date ? 'border-red-500' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`} />
            {errors.date && <span className="text-[11px] text-red-400">{errors.date}</span>}
          </div>

          {/* Next Due Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Next Due Date</label>
            <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)}
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e] transition-colors" />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Type <span className="text-red-400">*</span></label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e] transition-colors">
              <option>Preventive</option>
              <option>Corrective</option>
              <option>Emergency</option>
            </select>
          </div>

          {/* Performed By */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Performed By <span className="text-red-400">*</span></label>
            <input value={performedBy} onChange={e => { setPerformedBy(e.target.value); clearErr('performedBy'); }} placeholder="e.g. J. Tan"
              className={`h-9 px-3 rounded-md border bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none transition-colors ${errors.performedBy ? 'border-red-500' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`} />
            {errors.performedBy && <span className="text-[11px] text-red-400">{errors.performedBy}</span>}
          </div>

          {/* Reviewed By */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Reviewed By</label>
            <input value={reviewedBy} onChange={e => setReviewedBy(e.target.value)} placeholder="e.g. S. Lee"
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors" />
          </div>

          {/* Approved By */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Approved By</label>
            <input value={approvedBy} onChange={e => setApprovedBy(e.target.value)} placeholder="e.g. D. Wong"
              className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors" />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#888888]">Notes <span className="text-red-400">*</span></label>
            <textarea value={notes} onChange={e => { setNotes(e.target.value); clearErr('notes'); }}
              rows={4} placeholder="Describe what was done..."
              className={`px-3 py-2 rounded-md border bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none transition-colors resize-none ${errors.notes ? 'border-red-500' : 'border-[#2a2a2a] focus:border-[#22c55e]'}`} />
            {errors.notes && <span className="text-[11px] text-red-400">{errors.notes}</span>}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#2a2a2a] flex items-center gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit}
            className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5">
            <IconCheck size={14} /> Log Maintenance
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function MachinesPage() {
  const [machines, setMachines]     = useState<Machine[]>(INITIAL_MACHINES);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [logModalCode, setLogModalCode] = useState<string | null>(null);
  const [toast, setToast]           = useState<string | null>(null);

  function toggle(code: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  }

  function handleAddEquipment(m: Machine) {
    setMachines(prev => [...prev, m]);
    setToast(`Equipment ${m.code} added successfully`);
    setShowAddModal(false);
  }

  function handleLogMaintenance(code: string, entry: LogEntry, nextDue?: string) {
    const machineName = machines.find(m => m.code === code)?.name ?? code;
    setMachines(prev => prev.map(m => {
      if (m.code !== code) return m;
      const updatedNextDue = nextDue ?? m.nextDue;
      return { ...m, log: [entry, ...m.log], lastMaint: entry.date, nextDue: updatedNextDue };
    }));
    setToast(`Maintenance logged for ${machineName}`);
    setLogModalCode(null);
  }

  const logModalMachine = logModalCode ? machines.find(m => m.code === logModalCode) ?? null : null;

  return (
    <Shell title="Machines" subtitle="/ Equipment &amp; maintenance"
      headerActions={
        <button
          onClick={() => setShowAddModal(true)}
          className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors hover:text-[#f5f5f5]">
          <IconPlus size={14} /> Add Equipment
          <span className="ml-1 text-[10px] font-mono text-[#5a5a5a] border border-[#2a2a2a] rounded px-1">Admin</span>
        </button>
      }
    >
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">
        <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['', 'Code', 'Name', 'Process', 'Supplier', 'Status', 'Last Maint.', 'Next Due'].map(h => (
                  <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {machines.map(m => {
                const isOpen = expanded.has(m.code);
                const days = daysUntil(m.nextDue);
                const overdue = days < 0;
                const warn = days >= 0 && days <= 7;
                return (
                  <Fragment key={m.code}>
                    <tr className="hover:bg-[#141414] transition-colors cursor-pointer" onClick={() => toggle(m.code)}>
                      <td className="px-4 py-3 w-8">
                        {isOpen ? <IconChevronDown size={14} className="text-[#5a5a5a]" /> : <IconChevronRight size={14} className="text-[#5a5a5a]" />}
                      </td>
                      <td className="px-5 py-3 font-mono text-[12px] text-[#f5f5f5]">{m.code}</td>
                      <td className="px-5 py-3 text-[12.5px] font-medium text-[#f5f5f5]">{m.name}</td>
                      <td className="px-5 py-3 text-[12px] text-[#888888]">{m.process}</td>
                      <td className="px-5 py-3 text-[12px] text-[#888888]">{m.supplier}</td>
                      <td className="px-5 py-3">
                        <span className={'text-[11px] font-medium ' + (m.status === 'Active' ? 'text-[#86efac]' : 'text-[#5a5a5a]')}>{m.status}</span>
                      </td>
                      <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{m.lastMaint}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {(warn || overdue) && <IconAlert size={13} className={overdue ? 'text-red-400' : 'text-amber-400'} />}
                          <span className={'font-mono text-[12px] ' + (overdue ? 'text-red-400' : warn ? 'text-amber-400' : 'text-[#888888]')}>{m.nextDue}</span>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={m.code + '-log'} className="bg-[#0d0d0d]">
                        <td colSpan={8} className="px-10 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Maintenance Log</div>
                            <button
                              onClick={e => { e.stopPropagation(); setLogModalCode(m.code); }}
                              className="h-7 px-2.5 rounded border border-[#2a2a2a] text-[11px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors">
                              Log Maintenance
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            {m.log.length === 0
                              ? <div className="text-[11.5px] text-[#5a5a5a] px-4 py-3">No maintenance logged yet.</div>
                              : m.log.map((entry, i) => (
                                <div key={i} className="flex items-start gap-4 px-4 py-3 rounded-lg border border-[#1e1e1e] bg-[#111]">
                                  <div className="font-mono text-[11.5px] text-[#5a5a5a] w-24 shrink-0">{entry.date}</div>
                                  <div className="text-[11.5px] text-[#888888] w-20 shrink-0">{entry.type}</div>
                                  <div className="text-[11.5px] text-[#888888] w-16 shrink-0">{entry.tech}</div>
                                  <div className="text-[11.5px] text-[#f5f5f5]">{entry.notes}</div>
                                </div>
                              ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="pt-2 pb-1 text-[11px] font-mono text-[#5a5a5a]">FLINT TRACEABILITY v2 · BUILD 2026.04.30</footer>
      </main>

      {showAddModal && <AddEquipmentModal onClose={() => setShowAddModal(false)} onAdd={handleAddEquipment} />}
      {logModalMachine && <LogMaintenanceModal machine={logModalMachine} onClose={() => setLogModalCode(null)} onLog={handleLogMaintenance} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </Shell>
  );
}

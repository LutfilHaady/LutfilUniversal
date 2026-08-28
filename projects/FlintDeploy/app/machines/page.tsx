'use client';

import { useState, useEffect, useRef, Fragment, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shell } from '@/components/shell';
import { useAuth } from '@/lib/auth-context';
import { DataState } from '@/components/data-state';
import { IconPlus, IconChevronDown, IconChevronRight, IconAlert } from '@/components/icons';
import { AddEquipmentPanel } from '@/components/machines/add-equipment-panel';
import { LogMaintenancePanel } from '@/components/machines/log-maintenance-panel';
import { useMachines } from '@/lib/hooks/useMachines';
import type { Machine, MaintenanceEntry } from '@/components/machines/types';
import supabase from '@/lib/supabase';

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return null;
  return Math.ceil((ts - Date.now()) / 86400000);
}

function MachinesPageInner() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const { machines: fetchedMachines, loading, error } = useMachines();
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    if (fetchedMachines.length > 0) setMachines(fetchedMachines);
  }, [fetchedMachines]);

  const searchParams = useSearchParams();
  const autoEquipCode = searchParams.get('equipment');
  const hasAutoExpanded = useRef(false);

  const [expanded, setExpanded]         = useState<Set<string>>(new Set());
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [logPanelFor, setLogPanelFor]   = useState<Machine | null>(null);
  const [toast, setToast]               = useState<string | null>(null);
  const [editing, setEditing]           = useState<Machine | null>(null);
  const [flippingMachine, setFlippingMachine] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  // Auto-expand the machine row when navigated from a QR scan
  useEffect(() => {
    if (!autoEquipCode || hasAutoExpanded.current || machines.length === 0) return;
    const target = machines.find(m => m.equipment_code === autoEquipCode);
    if (!target) return;
    hasAutoExpanded.current = true;
    setExpanded(prev => new Set(prev).add(target.equipment_code));
  }, [machines, autoEquipCode]);

  function toggle(code: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  }

  function handleMachineAdded(machine: Machine) {
    setMachines(prev => [machine, ...prev]);
    setAddPanelOpen(false);
    setToast(`Equipment ${machine.equipment_code} added`);
  }

  function handleSaveEdited(machine: Machine) {
    setMachines(prev => prev.map(m => (m.equipment_code === machine.equipment_code ? machine : m)));
    setEditing(null);
    setToast(`Equipment ${machine.equipment_code} updated`);
  }

  async function handleDelete(machine: Machine) {
    const code = machine.equipment_code;
    if (!confirm(`Delete machine ${code}? This cannot be undone.`)) return;

    const { error } = await supabase.from('equipment').delete().eq('id', machine.id);

    if (error) {
      if (error.code === '23503') {
        setToast('Cannot delete — equipment is in use');
      } else {
        setToast(`Could not delete ${code} — ${error.message}`);
      }
      return;
    }

    setMachines(prev => prev.filter(m => m.equipment_code !== code));
    setExpanded(prev => {
      const copy = new Set(prev);
      copy.delete(code);
      return copy;
    });
    setToast(`Equipment ${code} deleted`);
  }

  function handleMaintenanceLogged(code: string, entry: MaintenanceEntry) {
    const machineName = logPanelFor?.name ?? code;
    setMachines(prev => prev.map(m => {
      if (m.equipment_code !== code) return m;
      return { ...m, equipment_maintenance: [entry, ...m.equipment_maintenance] };
    }));
    setLogPanelFor(null);
    setToast(`Maintenance logged for ${machineName}`);
  }

  return (
    <Shell
      title="Machines"
      subtitle="/ Equipment &amp; maintenance"
      headerActions={
        isAdmin ? (
          <button
            onClick={() => setAddPanelOpen(true)}
            className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors hover:text-[#f5f5f5]"
          >
            <IconPlus size={14} /> Add Equipment
            <span className="ml-1 text-[10px] font-mono text-[#5a5a5a] border border-[#2a2a2a] rounded px-1">Admin</span>
          </button>
        ) : undefined
      }
    >
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">
        <DataState loading={loading} error={error} empty={!loading && machines.length === 0} emptyMessage="No equipment found">
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
                  const isOpen    = expanded.has(m.equipment_code);
                  const nextDue   = m.equipment_maintenance[0]?.next_due_date ?? '';
                  const lastMaint = m.equipment_maintenance[0]?.maintenance_date ?? '—';
                  const days      = daysUntil(nextDue);
                  const overdue   = days !== null && days < 0;
                  const warn      = days !== null && days >= 0 && days <= 7;
                  return (
                    <Fragment key={m.equipment_code}>
                      <tr
                        className="hover:bg-[#141414] transition-colors cursor-pointer"
                        onClick={() => toggle(m.equipment_code)}
                      >
                        <td className="px-4 py-3 w-8">
                          {isOpen
                            ? <IconChevronDown  size={14} className="text-[#5a5a5a]" />
                            : <IconChevronRight size={14} className="text-[#5a5a5a]" />}
                        </td>
                        <td className="px-5 py-3 font-mono text-[12px] text-[#f5f5f5]">{m.equipment_code}</td>
                        <td className="px-5 py-3 text-[12.5px] font-medium text-[#f5f5f5]">{m.name}</td>
                        <td className="px-5 py-3 text-[12px] text-[#888888]">{m.process?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-[12px] text-[#888888]">{m.supplier_info ?? '—'}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className={'text-[11px] font-medium ' + (m.is_active ? 'text-[#86efac]' : 'text-[#5a5a5a]')}>
                              {m.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {isAdmin && (
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={m.is_active}
                                  disabled={flippingMachine.has(m.id)}
                                  onChange={async e => {
                                    if (flippingMachine.has(m.id)) return;
                                    const next = e.target.checked;
                                    setFlippingMachine(prev => new Set(prev).add(m.id));
                                    setMachines(prev => prev.map(x =>
                                      x.equipment_code === m.equipment_code ? { ...x, is_active: next } : x
                                    ));
                                    try {
                                      const { error } = await supabase
                                        .from('equipment')
                                        .update({ is_active: next })
                                        .eq('id', m.id);
                                      if (error) {
                                        setMachines(prev => prev.map(x =>
                                          x.equipment_code === m.equipment_code ? { ...x, is_active: !next } : x
                                        ));
                                        setToast(`Could not update ${m.equipment_code}`);
                                      }
                                    } finally {
                                      setFlippingMachine(prev => { const s = new Set(prev); s.delete(m.id); return s; });
                                    }
                                  }}
                                />
                                <div className="w-9 h-5 bg-[#2a2a2a] peer-checked:bg-[#22c55e] rounded-full peer-focus:ring-2 peer-focus:ring-[#22c55e] transition-colors" />
                                <div className={
                                  'absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transform transition-transform ' +
                                  (m.is_active ? 'translate-x-4' : 'translate-x-0')
                                } />
                              </label>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[12px] font-mono text-[#888888]">{lastMaint}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            {(warn || overdue) && (
                              <IconAlert size={13} className={overdue ? 'text-red-400' : 'text-amber-400'} />
                            )}
                            <span className={'font-mono text-[12px] ' + (overdue ? 'text-red-400' : warn ? 'text-amber-400' : 'text-[#888888]')}>
                              {nextDue || '—'}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={m.equipment_code + '-log'} className="bg-[#0d0d0d]">
                          <td colSpan={8} className="px-10 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                                Maintenance Log
                              </div>
                              <div className="flex items-center gap-3">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setLogPanelFor(m); }}
                                    className="h-7 px-2.5 rounded-md border border-[#2a2a2a] text-[11px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1e1e1e] transition-colors inline-flex items-center gap-1"
                                  >
                                    <IconPlus size={11} /> Log Maintenance
                                  </button>
                                )}
                                {isAdmin && (
                                  <div className="flex gap-3">
                                    <button
                                      onClick={e => { e.stopPropagation(); setEditing(m); }}
                                      className="text-[13px] px-3 py-1 rounded-md border border-[#2a2a2a] text-[#cfcfcf]"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleDelete(m); }}
                                      className="text-[13px] px-3 py-1 rounded-md border border-red-600 text-red-400 hover:bg-red-800"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              {m.equipment_maintenance.length === 0 ? (
                                <div className="text-[11.5px] text-[#5a5a5a] font-mono py-2">No entries yet.</div>
                              ) : (
                                m.equipment_maintenance.map((entry, i) => (
                                  <div key={i} className="flex items-start gap-4 px-4 py-3 rounded-lg border border-[#1e1e1e] bg-[#111]">
                                    <div className="font-mono text-[11.5px] text-[#5a5a5a] w-24 shrink-0">{entry.maintenance_date}</div>
                                    <div className="flex-1 flex flex-col gap-2">
                                      <div className="text-[11.5px] text-[#f5f5f5]">{entry.notes ?? '—'}</div>
                                      {(entry.reviewed_by || entry.approved_by) && (
                                        <div className="text-[11px] text-[#888888]">
                                          <span className="font-mono uppercase tracking-[0.07em] text-[#5a5a5a] mr-1.5">Reviewed &amp; Approved By</span>
                                          {entry.reviewed_by ?? entry.approved_by}
                                        </div>
                                      )}
                                      {Array.isArray(entry.checklist_results) && entry.checklist_results.length > 0 && (
                                        <div className="rounded-md border border-[#1a1a1a] overflow-hidden">
                                          <div className="grid grid-cols-[1fr_auto_1.4fr] gap-2 px-3 py-1.5 bg-[#141414] text-[9.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">
                                            <span>Task</span>
                                            <span className="text-center">Done</span>
                                            <span>Remarks</span>
                                          </div>
                                          <div className="divide-y divide-[#161616]">
                                            {entry.checklist_results.map((r, ri) => (
                                              <div key={ri} className="grid grid-cols-[1fr_auto_1.4fr] gap-2 items-center px-3 py-1.5">
                                                <span className="text-[11px] text-[#cfcfcf]">{r.task}</span>
                                                <span className={'text-center text-[11px] font-semibold ' + (r.completed ? 'text-[#86efac]' : 'text-[#f87171]')}>
                                                  {r.completed ? '✓' : 'N'}
                                                </span>
                                                <span className="text-[11px] text-[#888888]">{r.remarks || '—'}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
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
        </DataState>
        <footer className="pt-2 pb-1 text-[11px] font-mono text-[#5a5a5a]">FLINT TRACEABILITY v2 · BUILD 2026.04.30</footer>
      </main>

      {addPanelOpen && (
        <AddEquipmentPanel
          onClose={() => setAddPanelOpen(false)}
          onAdded={(m: any) => handleMachineAdded(m as Machine)}
        />
      )}

      {editing && (
        <AddEquipmentPanel
          onClose={() => setEditing(null)}
          initial={editing}
          onSaved={(m: any) => handleSaveEdited(m as Machine)}
        />
      )}

      {logPanelFor && (
        <LogMaintenancePanel
          machine={logPanelFor}
          onClose={() => setLogPanelFor(null)}
          onSaved={handleMaintenanceLogged}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 pl-1 pr-4 py-3 rounded-lg border border-[#2a2a2a] bg-[#111111] shadow-2xl">
          <div className="w-1 self-stretch rounded-full bg-[#22c55e]" />
          <span className="text-[13px] text-[#f5f5f5]">{toast}</span>
        </div>
      )}
    </Shell>
  );
}

export default function MachinesPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a]" />}>
      <MachinesPageInner />
    </Suspense>
  );
}

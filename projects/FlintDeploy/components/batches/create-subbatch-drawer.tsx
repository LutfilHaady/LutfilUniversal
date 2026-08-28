'use client';

import { useState, useEffect } from 'react';
import { IconClose, IconChevronDown, IconCheck, IconAlert, IconPlus } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';

// ── DB row shapes (snake_case) — mapped to camelCase view models below ──
interface DbProcess  { id: string; code: string; name: string }
interface DbEquipment { id: string; equipment_code: string; name: string }
interface DbRecipe   { id: string; name: string; recipe_number: string | null; version: string | null }
interface DbOperator { id: string; full_name: string | null; staff_code: string | null; role: { name: string } | null }

// camelCase view models
interface ProcessOption  { id: string; code: string; name: string }
interface MachineOption  { id: string; code: string; name: string }
interface RecipeOption   { id: string; label: string }
interface OperatorOption { id: string; name: string; staffCode: string | null; role: string | null }

interface SelectOption { value: string; label: string }

interface CreateSubBatchDrawerProps {
  parentId: string;            // UUID of the parent batch
  parentBatchNumber: string;   // for the audit / context line
  parentMaterialId: string;    // sub-batch inherits the parent material (material_id is NOT NULL)
  parentMaterialCode: string;  // for the sub-batch ID suffix
  parentMaterialSuffix?: string | null;  // custom suffix column; falls back to stripping MT prefix
  remaining: number;           // remaining quantity available to allocate
  unit: string;                // unit of the parent batch
  onClose: () => void;
  onCreated: () => void;       // tells the page to refetch the sub-batch list
}

function todayCompact(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, '0')}` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

// ── Custom dark dropdown ────────────────────────────────────────────────
function DrawerSelect({
  value, placeholder, options, onChange, disabled, mono,
}: {
  value: string;
  placeholder: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={
          'h-10 px-3 rounded-md bg-[#161616] border text-[13px] w-full flex items-center justify-between gap-2 transition-colors ' +
          (disabled
            ? 'border-[#2a2a2a] text-[#555] cursor-not-allowed opacity-60'
            : 'border-[#2a2a2a] hover:border-[#363636] ' + (selected ? 'text-[#e0e0e0]' : 'text-[#555]')) +
          (open ? ' border-[#22c55e]/60 ring-1 ring-[#22c55e]/30' : '')
        }
      >
        <span className={'truncate ' + (mono && selected ? 'font-mono' : '')}>{selected?.label || placeholder}</span>
        <IconChevronDown size={14} className={'shrink-0 text-[#888888] transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1.5 w-full max-h-[240px] overflow-y-auto rounded-md border border-[#363636] bg-[#161616] shadow-2xl py-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-[#5a5a5a] font-mono">No options</div>
            ) : (
              options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={
                      'w-full text-left px-3 py-2 text-[13px] flex items-center justify-between gap-2 transition-colors ' +
                      (active ? 'bg-[#22c55e]/10 text-[#f5f5f5]' : 'text-[#cfcfcf] hover:bg-[#1c1c1c]')
                    }
                  >
                    <span className={mono ? 'font-mono' : ''}>{opt.label}</span>
                    {active && <IconCheck size={13} className="text-[#22c55e] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DrawerField({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">{label}</span>
        {optional && <span className="text-[10px] text-[#5a5a5a] font-mono lowercase tracking-normal">optional</span>}
      </div>
      {children}
    </div>
  );
}

function DrawerSection({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={'px-6 py-5 flex flex-col gap-4 ' + (first ? '' : 'border-t')}
      style={first ? undefined : { borderColor: '#1f1f1f' }}
    >
      {children}
    </div>
  );
}

const drawerInputCls =
  'h-10 px-3 rounded-md bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#e0e0e0] ' +
  'placeholder:text-[#555] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-colors w-full';

export function CreateSubBatchDrawer({
  parentId,
  parentBatchNumber,
  parentMaterialId,
  parentMaterialCode,
  parentMaterialSuffix,
  remaining,
  unit,
  onClose,
  onCreated,
}: CreateSubBatchDrawerProps) {
  const { user } = useAuth();

  // Enter animation — slide in after mount.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Reference data
  const [processes, setProcesses]               = useState<ProcessOption[]>([]);
  const [processesLoading, setProcessesLoading] = useState(true);
  const [machines, setMachines]                 = useState<MachineOption[]>([]);
  const [machinesLoading, setMachinesLoading]   = useState(false);
  const [recipes, setRecipes]                   = useState<RecipeOption[]>([]);
  const [operators, setOperators]               = useState<OperatorOption[]>([]);

  // Form state
  const [processId, setProcessId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [recipeId, setRecipeId]   = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [qty, setQty]             = useState('');
  const [location, setLocation]   = useState('');
  const [notes, setNotes]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Processes (filtered by material route) + operators load once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: procData }, { data: opData }] = await Promise.all([
        supabase.rpc('get_process_route', { p_material_id: parentMaterialId }),
        supabase
          .from('users')
          .select('id, full_name, staff_code, role:roles(name)')
          .eq('is_active', true)
          .order('full_name'),
      ]);
      if (cancelled) return;
      setProcesses(
        ((procData ?? []) as { process_id: string; code: string; name: string }[]).map(
          (p) => ({ id: p.process_id, code: p.code, name: p.name }),
        ),
      );
      setOperators(
        ((opData ?? []) as unknown as DbOperator[]).map((o) => ({
          id: o.id,
          name: o.full_name ?? 'Unnamed',
          staffCode: o.staff_code,
          role: o.role?.name ?? null,
        })),
      );
      setProcessesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [parentMaterialId]);

  // Machines + recipes refetch whenever the selected process changes.
  useEffect(() => {
    if (!processId) {
      setMachines([]);
      setRecipes([]);
      return;
    }
    let cancelled = false;
    setMachinesLoading(true);
    (async () => {
      const [{ data: eqData }, { data: rcData }] = await Promise.all([
        supabase
          .from('equipment')
          .select('id, equipment_code, name')
          .eq('process_id', processId)
          .eq('is_active', true)
          .order('equipment_code'),
        supabase
          .from('recipes')
          .select('id, name, recipe_number, version')
          .eq('process_id', processId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setMachines(((eqData ?? []) as DbEquipment[]).map((m) => ({ id: m.id, code: m.equipment_code, name: m.name })));
      setRecipes(
        ((rcData ?? []) as DbRecipe[]).map((r) => ({
          id: r.id,
          label: `${r.name}${r.version ? ` · v${r.version}` : ''}${r.recipe_number ? ` (${r.recipe_number})` : ''}`,
        })),
      );
      setMachinesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [processId]);

  const selectedProcess = processes.find((p) => p.id === processId) ?? null;
  const qtyNum = qty === '' ? null : parseFloat(qty);
  const hasQty = qtyNum != null && !Number.isNaN(qtyNum) && qtyNum > 0;
  const overAllocated = hasQty && (qtyNum as number) > remaining;
  const idSuffix = parentMaterialSuffix
    ? `-${parentMaterialSuffix}`
    : parentMaterialCode
    ? `-${parentMaterialCode.replace(/^MT/, '')}`
    : '';
  const previewId = selectedProcess ? `${selectedProcess.code}-${todayCompact()}-AXX${idSuffix}` : null;
  const canSubmit = !!processId && hasQty && !overAllocated && !submitting;

  const remainingRounded = Math.round(remaining * 100) / 100;

  // Options for the custom dropdowns.
  const processOptions: SelectOption[] = processes.map((p) => ({ value: p.id, label: p.name }));
  const machineOptions: SelectOption[] = machines.map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }));
  const recipeOptions:  SelectOption[] = recipes.map((r) => ({ value: r.id, label: r.label }));
  const operatorOptions: SelectOption[] = operators.map((o) => ({ value: o.id, label: `${o.name}${o.role ? ` · ${o.role}` : ''}` }));

  function onProcessChange(value: string) {
    setProcessId(value);
    setMachineId('');
    setRecipeId('');
  }

  async function handleSubmit() {
    if (!selectedProcess) { setError('Select a process step.'); return; }
    if (!hasQty) { setError('Enter a valid quantity.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      let attempts = 0;
      let subBatchId: string | null = null;
      let rpcErr: { message?: string; code?: string } | null = null;

      while (attempts < 3) {
        attempts++;
        const { data, error } = await supabase.rpc('create_sub_batch', {
          p_parent_id:           parentId,
          p_parent_batch_number: parentBatchNumber,
          p_process_code:        selectedProcess.code,
          p_material_id:         parentMaterialId,
          p_quantity:            qtyNum,
          p_unit:                unit,
          p_location:            location.trim() || null,
          p_changed_by:          user?.id ?? null,
        });

        if (error) {
          rpcErr = error;
          if (error.code === '23505') {
            await new Promise(resolve => setTimeout(resolve, 50 * attempts));
            continue;
          }
          break;
        } else {
          const res = data as { id: string; batch_number: string };
          subBatchId = res.id;
          rpcErr = null;
          break;
        }
      }

      if (rpcErr) {
        const msg = rpcErr.message ?? '';
        if (msg.includes('exceeds remaining')) {
          setError(`Split exceeds available quantity — ${msg.match(/remaining \(([^)]+)\)/)?.[1] ?? ''} ${unit} remaining in parent batch`);
        } else if (rpcErr.code === '23505') {
          setError('A sub-batch with that generated ID already exists — try again.');
        } else {
          setError(msg || `DB error (${rpcErr.code})`);
        }
        setSubmitting(false);
        return;
      }

      // Process run capturing machine/recipe/operator (best-effort — outside the RPC).
      const now = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const { error: runErr } = await supabase.from('process_runs').insert({
        process_id:      selectedProcess.id,
        equipment_id:    machineId || null,
        recipe_id:       recipeId || null,
        operator_id:     operatorId || user?.id,
        status:          'InProgress',
        start_date:      `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}`,
        start_time:      `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`,
        output_batch_id: subBatchId,
      });
      if (runErr) console.error('[CreateSubBatch] process_runs row failed', runErr);

      onCreated();
      onClose();
    } catch (err) {
      console.error('[CreateSubBatch] unexpected error', err);
      setError(err instanceof Error ? err.message : 'Unexpected error — check console');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Dimmed overlay */}
      <div
        onClick={onClose}
        className={'absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 ' + (shown ? 'opacity-100' : 'opacity-0')}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create sub-batch"
        className={
          'absolute right-0 top-0 h-full w-[480px] max-w-[92vw] bg-[#0a0a0a] border-l border-[#363636] flex flex-col shadow-2xl ' +
          'transition-transform duration-300 ease-out ' + (shown ? 'translate-x-0' : 'translate-x-full')
        }
      >
        {/* Fixed header */}
        <div className="shrink-0 px-6 py-4 border-b border-[#2a2a2a] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold leading-tight text-[#f5f5f5]">Create sub-batch</h2>
            <div className="mt-1 text-[12px] text-[#888888] flex items-center gap-1.5">
              <span>Parent</span>
              <span className="font-mono text-[#f5f5f5]/80 text-[12px]">{parentBatchNumber}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 -mr-1 -mt-0.5 rounded-md text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1c1c1c] flex items-center justify-center transition-colors"
            title="Close"
          >
            <IconClose size={17} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-5 px-4 py-2.5 rounded-md bg-[rgba(239,68,68,.12)] border border-[rgba(239,68,68,.3)] text-[12px] text-[#fca5a5] font-mono">
              {error}
            </div>
          )}

          {/* Section 1 — Process step + live ID preview */}
          <DrawerSection first>
            <DrawerField label="Process step">
              <DrawerSelect
                value={processId}
                placeholder={processesLoading ? 'Loading…' : 'Select process step'}
                options={processOptions}
                onChange={onProcessChange}
              />
            </DrawerField>

            <div className="rounded-md border border-[#363636] px-4 py-3.5" style={{ background: '#1a1a1a' }}>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#5a5a5a] font-medium mb-1.5">Sub-batch ID</div>
              {previewId ? (
                <div className="font-mono text-[20px] font-semibold text-[#f5f5f5] tabular-nums tracking-tight">{previewId}</div>
              ) : (
                <div className="font-mono text-[20px] font-semibold text-[#5a5a5a] tabular-nums tracking-tight">
                  <span className="text-[#3a3a3a]">····</span>-{todayCompact()}-AXX{idSuffix}
                </div>
              )}
              <div className="mt-1.5 text-[11px] text-[#888888]">System generated · Auto-assigned on creation</div>
            </div>
          </DrawerSection>

          {/* Section 2 — Quantity */}
          <DrawerSection>
            <DrawerField label="Quantity to allocate">
              <div className="flex gap-2">
                <input
                  className={drawerInputCls + ' flex-1 font-mono tabular-nums' + (overAllocated ? ' !border-red-500/60 focus:!ring-red-500/30' : '')}
                  placeholder="0"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
                <div className="shrink-0 h-10 px-3 flex items-center rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] font-mono text-[#888888]">
                  {unit}
                </div>
              </div>
            </DrawerField>
            {overAllocated ? (
              <div className="flex items-center gap-2 text-[12px] text-red-400">
                <IconAlert size={13} className="shrink-0" />
                <span>
                  Exceeds remaining — only{' '}
                  <span className="font-mono tabular-nums">{remainingRounded} {unit}</span> available
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[12px]" style={{ color: '#5fae7e' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                <span>
                  <span className="font-mono tabular-nums">{remainingRounded} {unit}</span> remaining from parent batch
                </span>
              </div>
            )}
          </DrawerSection>

          {/* Section 3 — Assignment */}
          <DrawerSection>
            <DrawerField label="Machine">
              <DrawerSelect
                value={machineId}
                placeholder={
                  !processId ? 'Select a process step first'
                  : machinesLoading ? 'Loading…'
                  : machines.length === 0 ? 'No machines configured yet'
                  : 'Select machine'
                }
                options={machineOptions}
                onChange={setMachineId}
                disabled={!processId || machinesLoading}
              />
            </DrawerField>
            <DrawerField label="Recipe" optional>
              <DrawerSelect
                value={recipeId}
                placeholder={
                  !processId ? 'Select a process step first'
                  : recipes.length === 0 ? 'No active recipes for this step'
                  : 'Select recipe (optional)'
                }
                options={recipeOptions}
                onChange={setRecipeId}
                disabled={!processId}
                mono
              />
            </DrawerField>
            <DrawerField label="Operator">
              <DrawerSelect
                value={operatorId}
                placeholder="Select operator"
                options={operatorOptions}
                onChange={setOperatorId}
              />
            </DrawerField>
            <DrawerField label="Storage location" optional>
              <input
                className={drawerInputCls}
                placeholder="e.g. Store A · Rack 2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </DrawerField>
          </DrawerSection>

          {/* Section 4 — Notes */}
          <DrawerSection>
            <DrawerField label="Notes" optional>
              <textarea
                className={drawerInputCls + ' h-24 py-2.5 resize-none leading-relaxed'}
                placeholder="Any additional notes for this sub-batch…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </DrawerField>
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] text-[#5a5a5a]">Created by</span>
              <span className="text-[11.5px] font-mono text-[#888888]">{user?.name ?? '—'}</span>
            </div>
          </DrawerSection>
        </div>

        {/* Fixed footer */}
        <div className="shrink-0 px-6 py-3.5 border-t border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between gap-4">
          <div className="text-[11.5px] text-[#888888] min-w-0">
            {hasQty ? (
              <>
                Allocating <span className={'font-mono tabular-nums ' + (overAllocated ? 'text-[#fcd34d]' : 'text-[#f5f5f5]')}>{qty} {unit}</span>
                <span className="text-[#5a5a5a]"> of </span>
                <span className="font-mono tabular-nums">{remainingRounded} {unit}</span> remaining
              </>
            ) : (
              <span className="text-[#5a5a5a]">Select a quantity to allocate</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] hover:text-[#f5f5f5] text-[12.5px] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={
                'h-9 px-4 rounded-md text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors ' +
                (canSubmit
                  ? 'bg-[#22c55e] hover:bg-emerald-500 text-black'
                  : 'bg-[#1c1c1c] border border-[#2a2a2a] text-[#5a5a5a] cursor-not-allowed')
              }
            >
              <IconPlus size={14} /> {submitting ? 'Creating…' : 'Create sub-batch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

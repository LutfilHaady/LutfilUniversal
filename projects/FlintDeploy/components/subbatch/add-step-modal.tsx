'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { MixingStep, MixingStepStatus, AddMaterialStep, MixRoundStep, QcCheckStep, AddMaterialParams, MixRoundParams, QcCheckParams } from '@/lib/types';
import { useMaterials } from '@/lib/hooks/useMaterials';
import { IconClose } from '@/components/icons';

const inputCls = 'w-full h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] text-[12.5px] text-[#f5f5f5] font-mono focus:outline-none focus:border-[#3b82f6] placeholder-[#3a3a3a]';
const labelCls = 'block text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] mb-1.5';

interface Props {
  batchId:        string;   // UUID of the parent mixing batch (for RPC)
  parentBatchId:  string;   // batch_number string (for display only)
  nextStepNumber: number;
  suggestedMaterial?: string;
  suggestedQuantity?: number;
  recipeId?: string | null;
  processId?: string | null;
  onSubmit: (steps: MixingStep[]) => void;
  onClose:  () => void;
  mode?: 'modal' | 'sheet';
}

interface MixingStepRow {
  id:           string;
  step_number:  number;
  type:         'add_material' | 'mix_round' | 'qc_check';
  label:        string;
  display_ref:  string;
  status:       string;
  params:       unknown;
  created_at:   string;
}

export function AddStepModal({ batchId, parentBatchId, nextStepNumber, suggestedMaterial, suggestedQuantity, recipeId, processId, onSubmit, onClose, mode = 'modal' }: Props) {
  // Add Material fields
  const [materialCode, setMaterialCode] = useState(suggestedMaterial ?? '');
  const [quantity, setQuantity]         = useState(suggestedQuantity != null ? String(suggestedQuantity) : '');
  const [unit, setUnit]                 = useState<'kg' | 'L' | 'g' | 'mL'>('kg');

  // Mix Round fields
  const [duration, setDuration]         = useState('');
  const [temperature, setTemperature]   = useState('');
  const [pressure, setPressure]         = useState('');
  const [dispRpm, setDispRpm]           = useState('');
  const [propRpm, setPropRpm]           = useState('');

  // QC Check fields
  interface QcDef {
    id: string;
    qc_item_name: string;
    method: 'VisualManual' | 'ToolEquipment';
    acceptance_criteria_text: string;
    acceptance_criteria_min: number | null;
    acceptance_criteria_max: number | null;
  }
  const [qcDefs, setQcDefs]     = useState<QcDef[]>([]);
  const [qcValues, setQcValues] = useState<Record<string, { value: string; passed: boolean | null }>>({});

  const { materials, loading: materialsLoading } = useMaterials();
  const { user }                      = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (!processId) return;
    supabase
      .from('qc_check_definitions')
      .select('id, qc_item_name, method, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max')
      .eq('process_id', processId)
      .then(({ data }) => {
        const defs = (data ?? []) as QcDef[];
        setQcDefs(defs);
        setQcValues(Object.fromEntries(defs.map(d => [d.id, { value: '', passed: null }])));
      });
  }, [processId]);

  function computeQcPassed(def: QcDef, value: string): boolean | null {
    if (def.method === 'VisualManual') return null;
    const hasNumericBounds = def.acceptance_criteria_min != null || def.acceptance_criteria_max != null;
    if (hasNumericBounds) {
      if (value.trim() === '') return null;
      const v = Number(value);
      if (Number.isNaN(v)) return false;
      if (def.acceptance_criteria_min != null && v < def.acceptance_criteria_min) return false;
      if (def.acceptance_criteria_max != null && v > def.acceptance_criteria_max) return false;
      return true;
    }
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    const lt = def.acceptance_criteria_text.match(/^<\s*([\d.]+)/);
    if (lt) return num < parseFloat(lt[1]);
    const gt = def.acceptance_criteria_text.match(/^>\s*([\d.]+)/);
    if (gt) return num > parseFloat(gt[1]);
    return null;
  }

  const materialFilled = materialCode !== '' && quantity.trim() !== '';
  const mixRoundFilled = duration !== '' && temperature !== '' && pressure !== '' && dispRpm !== '' && propRpm !== '';
  const qcFilled = qcDefs.length > 0 && Object.values(qcValues).every(v => v.passed !== null);
  const canSubmit      = materialFilled || mixRoundFilled || qcFilled;

  async function handleSubmit() {
    if (!user || !canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);

    const uid   = user.id;
    const uname = user.name ?? '';
    const logged: MixingStep[] = [];

    async function callRpc(
      type: 'add_material' | 'mix_round' | 'qc_check',
      label: string,
      params: unknown,
    ): Promise<MixingStepRow | null> {
      try {
        const { data, error } = await supabase.rpc('log_mixing_step', {
          p_batch_id: batchId,
          p_type:     type,
          p_label:    label,
          p_params:   params,
          p_operator: uid,
        });
        if (error || !data || Array.isArray(data)) {
          setSubmitError(error?.message ?? 'Unexpected server response.');
          return null;
        }
        return data as MixingStepRow;
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'Unexpected error');
        return null;
      }
    }

    if (materialFilled) {
      const mat = materials.find((m) => m.code === materialCode);
      if (!mat) {
        setSubmitError('Invalid material selected.');
        setSubmitting(false);
        return;
      }
      const params: AddMaterialParams & { recipe_id?: string } = {
        materialCode: mat.code,
        materialName: mat.name,
        quantity:     parseFloat(quantity),
        unit,
        ...(recipeId ? { recipe_id: recipeId } : {}),
      };
      const row = await callRpc('add_material', `Add ${mat.name}`, params);
      if (!row) { setSubmitting(false); return; }
      logged.push({
        id:         row.id,
        type:       'add_material',
        stepNumber: row.step_number,
        label:      row.label,
        displayRef: row.display_ref,
        status:     row.status as MixingStepStatus,
        params:     params as AddMaterialParams,
        operator:   uname,
        timestamp:  row.created_at,
      } as AddMaterialStep);
    }

    if (mixRoundFilled) {
      const params: MixRoundParams = {
        durationMinutes:     parseFloat(duration),
        temperatureCelsius:  parseFloat(temperature),
        internalPressureBar: parseFloat(pressure),
        dispersionRpm:       parseFloat(dispRpm),
        propellerRpm:        parseFloat(propRpm),
      };
      const row = await callRpc('mix_round', 'Mix Round', params);
      if (!row) { setSubmitting(false); return; }
      logged.push({
        id:         row.id,
        type:       'mix_round',
        stepNumber: row.step_number,
        label:      row.label,
        displayRef: row.display_ref,
        status:     row.status as MixingStepStatus,
        params:     params as MixRoundParams,
        operator:   uname,
        timestamp:  row.created_at,
      } as MixRoundStep);
    }

    if (qcFilled) {
      const params: QcCheckParams = {
        checks: qcDefs.map(def => ({
          definitionId: def.id,
          itemName: def.qc_item_name,
          method: def.method,
          resultValue: qcValues[def.id].value,
          passed: qcValues[def.id].passed!,
        })),
      };
      const row = await callRpc('qc_check', 'QC Check', params);
      if (!row) { setSubmitting(false); return; }
      logged.push({
        id:         row.id,
        type:       'qc_check',
        stepNumber: row.step_number,
        label:      row.label,
        displayRef: row.display_ref,
        status:     row.status as MixingStepStatus,
        params,
        operator:   uname,
        timestamp:  row.created_at,
      } as QcCheckStep);
    }

    setSubmitting(false);
    onSubmit(logged);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      style={{ display: 'flex', alignItems: mode === 'sheet' ? 'flex-end' : 'center', justifyContent: 'center' }}
    >
      <div
        className={`border border-[#2a2a2a] bg-[#111111] shadow-2xl ${
          mode === 'sheet'
            ? 'w-full rounded-t-2xl'
            : 'w-[420px] rounded-xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div>
            <div className="text-[14px] font-semibold text-[#f5f5f5]">Add Mixing Step</div>
            <div className="text-[11px] font-mono text-[#5a5a5a] mt-0.5">
              Step {String(nextStepNumber).padStart(2, '0')} · {parentBatchId}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[#5a5a5a] hover:text-[#f5f5f5] transition-colors">
            <IconClose size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

          {/* Add Material section */}
          <div className="flex flex-col gap-3">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#3b82f6]">Add Material</div>
            <div>
              <label className={labelCls}>Material</label>
              <select value={materialCode} onChange={(e) => setMaterialCode(e.target.value)} disabled={materialsLoading} className={inputCls}>
                <option value="">{materialsLoading ? 'Loading materials…' : 'Select material…'}</option>
                {materials.map((m) => (
                  <option key={m.code} value={m.code}>{m.name} ({m.code})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.0"
                  className={inputCls}
                />
              </div>
              <div className="w-24">
                <label className={labelCls}>Unit</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value as AddMaterialParams['unit'])} className={inputCls}>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="mL">mL</option>
                </select>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#1e1e1e]" />

          {/* Mix Round section */}
          <div className="flex flex-col gap-3">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#a855f7]">Mix Round</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Duration (min)</label>
                <input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Temperature (°C)</label>
                <input type="number" min="0" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="25" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pressure (bar)</label>
                <input type="number" min="0" value={pressure} onChange={(e) => setPressure(e.target.value)} placeholder="1.2" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Dispersion RPM</label>
                <input type="number" min="0" value={dispRpm} onChange={(e) => setDispRpm(e.target.value)} placeholder="2500" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Propeller RPM</label>
                <input type="number" min="0" value={propRpm} onChange={(e) => setPropRpm(e.target.value)} placeholder="1200" className={inputCls} />
              </div>
            </div>
          </div>

          {qcDefs.length > 0 && (
            <>
              <div className="h-px bg-[#1e1e1e]" />
              <div className="flex flex-col gap-3">
                <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#f59e0b]">QC Check</div>
                {qcDefs.map(def => (
                  <div key={def.id} className="flex flex-col gap-2 rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12px] font-medium text-[#f5f5f5]">{def.qc_item_name}</span>
                      <span className="text-[9.5px] font-mono text-[#3a3a3a]">
                        {def.method === 'VisualManual' ? 'Visual' : 'Tool'}
                      </span>
                    </div>
                    {def.method === 'VisualManual' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setQcValues(prev => ({ ...prev, [def.id]: { value: 'pass', passed: true } }))}
                          className={`flex-1 h-8 rounded-md text-[11.5px] font-medium border transition-colors ${
                            qcValues[def.id]?.passed === true
                              ? 'bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.4)] text-[#22c55e]'
                              : 'bg-[#111] border-[#2a2a2a] text-[#888888]'
                          }`}
                        >Pass</button>
                        <button
                          type="button"
                          onClick={() => setQcValues(prev => ({ ...prev, [def.id]: { value: 'fail', passed: false } }))}
                          className={`flex-1 h-8 rounded-md text-[11.5px] font-medium border transition-colors ${
                            qcValues[def.id]?.passed === false
                              ? 'bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.4)] text-[#ef4444]'
                              : 'bg-[#111] border-[#2a2a2a] text-[#888888]'
                          }`}
                        >Fail</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Enter measured value"
                          value={qcValues[def.id]?.value ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            const computed = computeQcPassed(def, v);
                            setQcValues(prev => ({ ...prev, [def.id]: { value: v, passed: computed } }));
                          }}
                          className={inputCls}
                        />
                        {qcValues[def.id]?.value !== '' && qcValues[def.id]?.passed !== null && (
                          <span className={`text-[10px] font-mono ${qcValues[def.id]?.passed ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                            {qcValues[def.id]?.passed ? '✓ Pass' : '✗ Fail'}
                          </span>
                        )}
                        {qcValues[def.id]?.value !== '' && qcValues[def.id]?.passed === null && (
                          <div className="flex gap-2">
                            <button type="button"
                              onClick={() => setQcValues(prev => ({ ...prev, [def.id]: { ...prev[def.id], passed: true } }))}
                              className="flex-1 h-7 rounded text-[10.5px] border border-[#2a2a2a] text-[#888888] hover:text-[#22c55e]"
                            >Pass</button>
                            <button type="button"
                              onClick={() => setQcValues(prev => ({ ...prev, [def.id]: { ...prev[def.id], passed: false } }))}
                              className="flex-1 h-7 rounded text-[10.5px] border border-[#2a2a2a] text-[#888888] hover:text-[#ef4444]"
                            >Fail</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-[#1e1e1e]">
          {submitError && (
            <div className="mb-3 px-3 py-2 rounded-md bg-[rgba(239,68,68,0.08)] border border-[#ef4444]/30 text-[11.5px] text-[#f87171]">
              {submitError}
            </div>
          )}
          {!canSubmit && (
            <div className="mb-3 text-[11px] text-[#5a5a5a] text-center">
              Fill material + quantity, mix round fields, or complete QC checks to enable submit.
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[#888888] hover:text-[#f5f5f5] text-[12.5px] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !canSubmit || !user}
              className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[12.5px] font-semibold transition-colors"
            >
              {submitting ? 'Logging…' : !user ? 'Loading…' : 'Log Step'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

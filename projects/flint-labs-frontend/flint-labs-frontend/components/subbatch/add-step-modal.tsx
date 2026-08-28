'use client';

import { useState } from 'react';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { MixingStep, MixingStepType, MixingStepStatus, AddMaterialStep, MixRoundStep, AddMaterialParams, MixRoundParams } from '@/lib/types';
import { MIXING_MATERIALS } from '@/lib/data';
import { IconClose, IconChevronRight } from '@/components/icons';

const inputCls = 'w-full h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] text-[12.5px] text-[#f5f5f5] font-mono focus:outline-none focus:border-[#3b82f6] placeholder-[#3a3a3a]';
const labelCls = 'block text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] mb-1.5';

interface Props {
  batchId:        string;   // UUID of the parent mixing batch (for RPC)
  parentBatchId:  string;   // batch_number string (for display only)
  nextStepNumber: number;
  onSubmit: (step: MixingStep) => void;
  onClose:  () => void;
  mode?: 'modal' | 'sheet';
}

interface MixingStepRow {
  id:           string;
  step_number:  number;
  type:         'add_material' | 'mix_round';
  label:        string;
  display_ref:  string;
  status:       string;
  params:       unknown;
  created_at:   string;
}

type Screen = 'choose_type' | 'enter_params';

export function AddStepModal({ batchId, parentBatchId, nextStepNumber, onSubmit, onClose, mode = 'modal' }: Props) {
  const [screen, setScreen] = useState<Screen>('choose_type');
  const [type, setType]     = useState<MixingStepType | null>(null);

  const [materialCode, setMaterialCode] = useState('');
  const [quantity, setQuantity]         = useState('');
  const [unit, setUnit]                 = useState<'kg' | 'L' | 'g' | 'mL'>('kg');

  const [duration, setDuration]         = useState('');
  const [temperature, setTemperature]   = useState('');
  const [pressure, setPressure]         = useState('');
  const [dispRpm, setDispRpm]           = useState('');
  const [propRpm, setPropRpm]           = useState('');

  const { user }                      = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  function handleTypeSelect(t: MixingStepType) {
    setType(t);
    setMaterialCode(''); setQuantity(''); setUnit('kg');
    setDuration(''); setTemperature(''); setPressure('');
    setDispRpm(''); setPropRpm('');
    setScreen('enter_params');
  }

  async function handleSubmit() {
    if (!type || !user) return;
    setSubmitError(null);

    let params: AddMaterialParams | MixRoundParams;
    let label: string;

    if (type === 'add_material') {
      const mat = MIXING_MATERIALS.find((m) => m.code === materialCode);
      if (!mat || !quantity) return;
      label  = `Add ${mat.name}`;
      params = { materialCode: mat.code, materialName: mat.name, quantity: parseFloat(quantity), unit };
    } else {
      if (!duration || !temperature || !pressure || !dispRpm || !propRpm) return;
      label  = 'Mix Round';
      params = {
        durationMinutes:     parseFloat(duration),
        temperatureCelsius:  parseFloat(temperature),
        internalPressureBar: parseFloat(pressure),
        dispersionRpm:       parseFloat(dispRpm),
        propellerRpm:        parseFloat(propRpm),
      };
    }

    setSubmitting(true);
    let row: unknown = null;
    let rpcError: { message: string } | null = null;
    try {
      const { data, error } = await supabase.rpc('log_mixing_step', {
        p_batch_id: batchId,
        p_type:     type,
        p_label:    label,
        p_params:   params,
        p_operator: user.id,
      });
      row = data;
      rpcError = error;
    } catch (err) {
      rpcError = { message: err instanceof Error ? err.message : 'Unexpected error' };
    } finally {
      setSubmitting(false);
    }

    if (rpcError || !row) {
      setSubmitError(rpcError?.message ?? 'Failed to log step. Please try again.');
      return;
    }

    if (Array.isArray(row)) {
      setSubmitError('Unexpected response from server. Please try again.');
      return;
    }

    const serverRow = row as MixingStepRow;

    const step: MixingStep =
      type === 'add_material'
        ? ({
            id:          serverRow.id,
            type:        'add_material',
            stepNumber:  serverRow.step_number,
            label:       serverRow.label,
            displayRef:  serverRow.display_ref,
            status:      serverRow.status as MixingStepStatus,
            params:      params as AddMaterialParams,
            operator:    user.name ?? '',
            timestamp:   serverRow.created_at,
          } as AddMaterialStep)
        : ({
            id:          serverRow.id,
            type:        'mix_round',
            stepNumber:  serverRow.step_number,
            label:       serverRow.label,
            displayRef:  serverRow.display_ref,
            status:      serverRow.status as MixingStepStatus,
            params:      params as MixRoundParams,
            operator:    user.name ?? '',
            timestamp:   serverRow.created_at,
          } as MixRoundStep);

    onSubmit(step);
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
        <div className="px-5 py-5">

          {/* Screen 1 — choose type */}
          {screen === 'choose_type' && (
            <div className="flex flex-col gap-2">
              <div className={labelCls}>Choose step type</div>
              {([
                { type: 'add_material' as MixingStepType, title: 'Add Material', desc: 'Record an ingredient addition — material, quantity, and unit' },
                { type: 'mix_round'    as MixingStepType, title: 'Mix Round',    desc: 'Record a mixing cycle — duration, RPM, temperature, pressure' },
              ] as const).map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleTypeSelect(opt.type)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] hover:border-[#3b82f6] hover:bg-[rgba(59,130,246,0.05)] transition-colors text-left"
                >
                  <div>
                    <div className="text-[12.5px] font-medium text-[#f5f5f5]">{opt.title}</div>
                    <div className="text-[11px] text-[#888888] mt-0.5">{opt.desc}</div>
                  </div>
                  <IconChevronRight size={14} className="text-[#5a5a5a] shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Screen 2a — add_material params */}
          {screen === 'enter_params' && type === 'add_material' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Material</label>
                <select value={materialCode} onChange={(e) => setMaterialCode(e.target.value)} className={inputCls}>
                  <option value="">Select material…</option>
                  {MIXING_MATERIALS.map((m) => (
                    <option key={m.code} value={m.code}>{m.name} ({m.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Quantity</label>
                  <input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0.0" className={inputCls} />
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
          )}

          {/* Screen 2b — mix_round params */}
          {screen === 'enter_params' && type === 'mix_round' && (
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
          )}
        </div>

        {/* Footer */}
        {screen === 'enter_params' && (
          <div className="px-5 pb-5">
            {submitError && (
              <div className="mb-3 px-3 py-2 rounded-md bg-[rgba(239,68,68,0.08)] border border-[#ef4444]/30 text-[11.5px] text-[#f87171]">
                {submitError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setScreen('choose_type')}
                className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[#888888] hover:text-[#f5f5f5] text-[12.5px] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 h-9 rounded-md bg-[#22c55e] hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[12.5px] font-semibold transition-colors"
              >
                {submitting ? 'Logging…' : 'Log Step'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { StepHeader } from '@/components/mobile/step-header';

type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { id: 1, title: 'Scan Sub-Batch' },
  { id: 2, title: 'Select Process Step' },
  { id: 3, title: 'Enter Parameters' },
  { id: 4, title: 'Confirm & Submit' },
  { id: 5, title: 'Done' },
] as const;

const PROCESS_STEPS = ['Mixing', 'Coating', 'Calendaring', 'Slitting', 'Drying', 'QC Inspection'];

const PARAMS: Record<string, { label: string; unit: string; placeholder: string }[]> = {
  Mixing:          [{ label: 'Mixing speed', unit: 'rpm', placeholder: '2500' }, { label: 'Duration', unit: 'min', placeholder: '45' }, { label: 'Temperature', unit: '°C', placeholder: '25' }],
  Coating:         [{ label: 'Web speed', unit: 'm/min', placeholder: '8.5' }, { label: 'Gap (front)', unit: 'µm', placeholder: '180' }, { label: 'TC-1', unit: '°C', placeholder: '82' }],
  Calendaring:     [{ label: 'Roll pressure', unit: 'MPa', placeholder: '12.0' }, { label: 'Roll temp', unit: '°C', placeholder: '85' }],
  Slitting:        [{ label: 'Width', unit: 'mm', placeholder: '58.5' }, { label: 'Speed', unit: 'm/min', placeholder: '40' }],
  Drying:          [{ label: 'Temperature', unit: '°C', placeholder: '120' }, { label: 'Duration', unit: 'min', placeholder: '60' }],
  'QC Inspection': [{ label: 'Viscosity', unit: 'mPa·s', placeholder: '4800' }, { label: 'Particle size D50', unit: 'µm', placeholder: '8.2' }],
};

const fieldBase = 'w-full h-11 px-3 rounded-lg text-[14px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-[#22c55e] transition-colors';

export default function ProcessStepPage() {
  const [step, setStep] = useState<StepId>(1);
  const [scannedId, setScannedId] = useState('');
  const [selectedStep, setSelectedStep] = useState('');
  const [operator, setOperator] = useState('L. Tan');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  function next() { if (step < 5) setStep((s) => (s + 1) as StepId); }
  function back() { if (step > 1) setStep((s) => (s - 1) as StepId); }

  const currentStepLabel = STEPS[step - 1].title;
  const params = PARAMS[selectedStep] ?? [];

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto md:max-w-[640px]">

        {/* Step header */}
        {step < 5 && (
          <StepHeader
            step={step}
            total={4}
            title={currentStepLabel}
            onBack={step > 1 ? back : undefined}
          />
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-4">

          {/* Step 1 — Scan */}
          {step === 1 && (
            <>
              <div
                className="w-full rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
                style={{ height: 200, background: '#111' }}
              >
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-[#22c55e] rounded-tl-xl" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[#22c55e] rounded-tr-xl" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[#22c55e] rounded-bl-xl" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-[#22c55e] rounded-br-xl" />
                <div className="absolute h-0.5 w-3/4 bg-[#22c55e]/60 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="text-[12px] text-[#5a5a5a] mt-8">Point at QR code</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#1e1e1e]" />
                <span className="text-[11px] text-[#5a5a5a] font-mono">or enter manually</span>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>

              <input
                value={scannedId}
                onChange={(e) => setScannedId(e.target.value)}
                placeholder="MIXC-20260430-A01-03"
                className={fieldBase}
              />

              {scannedId && (
                <div className="rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.07)] px-4 py-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-1">Found</div>
                  <div className="text-[13px] font-mono text-[#86efac]">{scannedId}</div>
                  <div className="text-[11px] text-[#888888] mt-0.5">Cathode Electrode · 12.5 kg · Coating Line A</div>
                </div>
              )}
            </>
          )}

          {/* Step 2 — Select Process Step */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {PROCESS_STEPS.map((ps) => (
                <button
                  key={ps}
                  onClick={() => setSelectedStep(ps)}
                  className={
                    'w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-colors ' +
                    (selectedStep === ps
                      ? 'border-[#22c55e] bg-[rgba(34,197,94,0.08)] text-[#86efac]'
                      : 'border-[#2a2a2a] bg-[#111] text-[#888888] hover:border-[#3a3a3a] hover:text-[#f5f5f5]')
                  }
                >
                  <span className="text-[14px] font-medium">{ps}</span>
                  {selectedStep === ps && (
                    <span className="w-4 h-4 rounded-full bg-[#22c55e] flex items-center justify-center">
                      <span className="text-[8px] text-black font-bold">✓</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 3 — Parameters */}
          {step === 3 && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Operator</label>
                <input value={operator} onChange={(e) => setOperator(e.target.value)} className={fieldBase} placeholder="Name" />
              </div>
              {params.map((p) => (
                <div key={p.label} className="flex flex-col gap-1.5">
                  <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                    {p.label} <span className="text-[#3a3a3a]">({p.unit})</span>
                  </label>
                  <input
                    type="number"
                    value={paramValues[p.label] ?? ''}
                    onChange={(e) => setParamValues((prev) => ({ ...prev, [p.label]: e.target.value }))}
                    placeholder={p.placeholder}
                    className={fieldBase}
                  />
                </div>
              ))}
            </>
          )}

          {/* Step 4 — Confirm */}
          {step === 4 && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-[#2a2a2a] bg-[#111] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#1e1e1e] text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                  Summary
                </div>
                {[
                  ['Sub-Batch', scannedId || 'MIXC-20260430-A01-03'],
                  ['Process Step', selectedStep || 'Coating'],
                  ['Operator', operator],
                  ...Object.entries(paramValues).map(([k, v]) => [k, v]),
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-2.5 border-b border-[#141414] last:border-0">
                    <span className="text-[12px] text-[#888888]">{k}</span>
                    <span className="text-[12px] font-mono text-[#f5f5f5]">{v}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)] px-4 py-3">
                <p className="text-[11.5px] text-[#fcd34d] leading-relaxed">
                  Review all values before submitting. This action will be logged to the batch record.
                </p>
              </div>
            </div>
          )}

          {/* Step 5 — Done */}
          {step === 5 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-12">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}
              >
                <span className="text-2xl text-[#22c55e]">✓</span>
              </div>
              <div className="text-center">
                <div className="text-[17px] font-semibold text-[#f5f5f5]">Logged Successfully</div>
                <div className="text-[12px] text-[#888888] mt-1">
                  {selectedStep || 'Coating'} step recorded for{' '}
                  <span className="font-mono text-[#93c5fd]">{scannedId || 'MIXC-20260430-A01-03'}</span>
                </div>
              </div>
              <button
                onClick={() => { setStep(1); setScannedId(''); setSelectedStep(''); setParamValues({}); }}
                className="mt-2 h-11 px-6 rounded-xl bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
              >
                Log Another
              </button>
            </div>
          )}
        </div>

        {/* Sticky bottom CTA */}
        {step < 5 && (
          <div className="shrink-0 px-5 py-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
            <button
              onClick={next}
              className="w-full h-12 rounded-xl font-semibold text-[15px] text-black transition-colors"
              style={{ background: '#22c55e' }}
            >
              {step === 4 ? 'Submit Log' : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

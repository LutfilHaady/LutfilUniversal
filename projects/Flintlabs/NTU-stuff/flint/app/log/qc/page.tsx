'use client';

import { useState } from 'react';
import { StepHeader } from '@/components/mobile/step-header';

type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { id: 1, title: 'Scan Sub-Batch' },
  { id: 2, title: 'Select QC Type' },
  { id: 3, title: 'Enter Results' },
  { id: 4, title: 'Verdict & Notes' },
  { id: 5, title: 'Submitted' },
] as const;

const QC_TYPES = [
  { id: 'incoming',   label: 'Incoming Material', desc: 'Raw material receiving inspection' },
  { id: 'in-process', label: 'In-Process',         desc: 'Mid-run quality check' },
  { id: 'final',      label: 'Final Inspection',   desc: 'End-of-run pass/fail' },
  { id: 'coating',    label: 'Coating QC',         desc: 'Coat weight & adhesion check' },
];

const QC_FIELDS: Record<string, { label: string; unit: string; spec: string }[]> = {
  incoming:     [{ label: 'Moisture content', unit: '%', spec: '< 0.1%' }, { label: 'Particle size D50', unit: 'µm', spec: '8–10 µm' }],
  'in-process': [{ label: 'Viscosity', unit: 'mPa·s', spec: '4500–5000' }, { label: 'Solid content', unit: '%', spec: '68–70%' }],
  final:        [{ label: 'Coat weight', unit: 'g/m²', spec: '180 ± 5' }, { label: 'Thickness', unit: 'µm', spec: '140 ± 3' }],
  coating:      [{ label: 'Coat weight', unit: 'g/m²', spec: '180 ± 5' }, { label: 'Adhesion', unit: 'N/m', spec: '> 12' }, { label: 'Defect count', unit: 'pcs/m²', spec: '< 3' }],
};

const fieldBase = 'w-full h-11 px-3 rounded-lg text-[14px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-[#22c55e] transition-colors';

export default function QCPage() {
  const [step, setStep] = useState<StepId>(1);
  const [scannedId, setScannedId] = useState('');
  const [qcType, setQcType] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<'pass' | 'fail' | 'hold' | null>(null);
  const [notes, setNotes] = useState('');

  function next() { if (step < 5) setStep((s) => (s + 1) as StepId); }
  function back() { if (step > 1) setStep((s) => (s - 1) as StepId); }

  const fields = QC_FIELDS[qcType] ?? [];

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto md:max-w-[640px]">

        {/* Step header */}
        {step < 5 && (
          <StepHeader
            step={step}
            total={4}
            title={STEPS[step - 1].title}
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
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-amber-400 rounded-tl-xl" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-400 rounded-tr-xl" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-400 rounded-bl-xl" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-amber-400 rounded-br-xl" />
                <div className="text-[12px] text-[#5a5a5a]">Point at QR code</div>
                <div className="text-[10px] text-amber-500/60 mt-1 font-mono">QC mode</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#1e1e1e]" />
                <span className="text-[11px] text-[#5a5a5a] font-mono">or enter manually</span>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>

              <input
                value={scannedId}
                onChange={(e) => setScannedId(e.target.value)}
                placeholder="e.g. MIXC-20260430-A01-03"
                className={fieldBase}
              />

              {scannedId && (
                <div className="rounded-lg border border-amber-500/30 bg-[rgba(245,158,11,0.07)] px-4 py-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-1">Found</div>
                  <div className="text-[13px] font-mono text-[#fcd34d]">{scannedId}</div>
                  <div className="text-[11px] text-[#888888] mt-0.5">Cathode Electrode · In Progress</div>
                </div>
              )}
            </>
          )}

          {/* Step 2 — QC Type */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {QC_TYPES.map((qt) => (
                <button
                  key={qt.id}
                  onClick={() => setQcType(qt.id)}
                  className={
                    'w-full flex flex-col px-4 py-3.5 rounded-xl border text-left transition-colors ' +
                    (qcType === qt.id
                      ? 'border-amber-500/50 bg-[rgba(245,158,11,0.08)]'
                      : 'border-[#2a2a2a] bg-[#111] hover:border-[#3a3a3a]')
                  }
                >
                  <span className={`text-[14px] font-medium ${qcType === qt.id ? 'text-[#fcd34d]' : 'text-[#f5f5f5]'}`}>
                    {qt.label}
                  </span>
                  <span className="text-[11px] text-[#888888] mt-0.5">{qt.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 3 — Results */}
          {step === 3 && (
            <>
              {fields.map((f) => (
                <div key={f.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                      {f.label} ({f.unit})
                    </label>
                    <span className="text-[10px] text-[#3a3a3a] font-mono">Spec: {f.spec}</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={results[f.label] ?? ''}
                    onChange={(e) => setResults((prev) => ({ ...prev, [f.label]: e.target.value }))}
                    className={fieldBase}
                    placeholder={`Enter ${f.unit}`}
                  />
                </div>
              ))}
            </>
          )}

          {/* Step 4 — Verdict */}
          {step === 4 && (
            <>
              <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Verdict</div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'pass', label: 'Pass', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.4)' },
                  { v: 'fail', label: 'Fail', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)' },
                  { v: 'hold', label: 'Hold', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setVerdict(opt.v)}
                    className="h-12 rounded-xl font-semibold text-[14px] transition-colors border"
                    style={{
                      color: opt.color,
                      background: verdict === opt.v ? opt.bg : '#111',
                      borderColor: verdict === opt.v ? opt.border : '#2a2a2a',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Optional QC notes, observations…"
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-[#22c55e] transition-colors resize-none"
                />
              </div>

              <div className="rounded-xl border border-[#2a2a2a] bg-[#111] overflow-hidden">
                <div className="px-4 py-2 border-b border-[#1e1e1e] text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                  Review
                </div>
                {[
                  ['Sub-Batch', scannedId || '—'],
                  ['QC Type', QC_TYPES.find((q) => q.id === qcType)?.label ?? '—'],
                  ...Object.entries(results),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-2 border-b border-[#141414] last:border-0">
                    <span className="text-[11.5px] text-[#888888]">{k}</span>
                    <span className="text-[11.5px] font-mono text-[#f5f5f5]">{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Step 5 — Done */}
          {step === 5 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-12">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: verdict === 'pass' ? 'rgba(34,197,94,0.15)' : verdict === 'fail' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                  border: `2px solid ${verdict === 'pass' ? 'rgba(34,197,94,0.4)' : verdict === 'fail' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
                }}
              >
                <span className="text-2xl">
                  {verdict === 'pass' ? '✓' : verdict === 'fail' ? '✗' : '⏸'}
                </span>
              </div>
              <div className="text-center">
                <div className="text-[17px] font-semibold text-[#f5f5f5]">QC Record Submitted</div>
                <div className="text-[12px] text-[#888888] mt-1">
                  Verdict:{' '}
                  <span
                    className="font-semibold"
                    style={{ color: verdict === 'pass' ? '#22c55e' : verdict === 'fail' ? '#ef4444' : '#f59e0b' }}
                  >
                    {verdict?.toUpperCase() ?? '—'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#5a5a5a] mt-0.5">{scannedId || 'MIXC-20260430-A01-03'}</div>
              </div>
              <button
                onClick={() => { setStep(1); setScannedId(''); setQcType(''); setResults({}); setVerdict(null); setNotes(''); }}
                className="mt-2 h-11 px-6 rounded-xl bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
              >
                New QC Record
              </button>
            </div>
          )}
        </div>

        {/* Sticky bottom CTA */}
        {step < 5 && (
          <div className="shrink-0 px-5 py-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
            <button
              onClick={next}
              disabled={step === 4 && verdict === null}
              className="w-full h-12 rounded-xl font-semibold text-[15px] text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#f59e0b' }}
            >
              {step === 4 ? 'Submit QC Record' : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

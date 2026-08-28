'use client';

import { useState } from 'react';
import supabase from '@/lib/supabase';
import { IconShield, IconCheck, IconClose } from '@/components/icons';

interface PasscodeWalkthroughProps {
  onClose: () => void;
}

type Step = 'intro' | 'enter' | 'confirm' | 'done';

const TIPS = [
  'Minimum 8 characters',
  'Avoid reusing your old password',
  'You can change it again any time',
];

const DOT_STEP_INDEX: Record<Step, number> = { intro: 0, enter: 1, confirm: 2, done: -1 };

const btnGreen = 'h-9 px-4 rounded-md bg-[#22c55e] text-[#0a0a0a] text-[13px] font-semibold hover:bg-[#16a34a] disabled:opacity-50 transition-colors';
const btnOutlined = 'h-9 px-4 rounded-md border border-[#2a2a2a] bg-transparent text-[#f5f5f5] text-[13px] hover:bg-[#161616] transition-colors';
const inputCls = 'h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none focus:border-[#22c55e] transition-colors w-full';
const labelCls = 'block text-[12px] text-[#888888] mb-1.5';

export function PasscodeWalkthrough({ onClose }: PasscodeWalkthroughProps) {
  const [step, setStep] = useState<Step>('intro');
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dotIndex = DOT_STEP_INDEX[step];

  function advance() {
    setError(null);
    if (step === 'intro') { setStep('enter'); return; }
    if (step === 'enter') {
      if (passcode.length < 8) { setError('Passcode must be at least 8 characters.'); return; }
      setStep('confirm');
    }
  }

  async function handleSet() {
    setError(null);
    if (passcode !== confirm) { setError('Passcodes do not match.'); return; }
    setSubmitting(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password: passcode });
      if (authErr) { setError(authErr.message); return; }
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={step === 'done' ? onClose : undefined}
      />
      <div className="relative w-[420px] rounded-xl border border-[#2a2a2a] bg-[#0e0e0e] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#2a2a2a] flex items-center gap-3">
          <IconShield size={18} className="text-[#22c55e] shrink-0" />
          <span className="text-[14px] font-semibold text-[#f5f5f5] flex-1">Login Passcode Setup</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#5a5a5a] hover:text-[#f5f5f5] transition-colors rounded"
            aria-label="Close"
          >
            <IconClose size={14} />
          </button>
        </div>

        {/* Step dots */}
        {step !== 'done' && (
          <div className="px-5 py-3 flex gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${i <= dotIndex ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]'}`}
              />
            ))}
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4 min-h-[220px] flex flex-col">
          {step === 'intro' && (
            <>
              <p className="text-[16px] font-semibold text-[#f5f5f5]">Set your login passcode</p>
              <p className="text-[13px] text-[#888888] mt-2">
                A secure passcode keeps your account protected on the factory floor.
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {TIPS.map(tip => (
                  <li key={tip} className="flex items-start gap-2 text-[13px] text-[#888888]">
                    <span className="mt-[3px] w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 'enter' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="wt-new-passcode" className={labelCls}>New passcode</label>
              <input
                id="wt-new-passcode"
                type="password"
                placeholder="Enter new passcode"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                className={inputCls}
                autoFocus
              />
              <p className={`text-[11px] mt-1.5 transition-colors ${passcode.length >= 8 ? 'text-[#22c55e]' : 'text-[#5a5a5a]'}`}>
                {passcode.length} / 8 characters minimum
              </p>
            </div>
          )}

          {step === 'confirm' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="wt-confirm-passcode" className={labelCls}>Confirm passcode</label>
              <input
                id="wt-confirm-passcode"
                type="password"
                placeholder="Confirm passcode"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </div>
          )}

          {step === 'done' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.2)] flex items-center justify-center">
                <IconCheck size={22} className="text-[#22c55e]" />
              </div>
              <p className="text-[16px] font-semibold text-[#f5f5f5]">Passcode set!</p>
              <p className="text-[13px] text-[#888888]">Your login passcode has been saved.</p>
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mb-3 rounded-md bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] px-3 py-2 text-[12px] text-[#ef4444]">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2 justify-end">
          {step === 'intro' && (
            <>
              <button className={btnOutlined} onClick={onClose}>Skip for now</button>
              <button className={btnGreen} onClick={advance}>Get started</button>
            </>
          )}
          {step === 'enter' && (
            <>
              <button className={btnOutlined} onClick={onClose}>Cancel</button>
              <button className={btnGreen} onClick={advance}>Next</button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <button className={btnOutlined} onClick={() => { setError(null); setStep('enter'); }}>Back</button>
              <button className={btnGreen} onClick={handleSet} disabled={submitting}>
                {submitting ? 'Saving…' : 'Set passcode'}
              </button>
            </>
          )}
          {step === 'done' && (
            <button className={`${btnGreen} flex-1`} onClick={onClose}>Return to profile</button>
          )}
        </div>
      </div>
    </div>
  );
}

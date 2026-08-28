'use client';

import { useState, useEffect } from 'react';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { IconCheck, IconClose } from '@/components/icons';

interface QCDef {
  id: string;
  qc_item_name: string;
  method: string;
  timing: string;
  acceptance_criteria_text: string;
}

interface Props {
  childBatchId: string;
  childBatchNumber: string;
  processId: string;
  onComplete: (allPassed: boolean) => void;
}

export function MixingQCGate({ childBatchId, childBatchNumber, processId, onComplete }: Props) {
  const { user } = useAuth();
  const [defs, setDefs] = useState<QCDef[]>([]);
  const [results, setResults] = useState<Record<string, { passed: boolean | null; text: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('qc_check_definitions')
      .select('id, qc_item_name, method, timing, acceptance_criteria_text')
      .eq('process_id', processId)
      .eq('is_active', true)
      .then(({ data }) => {
        const rows = (data ?? []) as QCDef[];
        setDefs(rows);
        const init: Record<string, { passed: boolean | null; text: string }> = {};
        rows.forEach(d => { init[d.id] = { passed: null, text: '' }; });
        setResults(init);
        setLoading(false);
      });
  }, [processId]);

  const allAnswered = defs.length > 0 && defs.every(d => results[d.id]?.passed !== null);
  const allPassed = allAnswered && defs.every(d => results[d.id]?.passed === true);

  async function handleSubmit() {
    if (!user || !allAnswered) return;
    setSubmitting(true);
    setError(null);

    const rows = defs.map(d => ({
      batch_id: childBatchId,
      qc_definition_id: d.id,
      performed_by: user.id,
      passed: results[d.id].passed,
      result_text: results[d.id].text || null,
    }));

    const { error: insertErr } = await supabase.from('qc_check_results').insert(rows);

    if (insertErr) {
      setError(insertErr.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onComplete(allPassed);
  }

  if (loading) return null;
  if (defs.length === 0) {
    onComplete(true);
    return null;
  }

  return (
    <div className="mx-5 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-amber-400">QC Check</span>
        <span className="text-[11px] font-mono text-[#888888]">{childBatchNumber}</span>
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">
        {defs.map(d => (
          <div key={d.id} className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-[#f5f5f5]">{d.qc_item_name}</div>
              <div className="text-[10.5px] text-[#5a5a5a] mt-0.5">
                {d.method === 'VisualManual' ? 'Visual/Manual' : 'Tool/Equipment'} · {d.acceptance_criteria_text}
              </div>
              <input
                type="text"
                value={results[d.id]?.text ?? ''}
                onChange={e => setResults(prev => ({ ...prev, [d.id]: { ...prev[d.id], text: e.target.value } }))}
                placeholder="Value or remarks"
                className="mt-1.5 h-8 w-full px-2.5 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] text-[12px] text-[#f5f5f5] placeholder-[#3a3a3a] outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex gap-1.5 pt-0.5 shrink-0">
              <button
                onClick={() => setResults(prev => ({ ...prev, [d.id]: { ...prev[d.id], passed: true } }))}
                className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                  results[d.id]?.passed === true
                    ? 'bg-[#22c55e]/20 border-[#22c55e]/50 text-[#22c55e]'
                    : 'border-[#2a2a2a] text-[#5a5a5a] hover:border-[#22c55e]/30'
                }`}
                aria-label={`${d.qc_item_name} pass`}
              >
                <IconCheck size={14} />
              </button>
              <button
                onClick={() => setResults(prev => ({ ...prev, [d.id]: { ...prev[d.id], passed: false } }))}
                className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                  results[d.id]?.passed === false
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'border-[#2a2a2a] text-[#5a5a5a] hover:border-red-500/30'
                }`}
                aria-label={`${d.qc_item_name} fail`}
              >
                <IconClose size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-[11.5px] text-red-400">
          {error}
        </div>
      )}

      <div className="px-4 pb-4">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="w-full h-10 rounded-lg bg-amber-500 text-black text-[13px] font-semibold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting QC…' : 'Submit QC Results'}
        </button>
      </div>
    </div>
  );
}

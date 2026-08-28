'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import type { AlertRule, AlertSeverity } from '@/lib/alerts/types';

const SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info'];
const THRESHOLD_LABEL: Record<string, string> = {
  expiry_soon: 'Lead days',
  maintenance_overdue: 'Grace days',
};

export function AlertRulesPanel() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('alert_rules')
      .select('*')
      .order('key')
      .then(({ data, error }) => {
        if (error) setError(error.message);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else setRules((data ?? []).map((r: any) => ({ ...r, threshold: r.threshold == null ? null : Number(r.threshold) })) as AlertRule[]);
        setLoading(false);
      });
  }, []);

  async function patch(id: string, fields: Partial<AlertRule>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
    const { error } = await supabase
      .from('alert_rules')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) setError(error.message);
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Alert Rules</span>
        <span className="text-[10.5px] text-[#5a5a5a]">What raises an alert · applied on next scan</span>
      </div>
      {error && <div className="px-5 py-2 text-[12px] text-[#fca5a5]">{error}</div>}
      {loading ? (
        <div className="px-5 py-6 text-[12px] text-[#5a5a5a]">Loading…</div>
      ) : (
        <div className="divide-y divide-[#1a1a1a]">
          {rules.map((r) => (
            <div key={r.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] text-[#f5f5f5]">{r.label}</div>
                <div className="text-[11px] font-mono text-[#5a5a5a]">{r.key}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {THRESHOLD_LABEL[r.key] && (
                  <label className="flex items-center gap-1.5 text-[11px] text-[#888888]">
                    {THRESHOLD_LABEL[r.key]}
                    <input
                      type="number"
                      value={r.threshold ?? 0}
                      onChange={(e) => patch(r.id, { threshold: Number(e.target.value) })}
                      className="h-8 w-16 px-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-[12px] text-[#f5f5f5] outline-none focus:border-[#22c55e]"
                    />
                  </label>
                )}
                <select
                  value={r.severity}
                  onChange={(e) => patch(r.id, { severity: e.target.value as AlertSeverity })}
                  aria-label={`${r.label} severity`}
                  className="h-8 px-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-[12px] text-[#f5f5f5] outline-none focus:border-[#22c55e]"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => patch(r.id, { enabled: !r.enabled })}
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`Toggle ${r.label}`}
                  className={'relative h-5 w-9 rounded-full transition-colors ' + (r.enabled ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]')}
                >
                  <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ' + (r.enabled ? 'left-[18px]' : 'left-0.5')} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

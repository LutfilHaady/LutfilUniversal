'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useAlerts } from '@/lib/hooks/useAlerts';
import { IconCritical, IconAlert, IconInfo } from '@/components/icons';
import type { AlertSeverity } from '@/lib/alerts/types';

type Severity = AlertSeverity;
type Tab = 'Critical' | 'Warning' | 'Info';

const SEV_STYLES: Record<Severity, { icon: React.ReactNode; msgColor: string; border: string }> = {
  critical: {
    icon: <IconCritical size={14} className="text-red-400 shrink-0 mt-0.5" />,
    msgColor: 'text-[#f5f5f5]',
    border: 'border-l-red-500/60',
  },
  warning: {
    icon: <IconAlert size={14} className="text-amber-400 shrink-0 mt-0.5" />,
    msgColor: 'text-[#f5f5f5]',
    border: 'border-l-amber-400/60',
  },
  info: {
    icon: <IconInfo size={14} className="text-blue-400 shrink-0 mt-0.5" />,
    msgColor: 'text-[#f5f5f5]',
    border: 'border-l-blue-500/40',
  },
};

const TABS: Array<{ label: Tab; severity: Severity; activeColor: string }> = [
  { label: 'Critical', severity: 'critical', activeColor: 'text-red-400'   },
  { label: 'Warning',  severity: 'warning',  activeColor: 'text-amber-400' },
  { label: 'Info',     severity: 'info',     activeColor: 'text-blue-400'  },
];

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' }) +
    ' • ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' SGT';
}

export function AlertPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const { alerts, dismiss } = useAlerts();
  const [activeTab, setActiveTab] = useState<Tab>('Critical');

  const canDismiss = user?.role === 'Engineer' || user?.role === 'Admin';
  const activeSeverity = TABS.find((t) => t.label === activeTab)!.severity;
  const filtered = alerts.filter((a) => a.severity === activeSeverity);

  const counts = {
    Critical: alerts.filter((a) => a.severity === 'critical').length,
    Warning: alerts.filter((a) => a.severity === 'warning').length,
    Info: alerts.filter((a) => a.severity === 'info').length,
  };

  return (
    <div className="flex-1 rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Alerts</span>
        <span className="text-[10px] font-mono text-[#888888] uppercase tracking-wider">Active</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#1e1e1e] shrink-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium transition-colors border-b-2 ' +
                (isActive ? `${tab.activeColor} border-current` : 'text-[#888888] hover:text-[#f5f5f5] border-transparent')
              }
            >
              {tab.label}
              <span className={'text-[10px] font-mono px-1.5 py-0.5 rounded ' + (isActive ? 'bg-[#1e1e1e]' : 'text-[#5a5a5a]')}>
                {counts[tab.label]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-[#1e1e1e]">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-[#5a5a5a]">No {activeTab.toLowerCase()} alerts</div>
          ) : (
            filtered.map((a) => {
              const sev = SEV_STYLES[a.severity];
              return (
                <div key={a.id} className={`flex items-start gap-3 px-4 py-3 border-l-2 ${sev.border}`}>
                  {sev.icon}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] leading-snug ${sev.msgColor}`}>{a.message}</p>
                    <p className="mt-0.5 text-[10.5px] font-mono text-[#5a5a5a]">{fmtWhen(a.createdAt)}</p>
                  </div>

                  {canDismiss && (
                    <button
                      onClick={() => dismiss(a.id)}
                      className="ml-3 text-[#888888] hover:text-[#f5f5f5]"
                      title="Dismiss alert"
                      aria-label={`Dismiss alert`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })
          )}

          {/* Inline footer */}
          <div className="px-4 py-2.5 border-t border-[#2a2a2a] bg-transparent">
            <button onClick={() => router.push('/alerts')} className="text-[11.5px] text-[#888888] hover:text-[#f5f5f5] transition-colors">
              View all alerts →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

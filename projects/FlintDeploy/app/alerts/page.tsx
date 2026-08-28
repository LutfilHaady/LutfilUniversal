'use client';

import { useState } from 'react';
import { Shell } from '@/components/shell';
import { DataState } from '@/components/data-state';
import { IconCritical, IconAlert, IconInfo } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import { useAlerts } from '@/lib/hooks/useAlerts';
import type { AlertSeverity, AlertView } from '@/lib/alerts/types';

const SEV_STYLES: Record<AlertSeverity, { icon: React.ReactNode; border: string; label: string; labelColor: string }> = {
  critical: {
    icon: <IconCritical size={14} className="text-red-400 shrink-0 mt-0.5" />,
    border: 'border-l-red-500/60',
    label: 'Critical',
    labelColor: 'text-red-400 bg-red-400/10 border-red-400/20',
  },
  warning: {
    icon: <IconAlert size={14} className="text-amber-400 shrink-0 mt-0.5" />,
    border: 'border-l-amber-400/60',
    label: 'Warning',
    labelColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  },
  info: {
    icon: <IconInfo size={14} className="text-blue-400 shrink-0 mt-0.5" />,
    border: 'border-l-blue-500/40',
    label: 'Info',
    labelColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
};

type Tab = 'All' | 'Critical' | 'Warning' | 'Info';

const TABS: Array<{ label: Tab; severity: AlertSeverity | null; activeColor: string }> = [
  { label: 'All',      severity: null,       activeColor: 'text-[#f5f5f5]'  },
  { label: 'Critical', severity: 'critical', activeColor: 'text-red-400'    },
  { label: 'Warning',  severity: 'warning',  activeColor: 'text-amber-400'  },
  { label: 'Info',     severity: 'info',     activeColor: 'text-blue-400'   },
];

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' SGT';
}

function AlertRow({ alert, canDismiss, onDismiss }: { alert: AlertView; canDismiss: boolean; onDismiss: (id: string) => void }) {
  const sev = SEV_STYLES[alert.severity];
  return (
    <div className={`flex items-start gap-4 px-5 py-3.5 border-l-2 ${sev.border} border-b border-[#1a1a1a] last:border-b-0`}>
      {sev.icon}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[#f5f5f5] leading-snug">{alert.message}</p>
        <p className="mt-1 text-[11px] font-mono text-[#5a5a5a]">{fmtWhen(alert.createdAt)}</p>
      </div>
      <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border ${sev.labelColor}`}>{sev.label}</span>
      {canDismiss && (
        <button
          onClick={() => onDismiss(alert.id)}
          className="shrink-0 text-[#888888] hover:text-[#f5f5f5]"
          title="Dismiss alert"
          aria-label="Dismiss alert"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const { user } = useAuth();
  const { alerts, loading, error, dismiss } = useAlerts();
  const canDismiss = user?.role === 'Engineer' || user?.role === 'Admin';

  const filtered = activeTab === 'All' ? alerts : alerts.filter((a) => a.severity === activeTab.toLowerCase());

  const counts: Record<Tab, number> = {
    All: alerts.length,
    Critical: alerts.filter((a) => a.severity === 'critical').length,
    Warning: alerts.filter((a) => a.severity === 'warning').length,
    Info: alerts.filter((a) => a.severity === 'info').length,
  };

  return (
    <Shell title="Alerts" subtitle="/ Active system alerts">
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">
        <DataState loading={loading} error={error}>
          <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center border-b border-[#2a2a2a]">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.label;
                return (
                  <button
                    key={tab.label}
                    onClick={() => setActiveTab(tab.label)}
                    className={
                      'flex items-center gap-1.5 px-5 py-3 text-[12px] font-medium transition-colors border-b-2 ' +
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

            {/* Alert rows */}
            <div className="divide-y divide-[#1a1a1a]">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-[12px] text-[#5a5a5a]">No {activeTab.toLowerCase()} alerts</div>
              ) : (
                filtered.map((a) => <AlertRow key={a.id} alert={a} canDismiss={canDismiss} onDismiss={dismiss} />)
              )}
            </div>
          </div>
        </DataState>

        <footer className="pt-2 pb-1 text-[11px] font-mono text-[#5a5a5a]">FLINT TRACEABILITY v2 · BUILD 2026.04.30</footer>
      </main>
    </Shell>
  );
}

'use client';

import { useState } from 'react';
import { IconCritical, IconAlert, IconInfo } from '@/components/icons';

type Severity = 'critical' | 'warning' | 'info';
type Tab = 'Critical' | 'Warning' | 'Info';

const ALL_ALERTS: Array<{ id: string; severity: Severity; message: string; time: string }> = [
  { id: 'A1', severity: 'critical', message: 'Coating QC failed — MIXC-20260430-A01-03. Batch placed under review.',    time: '11:42' },
  { id: 'A2', severity: 'warning',  message: 'CAL-02 calibration due in 2 hours. Schedule maintenance window.',          time: '10:15' },
  { id: 'A3', severity: 'warning',  message: 'SLIT-20260430-B02-01 placed on Hold by J. Park.',                          time: '09:33' },
  { id: 'A4', severity: 'info',     message: 'Shift handover completed. Day shift active since 07:00 SGT.',              time: '07:01' },
  { id: 'A5', severity: 'info',     message: 'MIXC-20260430-A01-01 coating run completed. Yield 95.2%.',                 time: '08:44' },
];

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

const TABS: Array<{ label: Tab; severity: Severity; color: string; activeColor: string }> = [
  { label: 'Critical', severity: 'critical', color: 'text-[#888888]', activeColor: 'text-red-400'   },
  { label: 'Warning',  severity: 'warning',  color: 'text-[#888888]', activeColor: 'text-amber-400' },
  { label: 'Info',     severity: 'info',     color: 'text-[#888888]', activeColor: 'text-blue-400'  },
];

export function AlertPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('Critical');

  const activeSeverity = TABS.find(t => t.label === activeTab)!.severity;
  const filtered = ALL_ALERTS.filter(a => a.severity === activeSeverity);
  const counts = {
    Critical: ALL_ALERTS.filter(a => a.severity === 'critical').length,
    Warning:  ALL_ALERTS.filter(a => a.severity === 'warning').length,
    Info:     ALL_ALERTS.filter(a => a.severity === 'info').length,
  };

  return (
    <div className="flex-1 rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Alerts</span>
        <span className="text-[10px] font-mono text-[#888888] uppercase tracking-wider">Today</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#1e1e1e] shrink-0">
        {TABS.map(tab => {
          const isActive = activeTab === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium transition-colors border-b-2 ' +
                (isActive
                  ? `${tab.activeColor} border-current`
                  : 'text-[#888888] hover:text-[#f5f5f5] border-transparent')
              }
            >
              {tab.label}
              <span className={
                'text-[10px] font-mono px-1.5 py-0.5 rounded ' +
                (isActive ? 'bg-[#1e1e1e]' : 'text-[#5a5a5a]')
              }>
                {counts[tab.label]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <div className="flex-1 divide-y divide-[#1e1e1e] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-[#5a5a5a]">No {activeTab.toLowerCase()} alerts</p>
        ) : (
          filtered.map(a => {
            const sev = SEV_STYLES[a.severity];
            return (
              <div key={a.id} className={`flex items-start gap-3 px-4 py-3 border-l-2 ${sev.border}`}>
                {sev.icon}
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] leading-snug ${sev.msgColor}`}>{a.message}</p>
                  <p className="mt-0.5 text-[10.5px] font-mono text-[#5a5a5a]">{a.time} SGT</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#2a2a2a] shrink-0">
        <button className="text-[11.5px] text-[#888888] hover:text-[#f5f5f5] transition-colors">
          View all alerts →
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import { SUBBATCH_DETAIL, TERMINAL_STATUSES, BatchStatus } from '@/lib/data';
import { IconUser, IconMachines, IconCalendar, IconClipboard, IconPlus, IconCheck, IconPause, IconRotate, IconTrash, IconClose, IconShield } from '@/components/icons';

// Map each target status to button appearance
const STATUS_CHANGE_BUTTONS: Array<{
  targetStatus: BatchStatus;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  borderColor: string;
  hoverBg: string;
  textColor: string;
  showFrom: BatchStatus[];  // which current statuses show this button
}> = [
  {
    targetStatus: 'OnHold',
    label: 'Place On Hold',
    icon: IconPause,
    borderColor: '#f59e0b',
    hoverBg: 'rgba(245,158,11,0.06)',
    textColor: '#f59e0b',
    showFrom: ['InProgress'],
  },
  {
    targetStatus: 'Quarantine',
    label: 'Quarantine',
    icon: IconShield,
    borderColor: '#a855f7',
    hoverBg: 'rgba(168,85,247,0.06)',
    textColor: '#d8b4fe',
    showFrom: ['InProgress', 'OnHold'],
  },
  {
    targetStatus: 'Released',
    label: 'Release',
    icon: IconCheck,
    borderColor: '#22c55e',
    hoverBg: 'rgba(34,197,94,0.06)',
    textColor: '#22c55e',
    showFrom: ['OnHold', 'Quarantine'],
  },
  {
    targetStatus: 'Scrapped',
    label: 'Scrap',
    icon: IconTrash,
    borderColor: '#ef4444',
    hoverBg: 'rgba(239,68,68,0.06)',
    textColor: '#ef4444',
    showFrom: ['InProgress', 'OnHold', 'Quarantine'],
  },
];

export function IdentityHeader() {
  const d = SUBBATCH_DETAIL;
  const router = useRouter();
  const [showScrapConfirm, setShowScrapConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<BatchStatus | null>(null);
  const [currentStatus, setCurrentStatus] = useState<BatchStatus>(d.status);

  const isTerminal = TERMINAL_STATUSES.includes(currentStatus);

  function handleStatusChange(target: BatchStatus) {
    if (target === 'Scrapped') {
      setPendingStatus('Scrapped');
      setShowScrapConfirm(true);
    } else {
      // In future: patch to Supabase + insert batch_status_changes row
      setCurrentStatus(target);
    }
  }

  function confirmScrap() {
    setCurrentStatus('Scrapped');
    setShowScrapConfirm(false);
    setPendingStatus(null);
  }

  return (
    <>
      <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-5">
        <div className="flex items-start gap-4">
          {/* Left: identity */}
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-[#5a5a5a] mb-1">Sub-Batch</div>
            <div className="text-[20px] font-semibold font-mono tracking-tight text-[#f5f5f5]">{d.id}</div>
            <div className="mt-1 text-[12px] text-[#888888]">
              Parent: <span className="font-mono text-[#93c5fd]">{d.parentId}</span>
              {' · '}{d.category}
            </div>
            <div className="mt-2">
              <StatusBadge status={currentStatus} />
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-col gap-1.5 shrink-0 w-[172px]">
            {isTerminal ? (
              /* Terminal state — no actions available */
              <div className="text-[11px] text-[#5a5a5a] text-center py-2">
                No further actions
              </div>
            ) : (
              <>
                {/* Operational actions — only when InProgress */}
                {currentStatus === 'InProgress' && (
                  <>
                    <button
                      onClick={() => router.push(`/log/process-step?subbatchId=${encodeURIComponent(d.id)}`)}
                      className="h-9 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <IconPlus size={13} /> Log Process Step
                    </button>
                    <button
                      onClick={() => router.push(`/log/qc?subbatchId=${encodeURIComponent(d.id)}`)}
                      className="h-9 px-3 rounded-md border border-[#363636] bg-transparent hover:bg-[#1a1a1a] text-[#f5f5f5] text-[12px] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <IconCheck size={13} /> Log QC
                    </button>
                    {/* Rework — always disabled */}
                    <button
                      disabled
                      title="Rework status pending backend support"
                      className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-transparent text-[#3a3a3a] text-[12px] flex items-center justify-center gap-1.5 cursor-not-allowed"
                    >
                      <IconRotate size={13} /> Mark Rework
                    </button>
                  </>
                )}

                {/* Status-change actions based on valid transitions */}
                {STATUS_CHANGE_BUTTONS.filter(b => b.showFrom.includes(currentStatus)).map(btn => (
                  <button
                    key={btn.targetStatus}
                    onClick={() => handleStatusChange(btn.targetStatus)}
                    className="h-9 px-3 rounded-md border bg-transparent text-[12px] flex items-center justify-center gap-1.5 transition-colors"
                    style={{
                      borderColor: `${btn.borderColor}99`,
                      color: btn.textColor,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = btn.hoverBg)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <btn.icon size={13} /> {btn.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            { icon: IconMachines,  label: 'Machine',  value: `${d.machine} (${d.machineRef})` },
            { icon: IconUser,      label: 'Operator', value: d.operator },
            { icon: IconCalendar,  label: 'Started',  value: d.started },
            { icon: IconClipboard, label: 'Qty',      value: d.qty },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg border border-[#1e1e1e] bg-[#0e0e0e] px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={12} className="text-[#5a5a5a]" />
                <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{label}</span>
              </div>
              <div className="text-[12.5px] text-[#f5f5f5] font-mono leading-snug">{value}</div>
            </div>
          ))}
        </div>

        {d.notes && (
          <div className="mt-3 px-4 py-3 rounded-lg border border-[#1e1e1e] bg-[#0e0e0e]">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a] mb-1">Run Notes</div>
            <p className="text-[12px] text-[#888888] leading-relaxed">{d.notes}</p>
          </div>
        )}
      </div>

      {/* Scrap confirmation dialog */}
      {showScrapConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[400px] rounded-xl border border-[#ef4444]/40 bg-[#111111] p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[15px] font-semibold text-[#f5f5f5]">Confirm Scrap</div>
                <div className="text-[12px] text-[#888888] mt-0.5">This action cannot be undone.</div>
              </div>
              <button onClick={() => setShowScrapConfirm(false)} className="text-[#5a5a5a] hover:text-[#f5f5f5]">
                <IconClose size={16} />
              </button>
            </div>
            <p className="text-[12.5px] text-[#888888] leading-relaxed mb-5">
              Mark <span className="font-mono text-[#f5f5f5]">{d.id}</span> as{' '}
              <span className="text-[#ef4444] font-semibold">Scrapped</span>? This will be permanently
              logged to the audit trail and cannot be reversed.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowScrapConfirm(false)}
                className="flex-1 h-9 rounded-md border border-[#2a2a2a] text-[#888888] hover:text-[#f5f5f5] text-[12.5px] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmScrap}
                className="flex-1 h-9 rounded-md bg-[#ef4444] hover:bg-red-400 text-white text-[12.5px] font-semibold transition-colors"
              >
                Confirm Scrap
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

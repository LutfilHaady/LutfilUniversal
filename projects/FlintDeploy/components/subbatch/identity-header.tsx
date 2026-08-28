'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import supabase from '@/lib/supabase';
import { StatusBadge } from '@/components/status-badge';
import { BatchStatus } from '@/lib/types';
import type { SubBatchDetail } from '@/lib/hooks/useBatch';
import { IconUser, IconMachines, IconCalendar, IconClipboard, IconPlus, IconCheck, IconPause, IconRotate, IconTrash, IconClose, IconShield, IconQR, IconEdit, IconDownload } from '@/components/icons';
import QRCode from 'react-qr-code';
import { exportQR } from '@/lib/utils';
import { EditSubBatchDrawer } from '@/components/subbatch/edit-subbatch-drawer';

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

export function IdentityHeader({ batch }: { batch: any }) {
  const d = batch;
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role ?? 'Operator';
  const [showScrapConfirm, setShowScrapConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<BatchStatus | null>(null);
  const [currentStatus, setCurrentStatus] = useState<BatchStatus>(d.status);
  const [showQR, setShowQR] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Consider only 'Scrapped' a terminal (no further actions) state here.
  const isTerminal = currentStatus === 'Scrapped';

  async function handleStatusChange(target: BatchStatus) {
    if (target === 'Scrapped') {
      setPendingStatus('Scrapped');
      setShowScrapConfirm(true);
    } else {
      setStatusLoading(true);
      setStatusError(null);
      const { error } = await supabase.rpc('transition_batch_status', {
        p_batch_id:   batch.id,
        p_new_status: target,
        p_reason:     null,
        p_user_id:    user?.id,
      });
      setStatusLoading(false);
      if (error) {
        if (error.message?.includes('401') || (error as any)?.status === 401) {
          router.push('/login');
          return;
        }
        setStatusError(error.message);
        return;
      }
      setCurrentStatus(target);
    }
  }

  async function confirmScrap() {
    setStatusLoading(true);
    setStatusError(null);
    const { error } = await supabase.rpc('transition_batch_status', {
      p_batch_id:   batch.id,
      p_new_status: 'Scrapped',
      p_reason:     null,
      p_user_id:    user?.id,
    });
    setStatusLoading(false);
    setShowScrapConfirm(false);
    setPendingStatus(null);
    if (error) {
      if (error.message?.includes('401') || (error as any)?.status === 401) {
        router.push('/login');
        return;
      }
      setStatusError(error.message);
      return;
    }
    setCurrentStatus('Scrapped');
  }

  return (
    <>
      <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-5">
        <div className="flex flex-col md:flex-row items-start gap-4">
          {/* Left: identity */}
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-[#5a5a5a] mb-1 flex items-center justify-between">
              <span>Sub-Batch</span>
              <button 
                onClick={() => setShowQR(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#888888] hover:text-[#f5f5f5] transition-colors"
              >
                <IconQR size={12} />
                <span className="text-[10px] font-mono uppercase tracking-widest">Show QR</span>
              </button>
            </div>
            <div className="text-[20px] font-semibold font-mono tracking-tight text-[#f5f5f5]">{d.batch_number}</div>
            <div className="mt-1 text-[12px] text-[#888888]">
              Parent: <span className="font-mono text-[#93c5fd]">{d.parent_batch?.batch_number ?? '—'}</span>
              {d.material?.name ? <>{' · '}{d.material.name}</> : null}
            </div>
            <div className="mt-2">
              <StatusBadge status={currentStatus} />
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-col gap-1.5 w-full md:w-[172px] shrink-0 mt-4 md:mt-0">
            {isTerminal ? (
              /* Terminal state — no actions available */
              <div className="text-[11px] text-[#5a5a5a] text-center py-2">
                No further actions
              </div>
            ) : (
              <>
                {/* Edit sub-batch (Engineer/Admin only) */}
                {(role === 'Engineer' || role === 'Admin') && (
                  <button
                    onClick={() => setShowEditDrawer(true)}
                    className="h-11 md:h-9 mb-1 px-3 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#e0e0e0] text-[13.5px] md:text-[12px] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <IconEdit size={13} /> Edit details
                  </button>
                )}
                
                {/* Operational actions — only when InProgress */}
                {currentStatus === 'InProgress' && (
                  <>
                    <button
                      onClick={() => router.push(`/log?subbatchId=${encodeURIComponent(d.id)}`)}
                      className="h-11 md:h-9 px-3 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[13.5px] md:text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <IconPlus size={13} /> Log Process Step
                    </button>
                    <button
                      onClick={() => router.push(`/log/qc?subbatchId=${encodeURIComponent(d.id)}`)}
                      className="h-11 md:h-9 px-3 rounded-md border border-[#363636] bg-transparent hover:bg-[#1a1a1a] text-[#f5f5f5] text-[13.5px] md:text-[12px] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <IconCheck size={13} /> Log QC
                    </button>
                    {/* Rework — always disabled */}
                    <button
                      disabled
                      title="Rework status pending backend support"
                      className="h-11 md:h-9 px-3 rounded-md border border-[#2a2a2a] bg-transparent text-[#3a3a3a] text-[13.5px] md:text-[12px] flex items-center justify-center gap-1.5 cursor-not-allowed"
                    >
                      <IconRotate size={13} /> Mark Rework
                    </button>
                  </>
                )}

                {/* Status-change actions based on valid transitions */}
                {(role === 'Engineer' || role === 'Admin') && STATUS_CHANGE_BUTTONS.filter(b => b.showFrom.includes(currentStatus)).map(btn => (
                  <button
                    key={btn.targetStatus}
                    onClick={() => handleStatusChange(btn.targetStatus)}
                    disabled={statusLoading}
                    className="h-11 md:h-9 px-3 rounded-md border bg-transparent text-[13.5px] md:text-[12px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      borderColor: `${btn.borderColor}99`,
                      color: btn.textColor,
                    }}
                    onMouseEnter={e => { if (!statusLoading) e.currentTarget.style.background = btn.hoverBg; }}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <btn.icon size={13} /> {btn.label}
                  </button>
                ))}
                {statusError && (
                  <div className="text-[10.5px] text-[#fca5a5] text-center leading-snug px-1">{statusError}</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            { icon: IconMachines,  label: 'Machine',  value: '—' },
            { icon: IconUser,      label: 'Operator', value: '—' },
            { icon: IconCalendar,  label: 'Started',  value: d.created_at ? new Date(d.created_at).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
            { icon: IconClipboard, label: 'Qty',      value: d.current_quantity != null ? `${d.current_quantity} ${d.unit ?? ''}`.trim() : '—' },
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
      {showScrapConfirm && (role === 'Engineer' || role === 'Admin') && (
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
              Mark <span className="font-mono text-[#f5f5f5]">{d.batch_number}</span> as{' '}
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

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="w-[320px] rounded-2xl border border-[#2a2a2a] bg-[#111111] p-8 shadow-2xl flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-[12px] font-mono uppercase tracking-widest text-[#5a5a5a] mb-2">Scan to View</div>
              <div className="text-[18px] font-semibold font-mono text-[#f5f5f5]">{d.batch_number}</div>
            </div>
            <div className="bg-white p-4 rounded-xl flex items-center justify-center">
              <svg id="subbatch-qr-export" viewBox="0 0 256 290" width={256} height={290} style={{ backgroundColor: 'white' }}>
                <g transform="translate(28, 28)">
                  <QRCode value={d.batch_number} size={200} />
                </g>
                <text x="128" y="265" fontFamily="monospace" fontSize="16" fontWeight="bold" textAnchor="middle" fill="black">
                  {d.batch_number}
                </text>
              </svg>
            </div>
            <div className="w-full flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => exportQR('subbatch-qr-export', d.batch_number, 'svg')}
                  className="flex-1 h-11 rounded-xl border border-[#2a2a2a] hover:bg-[#1a1a1a] text-[#f5f5f5] text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <IconDownload size={15} /> SVG
                </button>
                <button 
                  onClick={() => exportQR('subbatch-qr-export', d.batch_number, 'jpg')}
                  className="flex-1 h-11 rounded-xl border border-[#2a2a2a] hover:bg-[#1a1a1a] text-[#f5f5f5] text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <IconDownload size={15} /> JPG
                </button>
              </div>
              <button 
                onClick={() => setShowQR(false)}
                className="w-full h-11 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#f5f5f5] text-[13px] font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditDrawer && (
        <EditSubBatchDrawer
          subBatchId={d.id}
          batchNumber={d.batch_number}
          currentQty={d.current_quantity}
          unit={d.unit}
          location={d.current_location}
          notes={d.notes}
          onClose={() => setShowEditDrawer(false)}
          onUpdated={() => {
            // Ideally we'd trigger a re-fetch, but for now just reload the page to see changes
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconQR, IconSearch, IconChevronRight, IconBatches, IconX } from '@/components/icons';
import { StatusBadge } from '@/components/status-badge';
import { SUB_BATCHES } from '@/lib/data';

type ScanState = 'idle' | 'scanning' | 'result' | 'not-found';

const QUICK_SCAN_IDS = [
  'MIXC-20260430-A01-03',
  'CALN-20260430-A01-02',
  'SLIT-20260430-B02-01',
];

export default function ScanPage() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [manualId, setManualId] = useState('');
  const [foundBatch, setFoundBatch] = useState<(typeof SUB_BATCHES)[0] | null>(null);

  function handleScan(id: string) {
    setScanState('scanning');
    setTimeout(() => {
      const match = SUB_BATCHES.find((sb) => sb.id === id);
      if (match) {
        setFoundBatch(match);
        setScanState('result');
      } else {
        setFoundBatch(null);
        setScanState('not-found');
      }
    }, 600);
  }

  function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (manualId.trim()) handleScan(manualId.trim());
  }

  function reset() {
    setScanState('idle');
    setManualId('');
    setFoundBatch(null);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <div className="flex-1 w-full mx-auto md:max-w-[640px] flex flex-col">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
          <div>
            <div className="text-[17px] font-semibold text-[#f5f5f5]">Scan</div>
            <div className="text-[11px] font-mono text-[#5a5a5a]">QR code or manual ID lookup</div>
          </div>
          {scanState !== 'idle' && (
            <button
              onClick={reset}
              className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] transition-colors"
            >
              <IconX size={15} />
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col">

          {/* IDLE STATE */}
          {scanState === 'idle' && (
            <div className="flex flex-col gap-4 px-5 py-5">
              {/* Scanner viewfinder */}
              <div
                className="w-full rounded-2xl flex flex-col items-center justify-center gap-4 relative overflow-hidden"
                style={{ height: 220, background: '#0d0d0d', border: '1px solid #1e1e1e' }}
              >
                {[
                  'top-3 left-3 border-t-2 border-l-2 rounded-tl-lg',
                  'top-3 right-3 border-t-2 border-r-2 rounded-tr-lg',
                  'bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg',
                  'bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg',
                ].map((cls) => (
                  <div key={cls} className={`absolute w-6 h-6 border-[#22c55e] ${cls}`} />
                ))}

                <div
                  className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#22c55e] to-transparent opacity-70"
                  style={{ animation: 'scanline 2s ease-in-out infinite', top: '50%' }}
                />

                <style>{`
                  @keyframes scanline {
                    0%, 100% { transform: translateY(-40px); opacity: 0.3; }
                    50% { transform: translateY(40px); opacity: 0.9; }
                  }
                `}</style>

                <IconQR size={40} className="text-[#2a2a2a]" />
                <div className="text-[12px] text-[#5a5a5a]">Point camera at QR code</div>

                <button
                  onClick={() => handleScan(QUICK_SCAN_IDS[0])}
                  className="mt-1 px-4 py-1.5 rounded-lg text-[11px] font-mono text-[#22c55e] border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] hover:bg-[rgba(34,197,94,0.14)] transition-colors"
                >
                  Simulate Scan
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#1e1e1e]" />
                <span className="text-[11px] font-mono text-[#4a4a4a]">or enter ID manually</span>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>

              <form onSubmit={handleManualSearch} className="flex gap-2">
                <div className="flex-1 relative">
                  <IconSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a5a]" />
                  <input
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="MIXC-20260430-A01-03"
                    className="w-full h-11 pl-8 pr-3 rounded-lg border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] placeholder-[#4a4a4a] outline-none focus:border-[#22c55e] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="h-11 px-4 rounded-lg text-[13px] font-semibold text-black transition-colors"
                  style={{ background: '#22c55e' }}
                >
                  Go
                </button>
              </form>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#4a4a4a] mb-2">Quick Scan</div>
                <div className="flex flex-col gap-1.5">
                  {QUICK_SCAN_IDS.map((id) => (
                    <button
                      key={id}
                      onClick={() => handleScan(id)}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg border border-[#1e1e1e] bg-[#0e0e0e] hover:border-[#2a2a2a] hover:bg-[#141414] transition-colors text-left"
                    >
                      <IconBatches size={13} className="text-[#5a5a5a] shrink-0" />
                      <span className="font-mono text-[12.5px] text-[#888888] flex-1">{id}</span>
                      <IconChevronRight size={12} className="text-[#3a3a3a]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SCANNING STATE */}
          {scanState === 'scanning' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-[#22c55e] border-t-transparent animate-spin" />
              <div className="text-[13px] text-[#888888]">Looking up record…</div>
            </div>
          )}

          {/* RESULT STATE */}
          {scanState === 'result' && foundBatch && (
            <div className="flex flex-col gap-4 px-5 py-5">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                <span className="w-4 h-4 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0">
                  <span className="text-[9px] text-black font-bold">✓</span>
                </span>
                <span className="text-[12px] text-[#86efac]">Record found</span>
              </div>

              <div className="rounded-xl border border-[#2a2a2a] bg-[#111] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e]">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Sub-Batch</div>
                    <div className="font-mono text-[14px] text-[#f5f5f5] mt-0.5">{foundBatch.id}</div>
                  </div>
                  <StatusBadge status={foundBatch.status} />
                </div>
                {[
                  ['Category', foundBatch.category],
                  ['Qty', foundBatch.qty],
                  ['Machine', foundBatch.machine],
                  ['Operator', foundBatch.operator],
                  ['Started', foundBatch.started],
                  ['Yield', foundBatch.yield !== null ? `${foundBatch.yield.toFixed(1)}%` : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-2.5 border-b border-[#141414] last:border-0">
                    <span className="text-[11.5px] text-[#5a5a5a]">{k}</span>
                    <span className="text-[11.5px] font-mono text-[#f5f5f5]">{v}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {[
                  { label: 'Log Process Step', color: '#22c55e', href: '/log/process-step' },
                  { label: 'Log QC Record',    color: '#f59e0b', href: '/log/qc' },
                  { label: 'View Full Details', color: 'transparent', href: `/batches/${foundBatch.parentId}/${foundBatch.id}` },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => router.push(action.href)}
                    className="w-full h-12 rounded-xl font-medium text-[14px] transition-colors border"
                    style={{
                      background: action.color === 'transparent' ? '#161616' : `${action.color}18`,
                      color: action.color === 'transparent' ? '#888888' : action.color,
                      borderColor: action.color === 'transparent' ? '#2a2a2a' : `${action.color}40`,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* NOT FOUND STATE */}
          {scanState === 'not-found' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <IconSearch size={24} className="text-[#ef4444]" />
              </div>
              <div className="text-center">
                <div className="text-[14px] font-semibold text-[#f5f5f5]">No Record Found</div>
                <div className="text-[12px] text-[#888888] mt-1">
                  No sub-batch matching{' '}
                  <span className="font-mono text-[#fca5a5]">{manualId || 'the scanned code'}</span>{' '}
                  was found.
                </div>
              </div>
              <button
                onClick={reset}
                className="h-11 px-5 rounded-xl border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

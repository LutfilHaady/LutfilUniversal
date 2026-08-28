'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';
import { IconQR, IconSearch, IconX } from '@/components/icons';
import { useBatchByNumber } from '@/lib/hooks/useBatchByNumber';

type ScanState = 'idle' | 'scanning' | 'not-found' | 'error' | 'not-sub-batch';

export default function ScanPage() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [manualId, setManualId] = useState('');
  const [searchTerm, setSearchTerm] = useState<string | null>(null);
  const hasNavigated = useRef(false);  // Prevent duplicate navigation
  
  const { batch, loading, error } = useBatchByNumber(searchTerm);

  // Update scan state based on hook results
  useEffect(() => {
    if (!searchTerm) {
      hasNavigated.current = false;
      return;
    }
    if (loading) {
      setScanState('scanning');
      return;
    }

    if (batch && !hasNavigated.current) {
      if (!batch.parent_batch_id) {
        setScanState('not-sub-batch');
      } else {
        // Found! Navigate to batch detail page
        hasNavigated.current = true;
        router.push(
          `/batches/${encodeURIComponent(batch.parent_batch_id)}/${encodeURIComponent(batch.id)}`
        );
      }
    } else if (error) {
      setScanState(error === 'not_found' ? 'not-found' : 'error');
    }
  }, [searchTerm, loading, batch, error, router]);

  function handleScan(id: string) {
    if (!id.trim()) return;
    setSearchTerm(id.trim());
  }

  function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (manualId.trim()) handleScan(manualId.trim());
  }

  function reset() {
    setScanState('idle');
    setManualId('');
    setSearchTerm(null);
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
          <div className="flex items-center gap-2">
            {scanState !== 'idle' && (
              <button
                onClick={reset}
                className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] transition-colors"
                aria-label="Reset scan"
              >
                <IconX size={15} />
              </button>
            )}
            <button
              onClick={() => router.back()}
              className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#bbbbbb] hover:text-[#f5f5f5] transition-colors"
              aria-label="Close scan"
            >
              <IconX size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col">

          {/* IDLE STATE */}
          {scanState === 'idle' && (
            <div className="flex flex-col gap-4 px-5 py-5">
              {/* Scanner viewfinder */}
              <div
                className="w-full rounded-2xl overflow-hidden relative"
                style={{ height: 250, border: '1px solid #1e1e1e' }}
              >
                <Scanner 
                  onScan={(result) => {
                    if (result && result.length > 0) {
                      handleScan(result[0].rawValue);
                    }
                  }}
                  onError={(error) => console.error(error)}
                  components={{
                    torch: false,
                    zoom: false,
                    finder: true,
                  }}
                  styles={{
                    container: { width: '100%', height: '100%' },
                  }}
                />
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
            </div>
          )}

          {/* SCANNING STATE */}
          {scanState === 'scanning' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-[#22c55e] border-t-transparent animate-spin" />
              <div className="text-[13px] text-[#888888]">Looking up record…</div>
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
                <div className="text-[14px] font-semibold text-[#f5f5f5]">Batch Not Found</div>
                <div className="text-[12px] text-[#888888] mt-1">
                  No batch matching <span className="font-mono text-[#f5f5f5]">{manualId}</span> exists in the system.
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

          {/* NOT SUB-BATCH STATE */}
          {scanState === 'not-sub-batch' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <IconSearch size={24} className="text-[#f59e0b]" />
              </div>
              <div className="text-center">
                <div className="text-[14px] font-semibold text-[#f5f5f5]">Main Batch Detected</div>
                <div className="text-[12px] text-[#888888] mt-1">
                  <span className="font-mono text-[#f5f5f5]">{manualId}</span> is a Main Batch. Detail pages are currently only available for Sub-Batches.
                </div>
              </div>
              <button
                onClick={reset}
                className="h-11 px-5 rounded-xl border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
              >
                Scan Sub-Batch
              </button>
            </div>
          )}

          {/* ERROR STATE */}
          {scanState === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <IconSearch size={24} className="text-[#ef4444]" />
              </div>
              <div className="text-center">
                <div className="text-[14px] font-semibold text-[#f5f5f5]">Lookup Failed</div>
                <div className="text-[12px] text-[#888888] mt-1">
                  An error occurred while searching. Please check your connection and try again.
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

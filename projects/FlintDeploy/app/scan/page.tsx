'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner, setZXingModuleOverrides } from '@yudiel/react-qr-scanner';
import type { IScannerError } from '@yudiel/react-qr-scanner';

setZXingModuleOverrides({
  locateFile: (path: string) => path.endsWith('.wasm') ? `/${path}` : path,
});
import { IconQR, IconSearch, IconX } from '@/components/icons';
import { useBatchByNumber } from '@/lib/hooks/useBatchByNumber';
import supabase from '@/lib/supabase';

function cameraErrorMessage(error: IScannerError): string {
  switch (error.kind) {
    case 'permission-denied': return 'Camera permission denied. Allow camera access in browser settings.';
    case 'no-camera':         return 'No camera found on this device.';
    case 'in-use':            return 'Camera is in use by another application.';
    case 'insecure-context':  return 'Camera requires HTTPS. Please use the secure URL.';
    case 'unsupported':       return 'QR scanning is not supported in this browser.';
    case 'overconstrained':   return 'Camera constraints not met. Try a different browser.';
    default:                  return 'Camera unavailable. Use manual entry below.';
  }
}

type ScanState = 'idle' | 'scanning' | 'not-found' | 'error' | 'machine-not-found';

// Batch codes always follow XXXX-YYYYMMDD- format; equipment codes (e.g. MA002) do not.
const BATCH_CODE_RE = /^[A-Z]+-\d{8}-/;

export default function ScanPage() {
  const router = useRouter();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [manualId, setManualId] = useState('');
  const [searchTerm, setSearchTerm] = useState<string | null>(null);
  const [equipmentCode, setEquipmentCode] = useState<string | null>(null);
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const hasNavigated = useRef(false);  // Prevent duplicate navigation

  const { batch, loading, error } = useBatchByNumber(searchTerm);

  // Batch lookup result handler
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
      hasNavigated.current = true;
      if (!batch.parent_batch_id) {
        // Main batch — go to main batch detail page
        router.push(`/batches/${encodeURIComponent(batch.id)}`);
      } else {
        // Sub-batch — go to sub-batch detail page
        router.push(
          `/batches/${encodeURIComponent(batch.parent_batch_id)}/${encodeURIComponent(batch.id)}`
        );
      }
    } else if (error) {
      setScanState(error === 'not_found' ? 'not-found' : 'error');
    }
  }, [searchTerm, loading, batch, error, router]);

  // Equipment code lookup — only reached for non-batch-format QR codes
  useEffect(() => {
    if (!equipmentCode) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('equipment')
        .select('id')
        .eq('equipment_code', equipmentCode)
        .single();
      if (cancelled || hasNavigated.current) return;
      if (data) {
        hasNavigated.current = true;
        router.push(`/machines?equipment=${encodeURIComponent(equipmentCode)}`);
      } else {
        setScanState('machine-not-found');
      }
    })();
    return () => { cancelled = true; };
  }, [equipmentCode, router]);

  function handleScan(id: string) {
    if (!id.trim()) return;
    const code = id.trim();
    hasNavigated.current = false;
    if (BATCH_CODE_RE.test(code)) {
      setSearchTerm(code);
    } else {
      setScanState('scanning');
      setEquipmentCode(code);
    }
  }

  function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (manualId.trim()) handleScan(manualId.trim());
  }

  function reset() {
    setScanState('idle');
    setManualId('');
    setSearchTerm(null);
    setEquipmentCode(null);
    setCameraErrorMsg(null);
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
                className="w-full rounded-2xl overflow-hidden relative flex items-center justify-center"
                style={{ height: 250, border: `1px solid ${cameraErrorMsg ? 'rgba(245,158,11,0.3)' : '#1e1e1e'}`, background: '#0d0d0d' }}
              >
                {cameraErrorMsg ? (
                  <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <IconQR size={32} className="text-[#3a3a3a]" />
                    <div>
                      <div className="text-[13px] font-semibold text-[#f59e0b]">Camera unavailable</div>
                      <div className="text-[11.5px] text-[#888888] mt-1">{cameraErrorMsg}</div>
                    </div>
                  </div>
                ) : (
                  <Scanner
                    onScan={(result) => {
                      if (result && result.length > 0) {
                        handleScan(result[0].rawValue);
                      }
                    }}
                    onError={(err) => setCameraErrorMsg(cameraErrorMessage(err))}
                    constraints={{ facingMode: { ideal: 'environment' } }}
                    components={{ torch: false, zoom: false, finder: true }}
                    styles={{ container: { width: '100%', height: '100%' } }}
                  />
                )}
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

          {/* MACHINE NOT FOUND STATE */}
          {scanState === 'machine-not-found' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <IconSearch size={24} className="text-[#ef4444]" />
              </div>
              <div className="text-center">
                <div className="text-[14px] font-semibold text-[#f5f5f5]">Machine Not Found</div>
                <div className="text-[12px] text-[#888888] mt-1">
                  No machine found for code <span className="font-mono text-[#f5f5f5]">{equipmentCode ?? ''}</span>.
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

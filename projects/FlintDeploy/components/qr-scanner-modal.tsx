'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner, setZXingModuleOverrides } from '@yudiel/react-qr-scanner';
import type { IScannerError } from '@yudiel/react-qr-scanner';
import { cameraErrorMessage } from '@/lib/camera-error';
import { resolveExactMatch } from '@/lib/global-search';
import { useCommandPalette } from '@/lib/command-palette-context';

setZXingModuleOverrides({
  locateFile: (path: string) => path.endsWith('.wasm') ? `/${path}` : path,
});

export function QrScannerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { openPalette } = useCommandPalette();
  const [manual, setManual] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  async function handleCode(code: string) {
    const term = code.trim();
    if (!term || resolving) return;
    setResolving(true);
    const match = await resolveExactMatch(term);
    setResolving(false);
    onClose();
    if (match) {
      router.push(match.href);
    } else {
      openPalette(term);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-black/60" onClick={onClose}>
      <div role="dialog" aria-label="Scan QR code" className="w-full max-w-[420px] rounded-xl bg-[#161616] border border-[#2a2a2a] shadow-[0_16px_48px_rgba(0,0,0,0.7)] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 h-12 flex items-center border-b border-[#2a2a2a] text-[13px] font-semibold text-[#f5f5f5]">Scan QR code</div>
        <div className="p-4 flex flex-col gap-3">
          <div className="w-full rounded-xl overflow-hidden relative" style={{ height: 200, background: '#111', border: `1px solid ${cameraError ? 'rgba(245,158,11,0.3)' : '#1e1e1e'}` }}>
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-5 text-center">
                <div className="text-[12.5px] font-semibold text-[#f59e0b]">Camera unavailable</div>
                <div className="text-[11px] text-[#888888]">{cameraError}</div>
              </div>
            ) : (
              <Scanner
                onScan={(r) => { if (r && r.length > 0) handleCode(r[0].rawValue); }}
                onError={(err: IScannerError) => setCameraError(cameraErrorMessage(err))}
                constraints={{ facingMode: { ideal: 'environment' } }}
                components={{ torch: false, zoom: false, finder: true }}
                styles={{ container: { width: '100%', height: '100%' } }}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-[#1e1e1e]" />
            <span className="text-[11px] text-[#5a5a5a] font-mono">or enter manually</span>
            <div className="flex-1 h-px bg-[#1e1e1e]" />
          </div>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCode(manual); }}
              placeholder="Enter code…"
              className="flex-1 h-10 px-3 rounded-lg text-[14px] text-[#f5f5f5] bg-[#1a1a1a] border border-[#2a2a2a] placeholder-[#4a4a4a] outline-none focus:border-[#22c55e]"
            />
            <button
              onClick={() => handleCode(manual)}
              disabled={!manual.trim() || resolving}
              className="h-10 px-4 rounded-lg bg-[#22c55e] text-black text-[13px] font-semibold disabled:opacity-40"
            >
              {resolving ? '…' : 'Go'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

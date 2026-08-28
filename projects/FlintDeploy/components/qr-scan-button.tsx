'use client';

import { useState } from 'react';
import { IconSearch } from '@/components/icons';
import { QrScannerModal } from '@/components/qr-scanner-modal';

export function QrScanButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 max-md:h-10 px-3.5 max-md:px-4 rounded-md bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.35)] text-[#22c55e] hover:bg-[rgba(34,197,94,0.22)] flex items-center gap-2 text-[12.5px] max-md:text-[14px] font-semibold transition-colors"
        title="Scan QR"
        aria-label="Scan QR"
      >
        <IconSearch size={14} />
        <span>Scan</span>
      </button>

      {open && <QrScannerModal onClose={() => setOpen(false)} />}
    </>
  );
}

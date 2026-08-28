'use client';

import { useState } from 'react';
import { IconAlert, IconClose } from '@/components/icons';

interface AlertBannerProps {
  onDismiss?: () => void;
}

export function AlertBanner({ onDismiss }: AlertBannerProps) {
  return (
    <div
      className="flex items-center gap-3 px-6 py-2.5 border-b border-amber-500/20"
      style={{ background: 'rgba(245,158,11,0.07)' }}
    >
      <IconAlert size={15} className="text-amber-400 shrink-0" />
      <p className="flex-1 text-[12.5px] text-amber-200/90">
        <span className="font-semibold text-amber-300">Stock Alert:</span>{' '}
        Cathode slurry{' '}
        <span className="font-mono text-amber-200">SLRY-20260430-001</span>{' '}
        is at 12% remaining — below reorder threshold. Separator foil expiring in 3 days.
      </p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-amber-400/60 hover:text-amber-300 transition-colors"
        aria-label="Dismiss"
      >
        <IconClose size={15} />
      </button>
    </div>
  );
}

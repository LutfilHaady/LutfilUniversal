'use client';

import { IconAlert, IconCritical, IconClose } from '@/components/icons';
import { useAlerts } from '@/lib/hooks/useAlerts';

interface AlertBannerProps {
  onDismiss?: () => void;
}

export function AlertBanner({ onDismiss }: AlertBannerProps) {
  const { alerts } = useAlerts();

  // Surface the most severe active alert: critical first, else warning.
  const top = alerts.find((a) => a.severity === 'critical') ?? alerts.find((a) => a.severity === 'warning');
  if (!top) return null;

  const isCritical = top.severity === 'critical';
  const tone = isCritical
    ? { border: 'border-red-500/20', bg: 'rgba(239,68,68,0.07)', icon: 'text-red-400', text: 'text-red-200/90', label: 'text-red-300', hover: 'text-red-400/60 hover:text-red-300' }
    : { border: 'border-amber-500/20', bg: 'rgba(245,158,11,0.07)', icon: 'text-amber-400', text: 'text-amber-200/90', label: 'text-amber-300', hover: 'text-amber-400/60 hover:text-amber-300' };

  return (
    <div className={`flex items-center gap-3 px-6 py-2.5 border-b ${tone.border}`} style={{ background: tone.bg }}>
      {isCritical
        ? <IconCritical size={15} className={`${tone.icon} shrink-0`} />
        : <IconAlert size={15} className={`${tone.icon} shrink-0`} />}
      <p className={`flex-1 text-[12.5px] ${tone.text}`}>
        <span className={`font-semibold ${tone.label}`}>{isCritical ? 'Critical:' : 'Alert:'}</span>{' '}
        {top.message}
      </p>
      <button
        onClick={onDismiss}
        className={`shrink-0 transition-colors ${tone.hover}`}
        aria-label="Dismiss"
      >
        <IconClose size={15} />
      </button>
    </div>
  );
}

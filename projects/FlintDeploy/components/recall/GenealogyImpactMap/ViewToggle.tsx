'use client';

import type { ViewMode } from './types';

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'both',       label: 'Both'       },
  { value: 'upstream',   label: 'Upstream'   },
  { value: 'downstream', label: 'Downstream' },
];

interface Props {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}

export default function ViewToggle({ view, onChange }: Props) {
  return (
    <div
      className="flex items-center gap-1 p-0.5 rounded-lg shrink-0"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a2a' }}
    >
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-3 py-1.5 rounded-md text-[11.5px] font-medium transition-all"
          style={
            view === opt.value
              ? { background: 'rgba(147,197,253,0.15)', color: '#93c5fd', border: '1px solid rgba(147,197,253,0.3)' }
              : { background: 'transparent', color: '#5a5a5a', border: '1px solid transparent' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

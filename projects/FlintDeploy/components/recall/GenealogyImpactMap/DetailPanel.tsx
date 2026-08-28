'use client';

import type { GenealogyNode } from './types';
import { IconX, IconFlash, IconExternal } from '@/components/icons';

interface Props {
  node: GenealogyNode;
  onClose: () => void;
  onTraceNew: () => void;
}

const RISK_STYLES = {
  high:   { color: '#fca5a5', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'High'   },
  medium: { color: '#fcd34d', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: 'Medium' },
  low:    { color: '#86efac', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   label: 'Low'    },
  none:   { color: '#888888', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', label: 'None'  },
};

const KIND_LABELS: Record<string, string> = {
  input_material:    'Input material',
  parent_batch:      'Parent batch',
  focus:             'Sub-batch (investigated)',
  sibling_sub_batch: 'Sibling sub-batch',
  descendant_batch:  'Descendant batch',
};

export default function DetailPanel({ node, onClose, onTraceNew }: Props) {
  const risk    = RISK_STYLES[node.risk];
  const isFocus = node.kind === 'focus';

  const fields = [
    { label: 'Kind',         value: KIND_LABELS[node.kind] ?? node.kind },
    { label: 'Material',     value: node.material_name },
    { label: 'Supplier',     value: node.supplier ?? '—' },
    { label: 'Status',       value: node.status },
    { label: 'Risk level',   value: null },   // rendered separately with badge
    { label: 'Why included', value: node.reason },
  ];

  return (
    <div
      className="rounded-xl border overflow-hidden overflow-y-auto"
      style={{ borderColor: '#2a2a2a', background: '#0d0d0d', maxHeight: 440 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: '#1e1e1e' }}
      >
        <span className="font-mono text-[13px] font-semibold text-[#f5f5f5]">{node.id}</span>
        <button
          onClick={onClose}
          className="text-[#5a5a5a] hover:text-[#f5f5f5] transition-colors p-1 -m-1"
          aria-label="Close detail panel"
        >
          <IconX size={14} />
        </button>
      </div>

      {/* Detail grid */}
      <div
        className="px-5 py-4 grid gap-x-8 gap-y-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        {fields.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{label}</span>
            {label === 'Risk level' ? (
              <span
                className="inline-flex items-center self-start px-2 py-0.5 rounded text-[11px] font-medium border"
                style={{ background: risk.bg, color: risk.color, borderColor: risk.border }}
              >
                {risk.label}
              </span>
            ) : (
              <span className="text-[12px] text-[#c5c5c5] leading-snug">{value}</span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div
        className="px-5 py-3 border-t flex flex-col gap-2.5"
        style={{ borderColor: '#1e1e1e' }}
      >
        {node.recommended_action && (
          <button className="flex items-center gap-2 text-[12px] font-medium text-[#fcd34d] hover:text-[#fef08a] transition-colors text-left w-fit">
            <IconFlash size={12} />
            {node.recommended_action} →
          </button>
        )}
        {!isFocus && (
          <button
            onClick={onTraceNew}
            className="flex items-center gap-2 text-[12px] font-medium text-[#93c5fd] hover:text-[#bfdbfe] transition-colors text-left w-fit"
          >
            <IconExternal size={12} />
            Trace {node.id} as new investigation →
          </button>
        )}
      </div>
    </div>
  );
}

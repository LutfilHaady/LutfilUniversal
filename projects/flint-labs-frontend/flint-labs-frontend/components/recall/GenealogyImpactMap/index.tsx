'use client';

import { useState } from 'react';
import type { GenealogyImpactMapProps, GenealogyNode, ViewMode } from './types';
import { MOCK_GENEALOGY } from './mockData';
import GenealogyTree from './GenealogyTree';
import DetailPanel from './DetailPanel';
import ViewToggle from './ViewToggle';
import { IconInfo } from '@/components/icons';

const LEGEND_ITEMS = [
  { label: 'Investigated batch',      fill: '#1f1010', border: '#f87171' },
  { label: 'Affected upstream',       fill: '#1a1408', border: '#fbbf24' },
  { label: 'Released sibling',        fill: '#0a1a10', border: '#34d399' },
  { label: 'Cleared / not in scope',  fill: '#111320', border: '#3d4260' },
];

export default function GenealogyImpactMap({
  investigationId,
  onTraceNewInvestigation,
  data: externalData,
}: GenealogyImpactMapProps) {
  const [view, setView]                 = useState<ViewMode>('both');
  const [selectedNode, setSelectedNode] = useState<GenealogyNode | null>(null);

  void investigationId;
  const data = externalData ?? MOCK_GENEALOGY;
  const upLevels   = data.ancestors.length  > 0 ? Math.abs(Math.min(...data.ancestors.map(n => n.tier)))  : 0;
  const downLevels = data.descendants.length > 0 ? Math.max(...data.descendants.map(n => n.tier)) : 0;

  return (
    <section
      className="rounded-xl border"
      style={{ borderColor: '#2a2a2a', background: '#111111', padding: '1.25rem' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <IconGenealogyNetwork />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#f5f5f5]">Genealogy Impact Map</div>
            <div className="text-[12px] text-[#888888] mt-0.5">
              How the investigated batch is linked to upstream materials and downstream sub-batches.
            </div>
          </div>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Meta strip */}
      <div
        className="flex items-stretch mb-4 rounded-lg overflow-hidden text-[12px]"
        style={{ background: '#161616', border: '1px solid #1e1e1e' }}
      >
        <div className="flex items-center gap-2 px-4 py-2.5">
          <IconTarget />
          <span className="text-[#888888]">Investigating</span>
          <span className="font-mono text-[#93c5fd]">{data.focus.id}</span>
        </div>
        <div className="w-px bg-[#2a2a2a]" />
        <div className="flex items-center gap-2 px-4 py-2.5">
          <IconArrowUpSmall />
          <span className="text-[#888888]">{upLevels} level{upLevels !== 1 ? 's' : ''} up</span>
        </div>
        <div className="w-px bg-[#2a2a2a]" />
        <div className="flex items-center gap-2 px-4 py-2.5">
          <IconArrowDownSmall />
          <span className="text-[#888888]">{downLevels} level{downLevels !== 1 ? 's' : ''} down</span>
        </div>
      </div>

      {/* Canvas + side panel */}
      <div className="flex" style={{ gap: 0, alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <GenealogyTree
            data={data}
            view={view}
            selectedNodeUuid={selectedNode?.uuid}
            onNodeClick={setSelectedNode}
          />
        </div>
        <aside
          style={{
            width: selectedNode ? 220 : 0,
            transition: 'width 0.2s ease',
            overflow: 'hidden',
            flexShrink: 0,
            borderLeft: selectedNode ? '1px solid #2a2a2a' : 'none',
          }}
        >
          <div style={{ width: 220, paddingLeft: 12 }}>
            {selectedNode && (
              <DetailPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onTraceNew={() => {
                  onTraceNewInvestigation(selectedNode.id);
                  setSelectedNode(null);
                }}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-1"
        style={{ borderTop: '0.5px solid #2a2a2a' }}
      >
        <div className="flex flex-wrap items-center gap-5">
          {LEGEND_ITEMS.map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: item.fill, border: `1.5px solid ${item.border}` }}
              />
              <span className="text-[11px] text-[#888888]">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#5a5a5a]">
          <IconInfo size={11} />
          <span>Click any node for details · scroll to zoom · drag to pan</span>
        </div>
      </div>
    </section>
  );
}

function IconGenealogyNetwork() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2" />
      <circle cx="4"  cy="20" r="2" />
      <circle cx="20" cy="20" r="2" />
      <path d="M12 6 4.5 18M12 6l7.5 12M5 20h14" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconArrowUpSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function IconArrowDownSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

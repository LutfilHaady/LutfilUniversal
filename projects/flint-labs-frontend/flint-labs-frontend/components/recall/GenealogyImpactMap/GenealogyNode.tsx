'use client';

import { useState } from 'react';
import type { LayoutNode } from './utils';
import { NODE_COLORS } from './utils';

interface Props {
  node: LayoutNode;
  isSelected: boolean;
  opacity: number;
  onClick: () => void;
}

export default function GenealogyNode({ node, isSelected, opacity, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const colors   = NODE_COLORS[node.risk];
  const isFocus  = node.kind === 'focus';
  const { svgX: x, svgY: y, svgW: w, svgH: h } = node;

  const effectiveOpacity = hovered && opacity >= 1 ? 0.82 : opacity;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${node.id}, ${node.risk} risk, ${node.kind.replace(/_/g, ' ')}`}
      style={{ cursor: 'pointer', opacity: effectiveOpacity, transition: 'opacity 0.15s ease' }}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pulsing outer ring for focus node */}
      {isFocus && (
        <rect
          x={x - 5} y={y - 5} width={w + 10} height={h + 10} rx={11}
          fill="none"
          stroke={colors.border}
          strokeWidth={1}
          className="gim-pulse-ring"
        />
      )}

      {/* Selection highlight */}
      {isSelected && (
        <rect
          x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={10}
          fill="none"
          stroke="#93c5fd"
          strokeWidth={1.5}
          opacity={0.7}
        />
      )}

      {/* Node body */}
      <rect
        x={x} y={y} width={w} height={h} rx={7}
        fill={colors.fill}
        stroke={colors.border}
        strokeWidth={colors.bw}
      />

      {/* ID — monospace top line */}
      <text
        x={x + w / 2}
        y={y + (isFocus ? 20 : 18)}
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize={isFocus ? 11 : 10.5}
        fontWeight="500"
        fill={colors.text}
      >
        {node.id}
      </text>

      {/* Material name — second line */}
      <text
        x={x + w / 2}
        y={y + (isFocus ? 34 : 32)}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={10}
        fill={colors.text}
        opacity={0.7}
      >
        {node.material_name}
      </text>

      {/* Failure reason — focus only, third line, italic */}
      {isFocus && (
        <text
          x={x + w / 2}
          y={y + 50}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize={9.5}
          fontStyle="italic"
          fill={colors.text}
          opacity={0.6}
        >
          {node.reason.length > 30 ? node.reason.slice(0, 29) + '…' : node.reason}
        </text>
      )}
    </g>
  );
}

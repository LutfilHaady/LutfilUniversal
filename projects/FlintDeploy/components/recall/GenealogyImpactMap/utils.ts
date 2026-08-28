import type { GenealogyNode, GenealogyResponse, RiskLevel } from './types';

export const SVG_W = 960;
export const SVG_H = 400;

const CONTENT_Y_START = 50;
const CONTENT_Y_END = 385;
const CONTENT_H = CONTENT_Y_END - CONTENT_Y_START;

const NODE_H = 50;
const FOCUS_H = 68;

const TIER_CONFIG: Record<number, { x: number; w: number }> = {
  [-2]: { x: 20,  w: 170 },
  [-1]: { x: 260, w: 180 },
  [0]:  { x: 500, w: 170 },
  [1]:  { x: 720, w: 180 },
};

export const TIER_LABELS: Record<number, string> = {
  [-2]: 'UPSTREAM · L+2',
  [-1]: 'UPSTREAM · L+1',
  [0]:  'INVESTIGATED',
  [1]:  'DOWNSTREAM · L-1',
};

export const TIER_LABEL_X: Record<number, number> = {
  [-2]: 20  + 170 / 2,
  [-1]: 260 + 180 / 2,
  [0]:  500 + 170 / 2,
  [1]:  720 + 180 / 2,
};

export const NODE_COLORS: Record<RiskLevel, { fill: string; border: string; text: string; bw: number }> = {
  high:   { fill: '#FCEBEB', border: '#A32D2D', text: '#501313', bw: 2   },
  medium: { fill: '#FAEEDA', border: '#854F0B', text: '#412402', bw: 0.5 },
  low:    { fill: '#EAF3DE', border: '#3B6D11', text: '#173404', bw: 0.5 },
  none:   { fill: '#F1EFE8', border: '#5F5E5A', text: '#2C2C2A', bw: 0.5 },
};

export interface LayoutNode extends GenealogyNode {
  svgX: number;
  svgY: number;
  svgW: number;
  svgH: number;
}

export function layoutNodes(data: GenealogyResponse): LayoutNode[] {
  const all: GenealogyNode[] = [data.focus, ...data.ancestors, ...data.descendants];

  const byTier = new Map<number, GenealogyNode[]>();
  for (const n of all) {
    if (!byTier.has(n.tier)) byTier.set(n.tier, []);
    byTier.get(n.tier)!.push(n);
  }

  const result: LayoutNode[] = [];
  for (const [tier, nodes] of byTier) {
    const cfg = TIER_CONFIG[tier];
    if (!cfg) continue;

    const heights = nodes.map(n => n.kind === 'focus' ? FOCUS_H : NODE_H);
    const totalH  = heights.reduce((a, b) => a + b, 0);
    const gap     = (CONTENT_H - totalH) / (nodes.length + 1);

    let y = CONTENT_Y_START + gap;
    nodes.forEach((node, i) => {
      const h = heights[i];
      result.push({ ...node, svgX: cfg.x, svgY: y, svgW: cfg.w, svgH: h });
      y += h + gap;
    });
  }
  return result;
}

export function routeEdge(from: LayoutNode, to: LayoutNode): string {
  const sx = from.svgX + from.svgW;
  const sy = from.svgY + from.svgH / 2;
  const ex = to.svgX;
  const ey = to.svgY + to.svgH / 2;

  // Adjacent tiers (gap ≤ 2px) — add small horizontal extension so arrow is visible
  if (Math.abs(sx - ex) <= 2) {
    const ext = 14;
    return `M${sx} ${sy} L${sx + ext} ${sy} L${sx + ext} ${ey} L${ex} ${ey}`;
  }

  // Straight horizontal
  if (Math.abs(sy - ey) < 1) {
    return `M${sx} ${sy} L${ex} ${ey}`;
  }

  // Standard L-shaped orthogonal route
  const mx = (sx + ex) / 2;
  return `M${sx} ${sy} L${mx} ${sy} L${mx} ${ey} L${ex} ${ey}`;
}

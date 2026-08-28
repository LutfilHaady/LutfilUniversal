'use client';

import { useRef, useEffect } from 'react';
import type { GenealogyResponse, GenealogyNode, ViewMode } from './types';

interface CNode extends GenealogyNode {
  x: number; y: number;
  vx: number; vy: number;
  r: number; baseR: number; targetR: number;
  pinned: boolean;
}

const C = {
  focus:    { fill: '#1f1010', ring: '#f87171', glow: 'rgba(248,113,113,0.16)' as string | null, lbl: '#fca5a5' },
  upstream: { fill: '#1a1408', ring: '#fbbf24', glow: 'rgba(251,191,36,0.13)'  as string | null, lbl: '#fcd34d' },
  sibling:  { fill: '#0a1a10', ring: '#34d399', glow: 'rgba(52,211,153,0.13)'  as string | null, lbl: '#6ee7b7' },
  cleared:  { fill: '#111320', ring: '#3d4260', glow: null                      as string | null, lbl: '#4b5470' },
};

function colorKey(n: GenealogyNode): keyof typeof C {
  if (n.kind === 'focus') return 'focus';
  if (n.kind === 'sibling_sub_batch' || n.kind === 'descendant_batch') return 'sibling';
  return n.risk === 'none' ? 'cleared' : 'upstream';
}

function getBaseR(n: GenealogyNode): number {
  if (n.kind === 'focus') return 26;
  if (n.kind === 'parent_batch') return 19;
  if (n.kind === 'sibling_sub_batch' || n.kind === 'descendant_batch') return 16;
  return n.risk === 'none' ? 13 : 15;
}

function shortId(id: string): string {
  const p = id.split('-');
  return p.length >= 2 ? p.slice(-2).join('-') : id;
}

function placeNodes(nodes: CNode[], W: number, H: number) {
  const xFrac: Record<number, number> = { [-2]: 0.09, [-1]: 0.28, [0]: 0.50, [1]: 0.77 };
  const byTier = new Map<number, CNode[]>();
  for (const n of nodes) {
    if (!byTier.has(n.tier)) byTier.set(n.tier, []);
    byTier.get(n.tier)!.push(n);
  }
  for (const [tier, grp] of byTier) {
    const nx = (xFrac[tier] ?? 0.5) * W;
    grp.forEach((n, i) => {
      n.x = nx;
      n.y = grp.length === 1 ? 0.46 * H : (0.15 + (i / (grp.length - 1)) * 0.70) * H;
      n.vx = 0; n.vy = 0;
    });
  }
}

interface Props {
  data: GenealogyResponse;
  view: ViewMode;
  selectedNodeUuid: string | undefined;
  onNodeClick: (node: GenealogyNode) => void;
}

export default function GenealogyTree({ data, view, selectedNodeUuid, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);

  const simRef = useRef({
    nodes:      [] as CNode[],
    rafId:      0,
    ox: 0, oy: 0, scale: 1,
    W: 800, H: 440,
    hovered:    null as string | null,
    drag:       null as CNode | null,
    dragOx: 0,  dragOy: 0,
    panning:    false,
    panX0: 0, panY0: 0, panOx0: 0, panOy0: 0,
    downX: 0, downY: 0,
    reducedMotion: false,
  });

  const viewRef = useRef(view);
  const selRef  = useRef(selectedNodeUuid);
  const cbRef   = useRef(onNodeClick);
  useEffect(() => { viewRef.current = view; },              [view]);
  useEffect(() => { selRef.current = selectedNodeUuid; },   [selectedNodeUuid]);
  useEffect(() => { cbRef.current  = onNodeClick; },        [onNodeClick]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap   = wrapRef.current!;
    const sim    = simRef.current;

    sim.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const allData: GenealogyNode[] = [data.focus, ...data.ancestors, ...data.descendants];
    sim.nodes = allData.map(n => {
      const r = getBaseR(n);
      return { ...n, x: 0, y: 0, vx: 0, vy: 0, r, baseR: r, targetR: r, pinned: false };
    });
    sim.ox = 0; sim.oy = 0; sim.scale = 1;

    function resize() {
      const W = wrap.clientWidth || 800;
      const H = 440;
      sim.W = W; sim.H = H;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width        = W * dpr;
      canvas.height       = H * dpr;
      canvas.style.width  = `${W}px`;
      canvas.style.height = `${H}px`;
      placeNodes(sim.nodes, W, H);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    function canvasPos(e: MouseEvent): [number, number] {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }
    function toWorld(cx: number, cy: number): [number, number] {
      return [(cx - sim.ox) / sim.scale, (cy - sim.oy) / sim.scale];
    }
    function hitTest(cx: number, cy: number): CNode | null {
      const [wx, wy] = toWorld(cx, cy);
      for (let i = sim.nodes.length - 1; i >= 0; i--) {
        const n = sim.nodes[i];
        const dx = wx - n.x, dy = wy - n.y;
        if (dx * dx + dy * dy <= (n.r + 5) * (n.r + 5)) return n;
      }
      return null;
    }

    function tick() {
      const { nodes, W, H } = sim;
      const REPEL = 4000, EDGE_LEN = 155, SPRING_K = 0.96, DT = 0.016, DAMP = 0.8;
      const cx = W / 2, cy = H / 2;

      const fx = new Float32Array(nodes.length);
      const fy = new Float32Array(nodes.length);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d2 = Math.max(dx * dx + dy * dy, 1);
          const d  = Math.sqrt(d2);
          const f  = REPEL / d2;
          const ux = dx / d, uy = dy / d;
          fx[i] += ux * f; fy[i] += uy * f;
          fx[j] -= ux * f; fy[j] -= uy * f;
        }
      }

      const idxOf = new Map(nodes.map((n, i) => [n.uuid, i]));
      for (const e of data.edges) {
        const ai = idxOf.get(e.from_uuid), bi = idxOf.get(e.to_uuid);
        if (ai == null || bi == null) continue;
        const a = nodes[ai], b = nodes[bi];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.sqrt(dx * dx + dy * dy) || 1;
        const f  = (d - EDGE_LEN) * SPRING_K;
        const ux = dx / d, uy = dy / d;
        if (!a.pinned) { fx[ai] += ux * f; fy[ai] += uy * f; }
        if (!b.pinned) { fx[bi] -= ux * f; fy[bi] -= uy * f; }
      }

      const selUuid = selRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.targetR = (n.uuid === sim.hovered || n.uuid === selUuid) ? n.baseR * 1.26 : n.baseR;
        n.r += (n.targetR - n.r) * 0.15;
        if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
        fx[i] += (cx - n.x) * 0.004;
        fy[i] += (cy - n.y) * 0.004;
        n.vx = (n.vx + fx[i] * DT) * DAMP;
        n.vy = (n.vy + fy[i] * DT) * DAMP;
        n.x  = Math.max(30, Math.min(W - 30, n.x + n.vx));
        n.y  = Math.max(30, Math.min(H - 30, n.y + n.vy));
      }
    }

    function draw(t: number) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { nodes } = sim;
      const currentView = viewRef.current;
      const selUuid     = selRef.current;
      const nMap        = new Map(nodes.map(n => [n.uuid, n]));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(sim.ox, sim.oy);
      ctx.scale(sim.scale, sim.scale);

      // ── edges ──
      for (const edge of data.edges) {
        const from = nMap.get(edge.from_uuid);
        const to   = nMap.get(edge.to_uuid);
        if (!from || !to) continue;

        let alpha = 1;
        if (currentView === 'upstream'   && (from.tier >= 1 || to.tier >= 1)) alpha = 0.25;
        if (currentView === 'downstream' && from.tier <= -2)                   alpha = 0.25;

        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const sx = from.x + Math.cos(angle) * from.r;
        const sy = from.y + Math.sin(angle) * from.r;
        const ex = to.x   - Math.cos(angle) * (to.r + 7);
        const ey = to.y   - Math.sin(angle) * (to.r + 7);

        ctx.save();
        ctx.globalAlpha = alpha;
        if (edge.highlighted) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth   = 2;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur  = 8;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = '#252a40';
          ctx.lineWidth   = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.shadowBlur  = 0;
        }
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
        const arm = 7;
        ctx.beginPath();
        ctx.moveTo(ex - arm * Math.cos(angle - 0.42), ey - arm * Math.sin(angle - 0.42));
        ctx.lineTo(ex, ey);
        ctx.lineTo(ex - arm * Math.cos(angle + 0.42), ey - arm * Math.sin(angle + 0.42));
        ctx.stroke();
        ctx.restore();
      }

      // ── nodes ──
      const pulse = sim.reducedMotion ? 0.15 : 0.15 + 0.08 * Math.sin(t * 0.002);

      for (const n of nodes) {
        const cl       = C[colorKey(n)];
        const isActive = n.uuid === sim.hovered || n.uuid === selUuid;
        const isFocus  = n.kind === 'focus';

        let alpha = 1;
        if (currentView === 'upstream'   && n.tier >= 1)  alpha = 0.25;
        if (currentView === 'downstream' && n.tier <= -2) alpha = 0.25;

        ctx.save();
        ctx.globalAlpha = alpha;

        // 1. Glow halo
        if ((isFocus || isActive) && cl.glow) {
          const g = ctx.createRadialGradient(n.x, n.y, n.r * 0.5, n.x, n.y, n.r * 2.5);
          g.addColorStop(0, cl.glow);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Fill
        ctx.fillStyle = cl.fill;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();

        // 3. Ring
        ctx.strokeStyle = cl.ring;
        ctx.lineWidth   = isFocus ? 2.5 : isActive ? 2 : 1.5;
        ctx.globalAlpha = alpha * (isFocus ? 1 : isActive ? 0.95 : 0.5);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.stroke();

        // 4. Outer pulse ring (focus only, respects reduced-motion)
        if (isFocus && !sim.reducedMotion) {
          ctx.strokeStyle = cl.ring;
          ctx.lineWidth   = 1;
          ctx.globalAlpha = alpha * pulse;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = alpha;

        // 5. ID text
        const sid = shortId(n.id);
        const fs  = Math.max(9, n.r * 0.5);
        ctx.font          = `600 ${fs}px "SF Mono","JetBrains Mono",monospace`;
        ctx.fillStyle     = cl.lbl;
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        ctx.fillText(sid, n.x, n.r > 15 ? n.y - n.r * 0.18 : n.y, n.r * 1.8);

        // 6. Sub-label
        if (n.r > 15) {
          const kindShort =
            n.kind === 'input_material'    ? 'input'   :
            n.kind === 'parent_batch'      ? 'parent'  :
            n.kind === 'focus'             ? 'focus'   :
            n.kind === 'sibling_sub_batch' ? 'sibling' : n.kind;
          ctx.font        = `400 ${Math.max(8, n.r * 0.36)}px system-ui,sans-serif`;
          ctx.globalAlpha = alpha * 0.6;
          ctx.fillText(kindShort, n.x, n.y + n.r * 0.38, n.r * 1.8);
        }

        // 7. Floating full label
        ctx.font         = '500 10px system-ui,sans-serif';
        ctx.fillStyle    = cl.lbl;
        ctx.textBaseline = 'top';
        ctx.globalAlpha  = alpha * (isActive ? 0.85 : 0.55);
        ctx.fillText(n.id, n.x, n.y + n.r + 13, n.r * 5);

        ctx.restore();
      }

      ctx.restore();
    }

    function loop(t: number) {
      tick();
      draw(t);
      sim.rafId = requestAnimationFrame(loop);
    }
    sim.rafId = requestAnimationFrame(loop);

    // ── event handlers ──
    function onMouseMove(e: MouseEvent) {
      const [cx, cy] = canvasPos(e);
      const n = hitTest(cx, cy);
      sim.hovered = n?.uuid ?? null;
      canvas.style.cursor = n ? 'pointer' : (sim.drag || sim.panning ? 'grabbing' : 'default');
      if (sim.drag) {
        const [wx, wy] = toWorld(cx, cy);
        sim.drag.x = Math.max(30, Math.min(sim.W - 30, wx - sim.dragOx));
        sim.drag.y = Math.max(30, Math.min(sim.H - 30, wy - sim.dragOy));
      } else if (sim.panning) {
        sim.ox = sim.panOx0 + (cx - sim.panX0);
        sim.oy = sim.panOy0 + (cy - sim.panY0);
      }
    }

    function onMouseDown(e: MouseEvent) {
      const [cx, cy] = canvasPos(e);
      sim.downX = cx; sim.downY = cy;
      const n = hitTest(cx, cy);
      if (n) {
        const [wx, wy] = toWorld(cx, cy);
        sim.drag   = n;
        sim.dragOx = wx - n.x;
        sim.dragOy = wy - n.y;
        n.pinned = true; n.vx = 0; n.vy = 0;
      } else {
        sim.panning  = true;
        sim.panX0    = cx; sim.panY0  = cy;
        sim.panOx0   = sim.ox; sim.panOy0 = sim.oy;
        canvas.style.cursor = 'grabbing';
      }
    }

    function onMouseUp(e: MouseEvent) {
      const [cx, cy] = canvasPos(e);
      const moved = Math.hypot(cx - sim.downX, cy - sim.downY);
      if (sim.drag) {
        const clicked = sim.drag;
        clicked.pinned = false;
        sim.drag = null;
        if (moved < 5) cbRef.current(clicked);
      } else if (sim.panning) {
        sim.panning = false;
        canvas.style.cursor = 'default';
      }
    }

    function onMouseLeave() {
      sim.hovered = null;
      if (sim.drag) { sim.drag.pinned = false; sim.drag = null; }
      sim.panning = false;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      // If ctrlKey is pressed, treat as a pinch/zoom gesture (typically from trackpad pinch)
      if (e.ctrlKey) {
        // Zoom centered at canvas center for pinch gestures (more intuitive for trackpad pinch)
        const rect = canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const [wx, wy] = toWorld(cx, cy);
        const factor   = e.deltaY < 0 ? 1.1 : 0.9;
        const ns       = Math.max(0.3, Math.min(3.5, sim.scale * factor));
        sim.ox    = cx - wx * ns;
        sim.oy    = cy - wy * ns;
        sim.scale = ns;
      } else {
        // Two-finger swipe on trackpad usually emits wheel deltas without ctrlKey: treat as pan
        // deltaX/Y are in DOM pixels; apply directly to the viewport offset
        sim.ox += e.deltaX;
        sim.oy += e.deltaY;
      }
    }

    // ── touch gesture handling (two-finger pan + pinch to zoom) ──
    let touchState: {
      active: boolean;
      startDist: number;
      startCenter: { x: number; y: number };
      startOx: number;
      startOy: number;
      startScale: number;
    } = { active: false, startDist: 0, startCenter: { x: 0, y: 0 }, startOx: 0, startOy: 0, startScale: 1 };

    function getTouchPos(t: Touch) {
      const rect = canvas.getBoundingClientRect();
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t0 = getTouchPos(e.touches[0]);
        const t1 = getTouchPos(e.touches[1]);
        const cx = (t0.x + t1.x) / 2;
        const cy = (t0.y + t1.y) / 2;
        const dx = t0.x - t1.x;
        const dy = t0.y - t1.y;
        touchState.active = true;
        touchState.startDist = Math.hypot(dx, dy) || 1;
        touchState.startCenter = { x: cx, y: cy };
        touchState.startOx = sim.ox;
        touchState.startOy = sim.oy;
        touchState.startScale = sim.scale;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!touchState.active) return;
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const t0 = getTouchPos(e.touches[0]);
      const t1 = getTouchPos(e.touches[1]);
      const cx = (t0.x + t1.x) / 2;
      const cy = (t0.y + t1.y) / 2;
      const dx = t0.x - t1.x;
      const dy = t0.y - t1.y;
      const dist = Math.hypot(dx, dy) || 1;
      const scaleFactor = dist / touchState.startDist;
      // Damp pinch sensitivity so small finger movements don't cause big zoom jumps
      const PINCH_SENSITIVITY = 0.6; // 1.0 = original sensitivity; lower = less sensitive
      const dampedFactor = 1 + (scaleFactor - 1) * PINCH_SENSITIVITY;
      const ns = Math.max(0.3, Math.min(3.5, touchState.startScale * dampedFactor));

      // Compute world coordinates of the start center and preserve it while scaling; also allow center movement to pan
      const worldCx = (touchState.startCenter.x - touchState.startOx) / touchState.startScale;
      const worldCy = (touchState.startCenter.y - touchState.startOy) / touchState.startScale;

      // Update ox/oy so that the startCenter maps to the new center position (cx,cy) in screen space
      sim.ox = cx - worldCx * ns;
      sim.oy = cy - worldCy * ns;
      sim.scale = ns;
    }

    function onTouchEnd(e: TouchEvent) {
      if (touchState.active) {
        touchState.active = false;
      }
    }

  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('mousedown',  onMouseDown);
  canvas.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('wheel',      onWheel, { passive: false });
  // touch gestures
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
  canvas.addEventListener('touchend',   onTouchEnd);

    return () => {
      cancelAnimationFrame(sim.rafId);
      ro.disconnect();
  canvas.removeEventListener('mousemove',  onMouseMove);
  canvas.removeEventListener('mousedown',  onMouseDown);
  canvas.removeEventListener('mouseup',    onMouseUp);
  canvas.removeEventListener('mouseleave', onMouseLeave);
  canvas.removeEventListener('wheel',      onWheel);
  // touch gestures
  canvas.removeEventListener('touchstart', onTouchStart);
  canvas.removeEventListener('touchmove',  onTouchMove);
  canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetView() {
    const sim = simRef.current;
    sim.ox = 0; sim.oy = 0; sim.scale = 1;
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <button
        aria-label="Reset view"
        title="Reset view"
        onClick={resetView}
        style={{
          position: 'absolute', right: 10, top: 10,
          background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #333',
          padding: '6px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer'
        }}
      >
        Reset
      </button>
    </div>
  );
}

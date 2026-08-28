'use client';

import { useState } from 'react';
import { useYieldTrend } from '@/lib/hooks/useYieldTrend';

type Period = '7d' | '14d' | '30d';

const W = 560;
const H = 120;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

function buildPath(points: { day: string; yield: number }[]) {
  const ys = points.map((p) => p.yield);
  const minY = Math.min(...ys) - 1;
  const maxY = Math.max(...ys) + 1;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const toX = (i: number) => PAD_L + (i / (points.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - minY) / (maxY - minY)) * chartH;

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.yield).toFixed(1)}`)
    .join(' ');

  const area =
    `${line} L ${toX(points.length - 1).toFixed(1)} ${(PAD_T + chartH).toFixed(1)} ` +
    `L ${PAD_L.toFixed(1)} ${(PAD_T + chartH).toFixed(1)} Z`;

  return { line, area, toX, toY, minY, maxY };
}

const GRIDLINES = [90, 92, 94, 96, 98];

export function YieldChart() {
  const [period, setPeriod] = useState<Period>('7d');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { points, loading, error } = useYieldTrend(period);

  const hasData = points.length >= 2;
  const current = hasData ? points[points.length - 1].yield : null;
  const delta = hasData
    ? points[points.length - 1].yield - points[points.length - 2].yield
    : null;

  const path = hasData ? buildPath(points) : null;

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-[#f5f5f5]">Yield Trend</span>
          {current !== null && (
            <>
              <span className="text-[22px] font-semibold text-[#22c55e]">{current}%</span>
              {delta !== null && (
                <span className={`text-[11px] border px-2 py-0.5 rounded font-mono ${
                  delta >= 0
                    ? 'text-[#22c55e] bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.25)]'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/25'
                }`}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['7d', '14d', '30d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={
                'px-2.5 py-1 rounded text-[11px] font-mono transition-colors ' +
                (period === p
                  ? 'bg-[#1e1e1e] text-[#f5f5f5] border border-[#363636]'
                  : 'text-[#5a5a5a] hover:text-[#888888]')
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart body */}
      <div className="flex-1 px-2 py-2">
        {loading && (
          <div className="flex items-center justify-center h-[96px] text-[12px] text-[#5a5a5a] font-mono">
            Loading…
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center h-[96px] text-[12px] text-rose-400 font-mono px-4 text-center">
            {error}
          </div>
        )}
        {!loading && !error && !hasData && (
          <div className="flex items-center justify-center h-[96px] text-[12px] text-[#5a5a5a] font-mono">
            No yield data for this period
          </div>
        )}
        {!loading && !error && hasData && path && (
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            className="block overflow-visible"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Y-axis gridlines */}
            {GRIDLINES.map((v) => {
              const y = path.toY(v);
              return (
                <g key={v}>
                  <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#1e1e1e" strokeWidth="1" />
                  <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#5a5a5a" fontFamily="monospace">
                    {v}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            <path d={path.area} fill="url(#yieldGrad)" />

            {/* Line */}
            <path d={path.line} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />

            {/* Hover zones + dots */}
            {points.map((p, i) => {
              const x = path.toX(i);
              const y = path.toY(p.yield);
              const isHover = hoverIdx === i;
              return (
                <g key={p.day}>
                  <rect
                    x={x - 20}
                    y={PAD_T}
                    width={40}
                    height={H - PAD_T - PAD_B}
                    fill="transparent"
                    onMouseEnter={() => setHoverIdx(i)}
                  />
                  {isHover && (
                    <line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="3 3" />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHover ? 4 : 2.5}
                    fill={isHover ? '#22c55e' : '#16a34a'}
                    stroke={isHover ? '#0a0a0a' : 'none'}
                    strokeWidth="1.5"
                  />
                  {isHover && (
                    <g>
                      <rect x={x - 38} y={y - 28} width={76} height={20} rx="4" fill="#1e1e1e" stroke="#2a2a2a" />
                      <text x={x} y={y - 14} textAnchor="middle" fontSize="10" fill="#f5f5f5" fontFamily="monospace">
                        {p.yield}% · {p.day}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* X-axis labels — show day number only ("22" not "May 22") */}
            {points.map((p, i) => (
              <text
                key={p.day}
                x={path.toX(i)}
                y={H - 4}
                textAnchor="middle"
                fontSize="9"
                fill="#5a5a5a"
                fontFamily="monospace"
              >
                {p.day.split(' ').pop()}
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

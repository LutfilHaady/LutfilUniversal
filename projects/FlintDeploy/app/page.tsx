'use client';

import Link from 'next/link';

// ── Path generation ──────────────────────────────
function makePaths(position: number) {
  return Array.from({ length: 36 }, (_, i) => {
    const d =
      `M-${380 - i * 5 * position} -${189 + i * 6}` +
      `C-${380 - i * 5 * position} -${189 + i * 6}` +
      ` -${312 - i * 5 * position} ${216 - i * 6}` +
      ` ${152 - i * 5 * position} ${343 - i * 6}` +
      `C${616 - i * 5 * position} ${470 - i * 6}` +
      ` ${684 - i * 5 * position} ${875 - i * 6}` +
      ` ${684 - i * 5 * position} ${875 - i * 6}`;
    const opacity = (0.04 + (i / 35) * 0.22).toFixed(3);
    return {
      id: i,
      d,
      stroke: `rgba(34,197,94,${opacity})`,
      strokeWidth: 0.5 + i * 0.03,
      animDuration: `${22 + (i % 7) * 2.5}s`,
      animDelay:    `${-(i * 1.1).toFixed(1)}s`,
    };
  });
}

const paths1 = makePaths(1);
const paths2 = makePaths(-1);

// ── Sub-components ───────────────────────────────
function FlintLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-label="Flint Labs">
        <rect x="3" y="3" width="2.5" height="18" rx="1" fill="#f5f5f5" />
        <rect x="3" y="3" width="13.5" height="2.5" rx="1" fill="#f5f5f5" />
        <rect x="3" y="11" width="9.5" height="2.5" rx="1" fill="#f5f5f5" />
        <circle cx="18" cy="4.25" r="2.6" fill="#22c55e" />
        <circle cx="14" cy="12.25" r="1.9" fill="#22c55e" />
      </svg>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.04em', color: '#f5f5f5', textTransform: 'uppercase' }}>
          Flint
        </span>
        <span style={{ fontSize: 10, fontWeight: 500, color: '#5a5a5a', fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Labs
        </span>
      </div>
    </div>
  );
}

interface DataChipProps {
  batchId: string;
  status: string;
  color: string;
  style?: React.CSSProperties;
}

function DataChip({ batchId, status, color, style }: DataChipProps) {
  return (
    <div style={{
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      background: 'rgba(22,22,22,0.9)',
      border: '1px solid #2a2a2a',
      borderRadius: 6,
      backdropFilter: 'blur(8px)',
      opacity: 0.6,
      pointerEvents: 'none',
      ...style,
    }}>
      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, color: '#5a5a5a', letterSpacing: '0.02em' }}>
        {batchId}
      </span>
      <span style={{ width: 1, height: 10, background: '#2a2a2a', flexShrink: 0 }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 5, height: 5, background: color, borderRadius: '50%' }} />
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color }}>{status}</span>
      </span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0a',
      position: 'relative',
      fontFamily: 'var(--font-sans), Inter, -apple-system, sans-serif',
      WebkitFontSmoothing: 'antialiased',
      color: '#f5f5f5',
    }}>

      {/* Layer 0: Animated paths */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }} aria-hidden="true">
        <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice">
          {[...paths1, ...paths2].map((p, idx) => (
            <path
              key={idx}
              d={p.d}
              fill="none"
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              strokeDasharray="480 2200"
              style={{
                animationName: 'flowPath',
                animationDuration: p.animDuration,
                animationDelay: p.animDelay,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              }}
            />
          ))}
        </svg>
      </div>

      {/* Layer 1: Dot-grid texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: 'radial-gradient(circle, #282828 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity: 0.5,
      }} aria-hidden="true" />

      {/* Layer 2: Radial vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 20%, rgba(10,10,10,0.5) 100%)',
      }} aria-hidden="true" />

      {/* Nav */}
      <nav style={{
        position: 'relative', zIndex: 20, flexShrink: 0, height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px',
        borderBottom: '1px solid #2a2a2a',
        background: 'rgba(10,10,10,0.8)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 4px 24px rgba(34,197,94,0.04)',
      }}>
        <FlintLogo />
        <Link
          href="/login"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 18px',
            background: '#22c55e',
            borderRadius: 6,
            color: '#0a0a0a',
            fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 0 16px rgba(34,197,94,0.22)',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#16a34a')}
          onMouseLeave={e => (e.currentTarget.style.background = '#22c55e')}
        >
          Log In <span style={{ fontSize: 11 }}>→</span>
        </Link>
      </nav>

      {/* Hero */}
      <main style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        position: 'relative', zIndex: 10,
      }}>
        {/* Ambient data chips — desktop only */}
        <DataChip batchId="CTGC-20260528-B02" status="Completed" color="#22c55e" style={{ top: '16%', left: '5%' }} />
        <DataChip batchId="CTGC-20260601-C04" status="On Hold"   color="#f59e0b" style={{ bottom: '20%', right: '5%' }} />

        {/* Hero content */}
        <div style={{ textAlign: 'center', maxWidth: 560 }}>

          {/* Eyebrow pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px',
            background: '#161616',
            border: '1px solid #2a2a2a',
            borderRadius: 999,
            marginBottom: 28,
          }}>
            <span style={{
              width: 6, height: 6, background: '#22c55e', borderRadius: '50%', flexShrink: 0,
              animationName: 'livePulse', animationDuration: '1.5s',
              animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
            }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#888888', letterSpacing: '0.015em', whiteSpace: 'nowrap' }}>
              Battery Manufacturing Traceability
            </span>
          </div>

          {/* H1 */}
          <h1 style={{
            margin: '0 0 16px', padding: 0,
            fontSize: 'clamp(34px, 5vw, 62px)',
            fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.025em',
            color: '#f5f5f5',
          }}>
            Every batch.<br />
            Every step.<br />
            <span style={{ color: '#22c55e' }}>Fully traced.</span>
          </h1>

          {/* Subtext */}
          <p style={{ margin: '0 auto', fontSize: 15, lineHeight: 1.7, color: '#888888', maxWidth: 420 }}>
            Precision traceability for battery cell manufacturers — QC gates, audit logs,
            and full batch genealogy from raw material to finished cell.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 20, flexShrink: 0, height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderTop: '1px solid #2a2a2a',
        padding: '0 40px',
      }}>
        <span style={{ fontSize: 12, color: '#5a5a5a', letterSpacing: '0.01em' }}>
          © 2026 Flint Labs. All rights reserved.
        </span>
      </footer>
    </div>
  );
}

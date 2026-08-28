interface PhoneFrameProps {
  children: React.ReactNode;
  time?: string;
}

export function PhoneFrame({ children, time = '11:42' }: PhoneFrameProps) {
  return (
    <div
      style={{
        width: 390, height: 844, borderRadius: 48,
        background: '#0a0a0a',
        boxShadow: '0 0 0 11px #1c1c1c, 0 0 0 12px #2a2a2a, 0 40px 80px rgba(0,0,0,0.5)',
        position: 'relative', overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif', flexShrink: 0,
      }}
    >
      <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 120, height: 35, borderRadius: 22, background: '#000', zIndex: 50 }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px 0', color: '#fff', fontSize: 15, fontWeight: 600 }}>
        <span>{time}</span>
        <div style={{ width: 120 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.5" fill="#fff"/><rect x="4.5" y="5" width="3" height="6" rx="0.5" fill="#fff"/><rect x="9" y="2.5" width="3" height="8.5" rx="0.5" fill="#fff"/><rect x="13.5" y="0" width="3" height="11" rx="0.5" fill="#fff"/></svg>
          <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#fff" strokeOpacity=".5" fill="none"/><rect x="2" y="2" width="19" height="8" rx="1.5" fill="#fff"/><rect x="23" y="4" width="1.5" height="4" rx=".5" fill="#fff" opacity=".5"/></svg>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, paddingTop: 50, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, borderRadius: 3, background: '#fff', zIndex: 50 }} />
    </div>
  );
}

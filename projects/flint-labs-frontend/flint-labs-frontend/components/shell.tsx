'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

interface ShellProps {
  title?: string;
  subtitle?: string;
  titleNode?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export function Shell({ title, subtitle, titleNode, headerActions, children }: ShellProps) {
  // Always start from the SSR default (expanded) so the first client render
  // matches the server and hydration succeeds. The stored value is applied in
  // the mount effect below, after hydration.
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  // Read the persisted value once, after mount (client-only).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sidebar.collapsed') === '1');
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist on change — gated on `hydrated` so the initial render's default
  // doesn't clobber the stored value before it's been read.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('sidebar.collapsed', collapsed ? '1' : '0');
      // also broadcast to other tabs
      window.dispatchEvent(new CustomEvent('sidebar:collapsed', { detail: { collapsed } }));
    } catch {
      // ignore
    }
  }, [collapsed, hydrated]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'sidebar.collapsed') {
        setCollapsed(e.newValue === '1');
      }
    }
    function onBroadcast(e: Event) {
      // support the custom event
      const ev = e as CustomEvent;
      if (ev?.detail?.collapsed !== undefined) setCollapsed(Boolean(ev.detail.collapsed));
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('sidebar:collapsed', onBroadcast as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('sidebar:collapsed', onBroadcast as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-[#0a0a0a] text-[#f5f5f5]">
  <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header title={title} subtitle={subtitle} titleNode={titleNode} actions={headerActions} />
        {children}
      </div>
    </div>
  );
}

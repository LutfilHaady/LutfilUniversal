'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconBell, IconChevronDown,
  IconUser, IconLock, IconLogOut,
} from '@/components/icons';
import { useAuth } from '@/lib/auth-context';
import { useAlerts } from '@/lib/hooks/useAlerts';
import { CommandPalette } from '@/components/command-palette';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  titleNode?: React.ReactNode;
  actions?: React.ReactNode;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function ProfileMenu() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.replace('/');
  }

  // While auth is loading show a minimal placeholder to avoid layout shift
  if (!user) {
    return (
      <div className="ml-2 pl-3 border-l border-[#2a2a2a] h-9 flex items-center">
        <div className="w-8 h-8 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] animate-pulse" />
      </div>
    );
  }

  const initials = getInitials(user.name);

  return (
    <div ref={containerRef} className="relative ml-2 pl-3 border-l border-[#2a2a2a] h-9 flex items-center">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2.5 rounded-md px-2 py-1 -mx-2 -my-1 hover:bg-[#1c1c1c] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22c55e] focus-visible:outline-offset-1"
      >
        <div className="w-8 h-8 rounded-full bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.4)] text-[#22c55e] text-[11px] font-semibold flex items-center justify-center shrink-0 overflow-hidden">
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            : initials}
        </div>
        <div className="leading-tight pr-0.5 max-md:hidden">
          <div className="text-[12.5px] font-medium text-[#f5f5f5]">{user.name}</div>
          <div className="text-[10.5px] text-[#888888] font-mono">{user.role}</div>
        </div>
        <IconChevronDown
          size={14}
          className={`text-[#888888] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[240px] rounded-lg bg-[#161616] border border-[#2a2a2a] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3.5 flex items-start gap-3">
            <div className="mt-0.5 w-9 h-9 shrink-0 rounded-full bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.4)] text-[#22c55e] text-[12px] font-semibold flex items-center justify-center overflow-hidden">
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#f5f5f5] truncate">{user.name}</div>
              <div className="text-[11px] text-[#888888] font-mono mt-0.5">{user.role}</div>
              <div className="text-[11px] text-[#5a5a5a] truncate mt-0.5">{user.email}</div>
            </div>
          </div>

          <div className="h-px bg-[#2a2a2a]" />

          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1c1c1c] transition-colors"
            >
              <IconUser size={15} />
              <span>Profile Settings</span>
            </Link>
            <Link
              href="/profile#security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-[13px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#1c1c1c] transition-colors"
            >
              <IconLock size={15} />
              <span>Change Password</span>
            </Link>
          </div>

          <div className="h-px bg-[#2a2a2a]" />

          <div className="py-1">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-rose-400 hover:text-rose-300 hover:bg-[#1c1c1c] transition-colors text-left"
            >
              <IconLogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { alerts: activeAlerts } = useAlerts();
  const hasAlerts = activeAlerts.length > 0;
  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningCount  = activeAlerts.filter(a => a.severity === 'warning').length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative h-9 w-9 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] hover:text-[#f5f5f5] flex items-center justify-center"
        title="Alerts"
      >
        <IconBell size={15} />
        {hasAlerts && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[280px] rounded-lg bg-[#161616] border border-[#2a2a2a] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#f5f5f5]">Alerts</span>
            {hasAlerts && (
              <div className="flex items-center gap-1.5">
                {criticalCount > 0 && (
                  <span className="text-[10px] font-mono text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded">
                    {criticalCount} critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                    {warningCount} warning
                  </span>
                )}
              </div>
            )}
          </div>

          {!hasAlerts ? (
            <div className="px-4 py-6 flex flex-col items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-[12.5px] text-[#888888]">No alerts</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {activeAlerts.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-[#1e1e1e] last:border-0">
                  <span className={`text-[10px] mt-0.5 shrink-0 ${a.severity === 'critical' ? 'text-red-400' : a.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>
                    ●
                  </span>
                  <p className="text-[11.5px] text-[#888888] leading-snug flex-1 line-clamp-2">{a.message}</p>
                </div>
              ))}
              <div className="px-4 py-2.5 border-t border-[#1e1e1e]">
                <Link href="/alerts" onClick={() => setOpen(false)} className="text-[11.5px] text-[#93c5fd] hover:text-white transition-colors">
                  View all alerts →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ title, subtitle, titleNode, actions }: HeaderProps) {
  return (
    <header className="h-[60px] shrink-0 border-b border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between px-6">
      <div className="flex items-center gap-3 min-w-0 max-md:hidden">
        {titleNode ?? (
          <>
            <h1 className="text-[20px] font-semibold tracking-tight text-[#f5f5f5]">{title}</h1>
            {subtitle && <span className="text-[#888888] text-[12px] font-mono">{subtitle}</span>}
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div className="max-md:hidden">
          <CommandPalette />
        </div>
        <AlertButton />
        <ProfileMenu />
      </div>
    </header>
  );
}

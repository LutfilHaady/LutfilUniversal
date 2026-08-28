'use client';

import Link from 'next/link';
import { IconSearch, IconRefresh, IconBell, IconChevronDown, IconQR } from '@/components/icons';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  titleNode?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, titleNode, actions }: HeaderProps) {
  return (
    <header className="h-[60px] shrink-0 border-b border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between px-6">
      <div className="flex items-center gap-3 min-w-0">
        {titleNode ?? (
          <>
            <h1 className="text-[20px] font-semibold tracking-tight text-[#f5f5f5]">{title}</h1>
            {subtitle && <span className="text-[#888888] text-[12px] font-mono">{subtitle}</span>}
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888] w-[260px]">
          <IconSearch size={15} />
          <span className="flex-1">Search batches, lots, recipes…</span>
          <kbd className="font-mono text-[10px] text-[#5a5a5a] border border-[#363636] rounded px-1.5 py-0.5">⌘K</kbd>
        </div>
        <Link
          href="/scan"
          className="h-9 w-9 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] hover:text-[#f5f5f5] flex items-center justify-center"
          title="Scan QR"
        >
          <IconQR size={15} />
        </Link>
        <button className="h-9 w-9 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] hover:text-[#f5f5f5] flex items-center justify-center" title="Refresh">
          <IconRefresh size={15} />
        </button>
        <button className="relative h-9 w-9 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] hover:text-[#f5f5f5] flex items-center justify-center" title="Alerts">
          <IconBell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 pulse-red" />
        </button>
        <div className="ml-2 flex items-center gap-2.5 pl-3 border-l border-[#2a2a2a] h-9">
          <div className="w-8 h-8 rounded-full bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.4)] text-[#22c55e] text-[11px] font-semibold flex items-center justify-center">
            KC
          </div>
          <div className="leading-tight pr-1">
            <div className="text-[12.5px] font-medium text-[#f5f5f5]">Kenji Chen</div>
            <div className="text-[10.5px] text-[#888888] font-mono">Engineer · Lvl 3</div>
          </div>
          <IconChevronDown size={14} className="text-[#888888]" />
        </div>
      </div>
    </header>
  );
}

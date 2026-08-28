'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconDashboard, IconBatches, IconLots, IconRecall,
  IconReports, IconRecipes, IconMachines, IconAdmin,
  IconClipboard, IconChevronLeft, IconChevronRight, IconMaterials,
} from '@/components/icons';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconDashboard, href: '/dashboard' },
  { id: 'log',       label: 'Process Log', Icon: IconClipboard, href: '/log' },
  { id: 'batches',   label: 'Batches',   Icon: IconBatches,   href: '/batches', mobileVisible: true },
  { id: 'lots',      label: 'Lots',      Icon: IconLots,      href: '/lots' },
  { id: 'recall',    label: 'Recall',    Icon: IconRecall,    href: '/recall' },
  { id: 'reports',   label: 'Reports',   Icon: IconReports,   href: '/reports', mobileVisible: true },
  { id: 'recipes',   label: 'Recipes',   Icon: IconRecipes,   href: '/recipes', mobileVisible: true },
  { id: 'machines',   label: 'Machines',   Icon: IconMachines,   href: '/machines' },
  { id: 'materials',  label: 'Materials',  Icon: IconMaterials,  href: '/materials', mobileVisible: true },
  { id: 'admin',      label: 'Admin',      Icon: IconAdmin,      href: '/admin' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const VISIBLE_IDS: Record<'Operator' | 'Engineer' | 'Admin', Set<string>> = {
  Operator: new Set(['dashboard', 'log', 'batches', 'lots', 'recipes', 'machines', 'materials']),
  Engineer: new Set(['dashboard', 'log', 'batches', 'lots', 'recall', 'reports', 'recipes', 'machines', 'materials']),
  Admin:    new Set(['dashboard', 'log', 'batches', 'lots', 'recall', 'reports', 'recipes', 'machines', 'materials', 'admin']),
};

import { useState, useEffect } from 'react';

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  const role = (user?.role ?? 'Operator') as 'Operator' | 'Engineer' | 'Admin';
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const visibleIds = VISIBLE_IDS[role] ?? VISIBLE_IDS['Operator'];
  
  const filteredNav = NAV.filter(({ id, mobileVisible }) => {
    if (!visibleIds.has(id)) return false;
    if (isMobile && !mobileVisible) return false;
    return true;
  });

  // slightly wider collapsed width so the toggle button sits next to the logo without being clipped
  const w = collapsed ? 'w-[92px]' : 'w-[228px]';

  return (
    <aside className={`${w} relative shrink-0 border-r border-[#2a2a2a] bg-[#0a0a0a] flex flex-col transition-[width] duration-200 ease-out`}>

      {/* Toggle button floating on the right border */}
      <button
        onClick={onToggle}
        className="absolute -right-3.5 top-[30px] z-20 w-7 h-7 rounded-full bg-[#161616] border border-[#2a2a2a] flex items-center justify-center text-[#888888] hover:text-[#f5f5f5] hover:border-[#3a3a3a] transition-colors shadow-md"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <IconChevronRight size={12} /> : <IconChevronLeft size={12} />}
      </button>

      <div className={`h-[60px] flex items-center border-b border-[#2a2a2a] ${collapsed ? 'justify-center px-3' : 'px-5'}`}>
        {collapsed ? (
          <div 
            className="w-[26px] h-[29px] shrink-0" 
            style={{ 
              backgroundImage: 'url(/flint_logo_transparent.png)',
              backgroundSize: 'auto 29px',
              backgroundPosition: '-1.5px center',
              backgroundRepeat: 'no-repeat'
            }}
          />
        ) : (
          <Image
            src="/flint_logo_transparent.png"
            alt="Flint"
            width={108}
            height={29}
            className="object-contain object-left"
          />
        )}
      </div>

      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
        {filteredNav.map(({ id, label, Icon, href, mobileVisible }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={id}
              href={href}
              title={collapsed ? label : undefined}
              className={
                `nav-item group relative flex items-center gap-3 rounded-md text-[13px] transition ` +
                (collapsed ? 'h-10 justify-center px-0' : 'h-9 px-3') +
                (active
                  ? ' bg-[#161616] text-[#f5f5f5] border border-[#363636]'
                  : ' text-[#888888] hover:text-[#f5f5f5] hover:bg-[#161616] border border-transparent')
              }
            >
              {active && !collapsed && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[#22c55e]" />
              )}
              <Icon size={18} className={active ? 'text-[#22c55e]' : ''} />
              {!collapsed && <span className="flex-1 text-left">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-[#2a2a2a] ${collapsed ? 'p-2' : 'p-3'} flex flex-col gap-1`}>
        <Link
          href="/profile"
          aria-label="Profile"
          title="Profile"
          className={
            'flex items-center gap-3 rounded-md transition hover:bg-[#161616] ' +
            (collapsed ? 'h-10 justify-center px-0' : 'h-10 px-3')
          }
        >
          <div className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-[11px] font-semibold font-mono text-[#f5f5f5] shrink-0 overflow-hidden">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              : initials}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[12.5px] font-medium text-[#f5f5f5] truncate">{user?.name ?? '—'}</span>
              <span className="text-[10.5px] text-[#5a5a5a]">{user?.role ?? ''}</span>
            </div>
          )}
        </Link>
        {!collapsed && (
          <div className="px-3 py-1 text-[10px] font-mono text-[#5a5a5a] leading-relaxed">
            <div>BUILD 2026.04.30</div>
            <div>SHIFT · DAY (07–19)</div>
          </div>
        )}
      </div>
    </aside>
  );
}

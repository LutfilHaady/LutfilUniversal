'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconDashboard, IconBatches, IconLots, IconRecall,
  IconReports, IconRecipes, IconMachines, IconAdmin,
  IconChevronLeft, IconChevronRight,
} from '@/components/icons';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconDashboard, href: '/' },
  { id: 'batches',   label: 'Batches',   Icon: IconBatches,   href: '/batches' },
  { id: 'lots',      label: 'Lots',      Icon: IconLots,      href: '/lots' },
  { id: 'recall',    label: 'Recall',    Icon: IconRecall,    href: '/recall' },
  { id: 'reports',   label: 'Reports',   Icon: IconReports,   href: '/reports' },
  { id: 'recipes',   label: 'Recipes',   Icon: IconRecipes,   href: '/recipes' },
  { id: 'machines',  label: 'Machines',  Icon: IconMachines,  href: '/machines', badge: 2 },
  { id: 'admin',     label: 'Admin',     Icon: IconAdmin,     href: '/admin' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const w = collapsed ? 'w-[68px]' : 'w-[228px]';

  return (
    <aside className={`${w} shrink-0 border-r border-[#2a2a2a] bg-[#0a0a0a] flex flex-col transition-[width] duration-200 ease-out`}>
      <div className={`h-[60px] flex items-center border-b border-[#2a2a2a] ${collapsed ? 'justify-center' : 'px-5'}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.4)] flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-[0.16em] text-[#f5f5f5]">FLINT</div>
              <div className="text-[10px] text-[#888888] tracking-wider uppercase">Traceability</div>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
        {NAV.map(({ id, label, Icon, href, badge }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={id}
              href={href}
              title={collapsed ? label : undefined}
              className={
                'nav-item group relative flex items-center gap-3 rounded-md text-[13px] transition ' +
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
              {!collapsed && badge && (
                <span className="text-[10px] font-mono text-amber-300/90 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  {badge}
                </span>
              )}
              {collapsed && badge && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-[#2a2a2a] ${collapsed ? 'p-2' : 'p-3'}`}>
        <button
          onClick={onToggle}
          className={
            'w-full flex items-center gap-2 rounded-md text-[12px] text-[#888888] hover:text-[#f5f5f5] hover:bg-[#161616] ' +
            (collapsed ? 'h-9 justify-center' : 'h-9 px-3')
          }
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed
            ? <IconChevronRight size={16} />
            : <><IconChevronLeft size={16} /><span>Collapse</span></>}
        </button>
        {!collapsed && (
          <div className="mt-2 px-3 py-2 text-[10px] font-mono text-[#5a5a5a] leading-relaxed">
            <div>BUILD 2026.04.30</div>
            <div>SHIFT · DAY (07–19)</div>
          </div>
        )}
      </div>
    </aside>
  );
}

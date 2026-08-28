'use client';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/supabaseClient';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  BarChartHorizontal,
  BookOpen,
  Milestone,
  LogOut,
  Settings,
} from 'lucide-react';
import { Logo } from '@/components/icons';

const links = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/trends', icon: BarChartHorizontal, label: 'Industry Comparison' },
  { href: '/courses', icon: BookOpen, label: 'Courses' },
  { href: '/roadmap', icon: Milestone, label: 'Roadmap' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="block">
          <Logo className="group-data-[collapsible=icon]:hidden"/>
          <LayoutDashboard className="hidden group-data-[collapsible=icon]:block"/>
        </Link>
      </SidebarHeader>
      <SidebarMenu className="flex-1">
        {links.map((link) => (
          <SidebarMenuItem key={link.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith(link.href)}
              tooltip={link.label}
            >
              <Link href={link.href}>
                <link.icon />
                <span>{link.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="#">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}>
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

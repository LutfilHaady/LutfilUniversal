'use client';

import { useState } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);
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

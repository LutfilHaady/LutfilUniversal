import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Header } from '@/components/layout/header';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarNav />
        </Sidebar>
        <SidebarInset>
          <div className="flex flex-1 flex-col">
            <Header />
            <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

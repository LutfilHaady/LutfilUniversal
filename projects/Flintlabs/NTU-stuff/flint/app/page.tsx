'use client';

import { useState } from 'react';
import { Shell } from '@/components/shell';
import { AlertBanner } from '@/components/dashboard/alert-banner';
import { AlertPanel } from '@/components/dashboard/alert-panel';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { SubBatchTable } from '@/components/dashboard/sub-batch-table';
import { YieldChart } from '@/components/dashboard/yield-chart';

export default function DashboardPage() {
  const [bannerVisible, setBannerVisible] = useState(true);

  return (
    <Shell title="Dashboard">
      {bannerVisible && <AlertBanner onDismiss={() => setBannerVisible(false)} />}
      <main className="flex-1 min-h-0 px-6 py-5 flex flex-col gap-5 overflow-y-auto">
        <KpiCards />

        <div className="grid gap-5 min-h-0" style={{ gridTemplateColumns: '1.85fr 1fr' }}>
          {/* Left — table */}
          <SubBatchTable />

          {/* Right — chart stacked above alerts */}
          <div className="flex flex-col gap-5 min-h-0">
            <YieldChart />
            <AlertPanel />
          </div>
        </div>

        <footer className="pt-2 pb-1 flex items-center justify-between text-[11px] font-mono text-[#5a5a5a]">
          <span>FLINT TRACEABILITY v2 · BUILD 2026.04.30</span>
          <span>SHIFT DAY · 11:42 SGT · ALL SYSTEMS NOMINAL</span>
        </footer>
      </main>
    </Shell>
  );
}

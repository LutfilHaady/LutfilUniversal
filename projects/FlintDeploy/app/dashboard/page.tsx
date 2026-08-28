'use client';

import { useState } from 'react';
import { Shell } from '@/components/shell';
import { AlertBanner } from '@/components/dashboard/alert-banner';
import { AlertPanel } from '@/components/dashboard/alert-panel';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { ActiveRunChip } from '@/components/dashboard/active-run-chip';
import { SubBatchTable } from '@/components/dashboard/sub-batch-table';
import { YieldChart } from '@/components/dashboard/yield-chart';
import { DataState } from '@/components/data-state';
import { useDashboard } from '@/lib/hooks/useDashboard';

export default function DashboardPage() {
  const [bannerVisible, setBannerVisible] = useState(true);
  const { subBatches, alerts, qcPassRateSevenDay, firstPassYield, topDefect, activeAlertCount, loading, error } = useDashboard();

  return (
    <Shell title="Dashboard">
      {bannerVisible && <AlertBanner onDismiss={() => setBannerVisible(false)} />}
      <main className="flex-1 min-h-0 px-6 py-5 flex flex-col gap-5 overflow-y-auto">
        <DataState loading={loading} error={error}>
          <ActiveRunChip />
          <KpiCards
            subBatches={subBatches}
            qcPassRateSevenDay={qcPassRateSevenDay}
            firstPassYield={firstPassYield}
            topDefect={topDefect}
            activeAlertCount={activeAlertCount}
          />
          <div className="grid gap-5 min-h-0" style={{ gridTemplateColumns: '1.85fr 1fr' }}>
            <SubBatchTable subBatches={subBatches} />
            <div className="flex flex-col gap-5 min-h-0">
              <YieldChart />
              <AlertPanel />
            </div>
          </div>
        </DataState>
        <footer className="pt-2 pb-1 flex items-center justify-between text-[11px] font-mono text-[#5a5a5a]">
          <span>FLINT TRACEABILITY v2 · BUILD 2026.04.30</span>
          <span>SHIFT DAY · 11:42 SGT · ALL SYSTEMS NOMINAL</span>
        </footer>
      </main>
    </Shell>
  );
}

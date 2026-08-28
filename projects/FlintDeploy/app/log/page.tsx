'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shell } from '@/components/shell';
import { GenericProcessLog } from '@/components/log/generic-process-log';
import { ActiveRunDrawer } from '@/components/log/active-run-drawer';

export default function LogPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a]" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('subbatchId');
  const initialNumber = searchParams.get('batchNumber');

  return (
    <Shell title="Process Log">
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="w-full mx-auto md:max-w-[640px] flex-1 flex flex-col min-h-0">
          <GenericProcessLog
            initialBatchId={initialId}
            initialBatchNumber={initialNumber}
          />
          <ActiveRunDrawer />
        </div>
      </main>
    </Shell>
  );
}

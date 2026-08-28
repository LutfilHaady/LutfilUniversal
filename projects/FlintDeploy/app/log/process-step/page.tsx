'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GenericProcessLog } from '@/components/log/generic-process-log';
import { ActiveRunDrawer } from '@/components/log/active-run-drawer';

export default function ProcessStepPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0a]" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subbatchId = searchParams.get('subbatchId');
  const batchNumber = searchParams.get('batchNumber');
  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto md:max-w-[640px]">
        <GenericProcessLog
          initialBatchId={subbatchId}
          initialBatchNumber={batchNumber}
          onDone={() => router.back()}
        />
        <ActiveRunDrawer />
      </div>
    </div>
  );
}

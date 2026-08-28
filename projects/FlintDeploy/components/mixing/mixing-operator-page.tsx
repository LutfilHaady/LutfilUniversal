'use client';

import { useRouter } from 'next/navigation';
import { IconChevronLeft } from '@/components/icons';
import { MixingWorkspace } from '@/components/mixing/mixing-workspace';

interface Props {
  batchId: string;
}

export function MixingOperatorPage({ batchId }: Props) {
  const router = useRouter();
  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto md:max-w-[640px]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#f5f5f5] hover:bg-[#161616] transition-colors"
          >
            <IconChevronLeft size={22} />
          </button>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Mixing Log</div>
            <div className="text-[15px] font-semibold text-[#f5f5f5] font-mono">{batchId}</div>
          </div>
        </div>
        <MixingWorkspace batchId={batchId} />
      </div>
    </div>
  );
}

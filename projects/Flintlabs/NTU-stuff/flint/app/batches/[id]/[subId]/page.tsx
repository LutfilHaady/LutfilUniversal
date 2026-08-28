import Link from 'next/link';
import { Shell } from '@/components/shell';
import { IconChevronRight } from '@/components/icons';
import { IdentityHeader } from '@/components/subbatch/identity-header';
import { ProcessStepper } from '@/components/subbatch/process-stepper';
import { ProcessTimeline } from '@/components/subbatch/process-timeline';
import { Genealogy } from '@/components/subbatch/genealogy';
import { SUBBATCH_DETAIL } from '@/lib/data';

export default function SubBatchDetailPage() {
  const d = SUBBATCH_DETAIL;

  const breadcrumb = (
    <div className="flex items-center gap-2 min-w-0">
      <Link href="/batches" className="text-[#888888] hover:text-[#f5f5f5] text-[13px] font-medium transition-colors">
        Batches
      </Link>
      <IconChevronRight size={13} className="text-[#5a5a5a] shrink-0" />
      <Link href="/batches" className="text-[#888888] hover:text-[#f5f5f5] font-mono text-[12.5px] transition-colors">
        {d.parentId}
      </Link>
      <IconChevronRight size={13} className="text-[#5a5a5a] shrink-0" />
      <span className="font-mono text-[12.5px] text-[#f5f5f5] truncate">{d.id}</span>
    </div>
  );

  return (
    <Shell titleNode={breadcrumb}>
      <main className="flex-1 min-h-0 px-6 py-5 flex flex-col gap-5 overflow-y-auto">
        <IdentityHeader />
        <ProcessStepper />

        <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)' }}>
          <ProcessTimeline />
          <Genealogy />
        </div>

        <footer className="pt-2 pb-1 flex items-center justify-between text-[11px] font-mono text-[#5a5a5a]">
          <span>FLINT TRACEABILITY v2 · BUILD 2026.04.30</span>
          <span>SHIFT DAY · 11:42 SGT · ALL SYSTEMS NOMINAL</span>
        </footer>
      </main>
    </Shell>
  );
}

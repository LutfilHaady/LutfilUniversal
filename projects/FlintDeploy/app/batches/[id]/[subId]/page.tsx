'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { IconChevronRight, IconChevronLeft } from '@/components/icons'
import { IdentityHeader } from '@/components/subbatch/identity-header'
import { ProcessStepper } from '@/components/subbatch/process-stepper'
import { ProcessTimeline } from '@/components/subbatch/process-timeline'
import { Genealogy } from '@/components/subbatch/genealogy'
import { MixingStepsPanel } from '@/components/subbatch/mixing-steps-panel'
import { DataState } from '@/components/data-state'
import { useBatch } from '@/lib/hooks/useBatch'
import { useProcessRoute } from '@/lib/hooks/useProcessRoute'
import supabase from '@/lib/supabase'
import type { MixingStep, MixingStepType, MixingStepStatus } from '@/lib/types'

export default function SubBatchDetailPage() {
  const params = useParams<{ id: string; subId: string }>()
  const { batch, loading, error } = useBatch(params?.subId ?? '')
  const { batch: parentBatch } = useBatch(params?.id ?? '')
  const { steps } = useProcessRoute(batch?.material_id ?? null)

  const [mixingSteps, setMixingSteps]   = useState<MixingStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);

  useEffect(() => {
    if (!batch?.id) return;
    let cancelled = false;
    setStepsLoading(true);
    supabase
      .from('mixing_steps')
      .select('*')
      .eq('batch_id', batch.id)
      .order('step_number', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setMixingSteps(
            data.map((row) => ({
              id:         row.id,
              type:       row.type as MixingStepType,
              stepNumber: row.step_number,
              label:      row.label,
              displayRef: row.display_ref,
              status:     row.status as MixingStepStatus,
              params:     row.params,
              operator:   row.operator,
              timestamp:  row.created_at,
            }))
          );
        }
        setStepsLoading(false);
      });
    return () => { cancelled = true; };
  }, [batch?.id]);

  const isMixingBatch = steps.some(s => s.code === 'MIXC' || s.code === 'MIXE')
  const parentBatchNumber = batch?.parent_batch?.batch_number ?? parentBatch?.batch_number ?? params.id

  const breadcrumb = (
    <div className="flex items-center gap-2 min-w-0">
      <Link href="/batches" className="text-[#888888] hover:text-[#f5f5f5] text-[13px] font-medium transition-colors">
        Batches
      </Link>
      <IconChevronRight size={13} className="text-[#5a5a5a] shrink-0" />
      <Link href={`/batches/${params.id}`} className="text-[#888888] hover:text-[#f5f5f5] font-mono text-[12.5px] transition-colors">
        {parentBatchNumber}
      </Link>
      <IconChevronRight size={13} className="text-[#5a5a5a] shrink-0" />
      <span className="font-mono text-[12.5px] text-[#f5f5f5] truncate">{batch?.batch_number ?? 'ID not available'}</span>
    </div>
  )

  return (
    <Shell titleNode={breadcrumb}>
      <main className="flex-1 min-h-0 px-6 py-5 flex flex-col gap-5 overflow-y-auto">
        <DataState loading={loading} error={error} empty={!batch} emptyMessage="Sub-batch not found">
          {batch && (
            <>
              <Link
                href={`/batches/${params.id}`}
                className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors mb-1"
                aria-label={`Back to ${parentBatchNumber}`}
              >
                <IconChevronLeft size={14} />
                <span>Back to {parentBatchNumber}</span>
              </Link>
              <IdentityHeader batch={batch} />
              <ProcessStepper steps={steps} />
              <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)' }}>
                {isMixingBatch ? (
                  <MixingStepsPanel
                    batchId={batch.id}
                    parentBatchId={parentBatchNumber}
                    initialSteps={stepsLoading ? [] : mixingSteps}
                    canAddSteps={!stepsLoading && batch.status === 'InProgress' && !batch.parent_batch_id}
                  />
                ) : (
                  <ProcessTimeline subBatchId={batch.id} />
                )}
                <Genealogy subBatchId={batch.id} />
              </div>
            </>
          )}
        </DataState>
        <footer className="pt-2 pb-1 flex items-center justify-between text-[11px] font-mono text-[#5a5a5a]">
          <span>FLINT TRACEABILITY v2 · BUILD 2026.04.30</span>
          <span>SHIFT DAY · 11:42 SGT · ALL SYSTEMS NOMINAL</span>
        </footer>
      </main>
    </Shell>
  )
}

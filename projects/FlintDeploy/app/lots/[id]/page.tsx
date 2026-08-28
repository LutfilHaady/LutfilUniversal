'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { StatusBadge } from '@/components/status-badge'
import { IconChevronRight, IconChevronLeft, IconPrint, IconEdit } from '@/components/icons'
import { DataState } from '@/components/data-state'
import { useLot } from '@/lib/hooks/useLot'
import { useAuth } from '@/lib/auth-context'
import { EditLotDrawer } from '@/components/lots/edit-lot-drawer'
import { QRCode } from 'react-qr-code'

export default function LotDetailPage() {
  const params = useParams<{ id: string }>()
  const { lot, loading, error } = useLot(params.id)
  const { user } = useAuth()
  const role = user?.role ?? 'Operator'
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)

  const breadcrumb = (
    <div className="flex items-center gap-2 min-w-0">
      <Link href="/lots" className="text-[#888888] hover:text-[#f5f5f5] text-[13px] font-medium transition-colors">Lots</Link>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[#5a5a5a] shrink-0"><path d="m9 18 6-6-6-6"/></svg>
      <span className="font-mono text-[12.5px] text-[#f5f5f5] truncate">{lot?.lot_number ?? 'ID not available'}</span>
    </div>
  )

  return (
    <Shell titleNode={breadcrumb}>
      <main className="flex-1 min-h-0 px-6 py-5 overflow-y-auto flex flex-col gap-5">
        <DataState loading={loading} error={error} empty={!lot} emptyMessage="Lot not found">
          {lot && (
            <>
              <Link
                href="/lots"
                className="inline-flex items-center gap-1.5 text-[13px] text-[#888888] hover:text-[#f5f5f5] transition-colors mb-1"
                aria-label="Back to Lots"
              >
                <IconChevronLeft size={14} />
                <span>Back to Lots</span>
              </Link>
              <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-[#5a5a5a] mb-1">Lot</div>
                    <div className="text-[20px] font-semibold font-mono tracking-tight text-[#f5f5f5]">{lot.lot_number}</div>
                    <div className="mt-1 text-[12px] text-[#888888]">
                      {lot.category} · {lot.unit_count} units · Created {lot.created_at}
                    </div>
                    <div className="mt-2"><StatusBadge status={lot.status} /></div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="qr-print-target w-24 h-24 rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] flex items-center justify-center p-2">
                      <QRCode
                        value={lot.lot_number}
                        size={80}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="M"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      {role !== 'Operator' && (
                        <button
                          onClick={() => setEditDrawerOpen(true)}
                          className="h-8 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[11.5px] text-[#888888] hover:text-[#f5f5f5] flex items-center gap-1.5 transition-colors"
                        >
                          <IconEdit size={13} /> Edit Lot
                        </button>
                      )}
                      <button
                        onClick={() => window.print()}
                        className="h-8 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[11.5px] text-[#888888] hover:text-[#f5f5f5] flex items-center gap-1.5 transition-colors"
                      >
                        <IconPrint size={13} /> Print QR
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5" style={{ gridTemplateColumns: '1fr minmax(0,320px)' }}>
                <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#f5f5f5]">Serialized Units</span>
                    <span className="text-[11px] font-mono text-[#5a5a5a]">{lot.units?.length ?? 0} units</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        {['Unit Serial', 'Source Sub-batch', 'Created'].map(h => (
                          <th key={h} className="px-5 py-3 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]">
                      {(lot.units ?? []).map(u => (
                        <tr key={u.serial} className="hover:bg-[#141414] transition-colors">
                          <td className="px-5 py-2.5 font-mono text-[12px] text-[#f5f5f5]">{u.serial}</td>
                          <td className="px-5 py-2.5 font-mono text-[12px] text-[#93c5fd]">{u.sub_batch?.batch_number ?? 'ID not available'}</td>
                          <td className="px-5 py-2.5 text-[12px] font-mono text-[#888888]">{u.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] overflow-hidden self-start">
                  <div className="px-5 py-3 border-b border-[#2a2a2a]">
                    <span className="text-[13px] font-semibold text-[#f5f5f5]">Source Sub-Batches</span>
                  </div>
                  <div className="flex flex-col divide-y divide-[#1a1a1a]">
                    {lot.lot_sub_batches.map(({ sub_batch_id, sub_batch }) => {
                      // Sub-batches live at the two-segment route /batches/[parentId]/[subId]
                      const href = sub_batch?.parent_batch_id
                        ? `/batches/${sub_batch.parent_batch_id}/${sub_batch_id}`
                        : `/batches/${sub_batch_id}`;
                      return (
                        <Link key={sub_batch_id} href={href}
                          className="flex items-center justify-between px-5 py-3 hover:bg-[#141414] transition-colors">
                          <span className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors">{sub_batch?.batch_number ?? 'ID not available'}</span>
                          <IconChevronRight size={14} className="text-[#5a5a5a]" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </DataState>
      </main>

      {editDrawerOpen && lot && (
        <EditLotDrawer lot={lot} onClose={() => setEditDrawerOpen(false)} />
      )}
    </Shell>
  )
}

// components/data-state.tsx
'use client'

interface DataStateProps {
  loading: boolean
  error: string | null
  empty?: boolean
  emptyMessage?: string
  children: React.ReactNode
}

export function DataState({
  loading,
  error,
  empty,
  emptyMessage = 'No data found',
  children,
}: DataStateProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#5a5a5a]">
        <div className="w-5 h-5 rounded-full border-2 border-[#2a2a2a] border-t-[#22c55e] animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-[12.5px] text-[#fca5a5]">
        {error}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="flex items-center justify-center py-20 text-[12px] font-mono text-[#5a5a5a]">
        {emptyMessage}
      </div>
    )
  }
  return <>{children}</>
}

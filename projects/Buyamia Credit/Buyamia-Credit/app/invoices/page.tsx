'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { formatCurrency, formatDate, getUserTypeFromUserId } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'
import { Plus, Search, Undo2, MessageSquare, Clock, ExternalLink, FileText } from 'lucide-react'
import { InvoiceWithCollections, CollectionStatus } from '@/lib/types/collections'
import { translations } from '@/lib/translations'

// Invoice type matching API response
type InvoiceFromAPI = InvoiceWithCollections & {
  orderId?: string | null
  issueDate?: string
  items?: string
  buyerName?: string
  supplierName?: string
  daysUntilDue?: number
}

type InvoiceStatus = 'PENDING' | 'PAID' | 'DUE_SOON' | 'OVERDUE'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceFromAPI[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [undoInvoiceId, setUndoInvoiceId] = useState<string | null>(null)
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null)
  const [previousStatus, setPreviousStatus] = useState<{ id: string; status: InvoiceStatus; daysOverdue: number | undefined } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  } | null>(null)
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeout) {
        clearTimeout(undoTimeout)
      }
    }
  }, [undoTimeout])
  
  const handleMarkPaid = async (invoice: InvoiceFromAPI) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to mark invoice ${invoice.invoiceNumber} as paid?\n\nAmount: ${formatCurrency(invoice.amount)}`
    )
    
    if (!confirmed) return
    
    // Store previous status for undo
    setPreviousStatus({
      id: invoice.id,
      status: invoice.status as InvoiceStatus,
      daysOverdue: invoice.daysOverdue ?? undefined,
    })
    
    // Optimistically update UI
    setInvoices(prevInvoices =>
      prevInvoices.map(inv =>
        inv.id === invoice.id
          ? { ...inv, status: 'PAID' as InvoiceStatus, daysOverdue: undefined }
          : inv
      )
    )
    
    // Show undo button for 10 seconds
    setUndoInvoiceId(invoice.id)
    const timeout = setTimeout(() => {
      setUndoInvoiceId(null)
      setPreviousStatus(null)
    }, 10000) // 10 seconds
    
    setUndoTimeout(timeout)
    
    // Call API to update invoice
    try {
      const response = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          status: 'PAID',
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to mark as paid')
      }
      
      // Refresh invoices to get updated data
      const refreshResponse = await fetch(`/api/invoices?userId=${userId}&userType=${userType}&page=${currentPage}&limit=50`)
      if (refreshResponse.ok) {
        const data = await refreshResponse.json()
        // Handle both old format (array) and new format (object with invoices and pagination)
        if (Array.isArray(data)) {
          setInvoices(data)
          setPagination(null)
        } else {
          setInvoices(data.invoices || [])
          setPagination(data.pagination || null)
        }
      }
    } catch (error) {
      console.error('Error marking invoice as paid:', error)
      alert('Failed to mark invoice as paid. Please try again.')
      
      // Revert optimistic update
      if (previousStatus) {
        setInvoices(prevInvoices =>
          prevInvoices.map(inv =>
            inv.id === invoice.id
              ? { 
                  ...inv, 
                  status: previousStatus.status, 
                  daysOverdue: previousStatus.daysOverdue 
                }
              : inv
          )
        )
      }
    }
  }
  
  const handleUndo = () => {
    if (!previousStatus || !undoInvoiceId) return
    
    // Revert to previous status
    setInvoices(prevInvoices =>
      prevInvoices.map(inv =>
        inv.id === undoInvoiceId
          ? { 
              ...inv, 
              status: previousStatus.status, 
              daysOverdue: previousStatus.daysOverdue 
            }
          : inv
      )
    )
    
    // Clear undo state
    if (undoTimeout) {
      clearTimeout(undoTimeout)
    }
    setUndoInvoiceId(null)
    setPreviousStatus(null)
    setUndoTimeout(null)
  }
  
  const getStatusBadge = (status: string, daysOverdue: number | null = null) => {
    const getOverdueLabel = (days: number | null) => {
      if (!days) return 'Overdue'
      return days === 1 ? 'Overdue 1 Day' : `Overdue ${days} Days`
    }
    
    // Return inline styled badges for better control
    if (status === 'PAID') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-success/10 text-status-success whitespace-nowrap">
          Paid
        </span>
      )
    }
    
    if (status === 'DUE_SOON') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-warning/10 text-status-warning whitespace-nowrap">
          Due Soon
        </span>
      )
    }
    
    if (status === 'OVERDUE') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-error/10 text-status-error whitespace-nowrap">
          {getOverdueLabel(daysOverdue)}
        </span>
      )
    }
    
    if (status === 'PENDING') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-warning/10 text-status-warning whitespace-nowrap">
          Pending
        </span>
      )
    }
    
    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-cream-grey/30 text-text-dark/60 whitespace-nowrap">
        {status}
      </span>
    )
  }
  
  // Get userId from localStorage (set during login)
  const [userId, setUserId] = useState<string>('')
  const { language } = useLanguage()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        setUserId(storedUserId)
      } else {
        // Default fallback - detect from URL or use buyer
        const defaultUserId = 'BJ1045'
        localStorage.setItem('userId', defaultUserId)
        setUserId(defaultUserId)
      }
    }
  }, [])
  
  const userType = getUserTypeFromUserId(userId) // Detect from userId (BJ = buyer, SP = supplier)
  
  // Fetch invoices from database
  const fetchInvoices = useCallback(async (page: number = 1) => {
    if (!userId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const currentUserType = getUserTypeFromUserId(userId)
      const response = await fetch(`/api/invoices?userId=${userId}&userType=${currentUserType}&page=${page}&limit=50`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices')
      }
      
      const data = await response.json()
      
      // Handle both old format (array) and new format (object with invoices and pagination)
      console.log('[Frontend] Raw API response:', data)
      if (Array.isArray(data)) {
        console.log('[Frontend] Received array format, setting', data.length, 'invoices')
        setInvoices(data)
        setPagination(null)
      } else {
        const invoiceList = data.invoices || []
        console.log('[Frontend] Received object format, setting', invoiceList.length, 'invoices')
        console.log('[Frontend] Sample invoice:', invoiceList[0])
        setInvoices(invoiceList)
        setPagination(data.pagination || null)
        console.log(`[Frontend] Loaded ${invoiceList.length} invoices (page ${page}, total: ${data.pagination?.total || 0})`)
      }
    } catch (err) {
      console.error('Error fetching invoices:', err)
      setError(err instanceof Error ? err.message : 'Failed to load invoices')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchInvoices(currentPage)
  }, [fetchInvoices, currentPage])

  // Refetch invoices when success query parameter is present (after invoice creation)
  useEffect(() => {
    const success = searchParams?.get('success')
    if (success && userId) {
      // Reset to page 1 and refetch
      setCurrentPage(1)
      // Small delay to ensure invoice is saved in database
      const timeoutId = setTimeout(() => {
        fetchInvoices(1)
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [searchParams, userId, fetchInvoices])
  
  // Filter invoices based on search and status (API already filters by user type)
  console.log('[Frontend] Current invoices state:', invoices.length, 'invoices')
  console.log('[Frontend] Filter:', filter, 'Search:', searchTerm)
  console.log('[Frontend] Sample invoice from state:', invoices[0])
  const filteredInvoices = invoices.filter((inv) => {
    const matchesFilter = filter === 'ALL' || inv.status === filter
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.buyerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.supplierId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.orderId && inv.orderId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.buyerName && inv.buyerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.supplierName && inv.supplierName.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const result = matchesFilter && matchesSearch
    if (!result && invoices.length > 0) {
      console.log('[Frontend] Invoice filtered out:', inv.invoiceNumber, 'matchesFilter:', matchesFilter, 'matchesSearch:', matchesSearch, 'status:', inv.status)
    }
    return result
  })
  console.log('[Frontend] Filtered invoices:', filteredInvoices.length, 'out of', invoices.length)
  const t = translations[language]
  const tInvoices = translations[language].invoicesPage
  
  // Get collection status badge
  const getCollectionStatusBadge = (invoice: InvoiceFromAPI) => {
    if (!invoice.collectionStatus) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-cream-grey/30 text-text-dark/60">
          {tInvoices.noAttempts}
        </span>
      )
    }
    
    const attemptsCount = invoice.collectionAttempts?.length || 0
    
    if (invoice.collectionStatus === CollectionStatus.PAID) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-status-success/10 text-status-success">
          {t.collections.paid}
        </span>
      )
    }
    
    if (attemptsCount === 0) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-cream-grey/30 text-text-dark/60">
          {tInvoices.noAttempts}
        </span>
      )
    }
    
    if (invoice.collectionStatus === CollectionStatus.IN_PROGRESS) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-status-warning/10 text-status-warning">
          {attemptsCount} {tInvoices.attempts}
        </span>
      )
    }
    
    if (invoice.collectionStatus === CollectionStatus.ESCALATED) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-status-error/10 text-status-error">
          {t.collections.escalated} ({attemptsCount})
        </span>
      )
    }
    
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-primary-green/10 text-primary-green">
        {attemptsCount} {tInvoices.attempts}
      </span>
    )
  }
  
  // Get last collection attempt info
  const getLastCollectionInfo = (invoice: InvoiceFromAPI) => {
    if (!invoice.lastCollectionAttempt) {
      return <span className="text-sm text-text-dark/40">{tInvoices.never}</span>
    }
    
    const lastAttempt = invoice.collectionAttempts?.[0] // Most recent
    const attemptDate = new Date(invoice.lastCollectionAttempt)
    const now = new Date()
    const diffMs = now.getTime() - attemptDate.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    let timeAgo: string
    if (diffHours < 1) {
      timeAgo = tInvoices.justNow
    } else if (diffHours < 24) {
      timeAgo = `${diffHours} ${tInvoices.hoursAgo}`
    } else {
      timeAgo = `${diffDays} ${tInvoices.daysAgo}`
    }
    
    // Only WhatsApp now, so always show MessageSquare icon
    return (
      <div className="flex items-center gap-1.5">
        <MessageSquare className="w-3 h-3" />
        <span className="text-sm text-text-dark/70">{timeAgo}</span>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-dark mb-2">{language === 'id' ? 'Faktur' : 'Invoices'}</h1>
            <p className="text-text-dark/60">{language === 'id' ? 'Kelola faktur yang belum dibayar dan sudah dibayar' : 'Manage outstanding and paid invoices'}</p>
          </div>
          <div className="flex items-center gap-3">
            {userType === 'SUPPLIER' && (
              <Link href="/invoices/new" className="btn-primary flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {language === 'id' ? 'Tambah Faktur' : 'Add Invoice'}
              </Link>
            )}
          </div>
        </div>
        
        {/* Filters and Search */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cream-grey w-5 h-5" />
              <input
                type="text"
                placeholder={language === 'id' ? 'Cari berdasarkan faktur, pembeli, supplier, atau ID pesanan...' : 'Search by invoice, buyer, supplier, or order ID...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {(['ALL', 'PAID', 'DUE_SOON', 'OVERDUE'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-button font-medium transition-colors ${
                    filter === status
                      ? 'bg-primary-green text-white'
                      : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                  }`}
                >
                  {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Loading State */}
        {isLoading && (
          <div className="card text-center py-12">
            <p className="text-text-dark/60">{language === 'id' ? 'Memuat faktur...' : 'Loading invoices...'}</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="card text-center py-12">
            <p className="text-status-error mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Retry
            </button>
          </div>
        )}

        {/* Invoice Table */}
        {!isLoading && !error && filteredInvoices.length > 0 && (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cream-grey">
                  <th className="text-left py-3 px-4 font-semibold text-text-dark">{language === 'id' ? 'ID Faktur' : 'Invoice ID'}</th>
                  <th className="text-left py-3 px-4 font-semibold text-text-dark">
                    {userType === 'BUYER' ? (language === 'id' ? 'Supplier' : 'Supplier') : (language === 'id' ? 'Pembeli' : 'Buyer')}
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-text-dark">{language === 'id' ? 'Tanggal Terbit' : 'Issue Date'}</th>
                  <th className="text-left py-3 px-4 font-semibold text-text-dark">{language === 'id' ? 'Tanggal Jatuh Tempo' : 'Due Date'}</th>
                  <th className="text-right py-3 px-4 font-semibold text-text-dark">{language === 'id' ? 'Jumlah' : 'Amount'}</th>
                  <th className="text-left py-3 px-4 font-semibold text-text-dark">{t.dashboard.status}</th>
                  <th className="text-left py-3 px-4 font-semibold text-text-dark">{language === 'id' ? 'Item' : 'Items'}</th>
                  {userType === 'SUPPLIER' && (
                    <>
                      <th className="text-center py-3 px-4 font-semibold text-text-dark">{tInvoices.collectionStatus}</th>
                      <th className="text-left py-3 px-4 font-semibold text-text-dark">{tInvoices.lastCollection}</th>
                      <th className="text-left py-3 px-4 font-semibold text-text-dark">{tInvoices.viewHistory}</th>
                    </>
                  )}
                      <th className="text-left py-3 px-4 font-semibold text-text-dark">{language === 'id' ? 'Aksi' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-cream-grey/50 hover:bg-cream-beige/30">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cream-grey" />
                      <span className="text-primary-green font-medium">
                        {invoice.invoiceNumber}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {userType === 'BUYER' ? (
                      // Show supplier name for buyers
                      invoice.supplierName || invoice.supplierId
                    ) : (
                      // Show buyer name for suppliers
                      invoice.buyerName || invoice.buyerId
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-text-dark">
                      {invoice.issueDate ? formatDate(invoice.issueDate, language) : '-'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-text-dark">{formatDate(invoice.dueDate, language)}</span>
                  </td>
                  <td className="py-4 px-4 text-right font-semibold">{formatCurrency(invoice.amount)}</td>
                  <td className="py-4 px-4">
                    {getStatusBadge(invoice.status, invoice.daysOverdue ?? null)}
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-text-dark/70">
                      {invoice.items || '-'}
                    </span>
                  </td>
                  {userType === 'SUPPLIER' && (
                    <>
                      <td className="py-4 px-4 text-center">
                        {getCollectionStatusBadge(invoice)}
                      </td>
                      <td className="py-4 px-4">
                        {getLastCollectionInfo(invoice)}
                      </td>
                      <td className="py-4 px-4">
                        {invoice.collectionAttempts && invoice.collectionAttempts.length > 0 ? (
                          <Link
                            href={`/collections?invoice=${invoice.invoiceNumber}`}
                            className="inline-flex items-center gap-1 text-xs text-primary-green hover:text-primary-olive transition-colors"
                            title="View collection history"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {tInvoices.viewHistory}
                          </Link>
                        ) : (
                          <span className="text-xs text-text-dark/40">—</span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                    {invoice.status === 'PAID' && undoInvoiceId === invoice.id ? (
                      <button 
                        onClick={handleUndo}
                        className="inline-flex items-center gap-1 text-status-warning hover:text-status-error text-sm font-medium transition-colors"
                      >
                        <Undo2 className="w-4 h-4" />
                        Undo
                      </button>
                    ) : invoice.status !== 'PAID' && userType === 'SUPPLIER' ? (
                      <button 
                        onClick={() => handleMarkPaid(invoice)}
                        className="text-primary-green hover:underline text-sm font-medium"
                      >
                        Mark Paid
                      </button>
                    ) : null}
                    </div>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* No Invoices Message */}
        {!isLoading && !error && filteredInvoices.length === 0 && (
          <div className="card text-center py-12 text-text-dark/60">
            <p>{language === 'id' ? 'Tidak ada faktur yang ditemukan sesuai kriteria Anda.' : 'No invoices found matching your criteria.'}</p>
            {invoices.length > 0 && (
              <p className="text-sm mt-2 text-text-dark/40">
                {invoices.length} invoice(s) loaded but filtered out. Check console for details.
              </p>
            )}
            {invoices.length === 0 && (
              <p className="text-sm mt-2 text-text-dark/40">
                No invoices found in database. Check console for API response.
              </p>
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="card mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-dark/60">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total invoices)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (currentPage > 1) {
                      setCurrentPage(currentPage - 1)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-button font-medium transition-colors ${
                    currentPage === 1
                      ? 'bg-cream-grey text-text-dark/40 cursor-not-allowed'
                      : 'bg-primary-green text-white hover:bg-primary-olive'
                  }`}
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => {
                          setCurrentPage(pageNum)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={`px-3 py-2 rounded-button font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-primary-green text-white'
                            : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => {
                    if (currentPage < pagination.totalPages) {
                      setCurrentPage(currentPage + 1)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                  disabled={currentPage === pagination.totalPages}
                  className={`px-4 py-2 rounded-button font-medium transition-colors ${
                    currentPage === pagination.totalPages
                      ? 'bg-cream-grey text-text-dark/40 cursor-not-allowed'
                      : 'bg-primary-green text-white hover:bg-primary-olive'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


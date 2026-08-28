'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { formatDate, getUserTypeFromUserId } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'
import { Plus, AlertCircle, CheckCircle } from 'lucide-react'


const issueTypeLabels = {
  NOT_RECEIVED: 'Not Received',
  DAMAGED: 'Damaged',
  DELAYED: 'Delayed',
  WRONG_ITEMS: 'Wrong Items',
  PAYMENT_ISSUE: 'Payment Issue',
  OTHER: 'Other',
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [complaintType, setComplaintType] = useState<'MY_COMPLAINTS' | 'COMPLAINTS_RECEIVED'>('MY_COMPLAINTS')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL')
  const { language } = useLanguage()
  const [userId, setUserId] = useState<string>('')
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        setUserId(storedUserId)
      }
    }
  }, [])
  
  useEffect(() => {
    if (userId) {
      fetchIssues()
    }
  }, [userId])
  
  const fetchIssues = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const userType = getUserTypeFromUserId(userId)
      const response = await fetch(`/api/issues?userId=${userId}&userType=${userType}`)
      if (!response.ok) {
        throw new Error('Failed to fetch issues')
      }
      const data = await response.json()
      setIssues(data)
    } catch (err) {
      console.error('Error fetching issues:', err)
      setError(err instanceof Error ? err.message : 'Failed to load issues')
    } finally {
      setIsLoading(false)
    }
  }
  
  const userType = getUserTypeFromUserId(userId)
  
  const filteredIssues = issues.filter((issue) => {
    // Filter by complaint type first (applies to both buyers and suppliers)
    if (userType === 'BUYER') {
      // For buyers:
      // - My Complaints = issues created by buyer (createdBy === 'BUYER')
      // - Complaints Received = issues created by suppliers about buyer (createdBy === 'SUPPLIER')
      if (complaintType === 'MY_COMPLAINTS' && issue.createdBy !== 'BUYER') {
        return false
      }
      if (complaintType === 'COMPLAINTS_RECEIVED' && issue.createdBy !== 'SUPPLIER') {
        return false
      }
    } else if (userType === 'SUPPLIER') {
      // For suppliers:
      // - My Complaints = issues created by supplier (createdBy === 'SUPPLIER')
      // - Complaints Received = issues created by buyers about supplier (createdBy === 'BUYER')
      if (complaintType === 'MY_COMPLAINTS' && issue.createdBy !== 'SUPPLIER') {
        return false
      }
      if (complaintType === 'COMPLAINTS_RECEIVED' && issue.createdBy !== 'BUYER') {
        return false
      }
    }
    
    // Then filter by status (applies to both buyers and suppliers)
    if (statusFilter === 'ALL') {
      return true
    }
    return issue.status === statusFilter
  })
  
  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-dark mb-2">{language === 'id' ? 'Masalah' : 'Issues'}</h1>
            <p className="text-text-dark/60">{language === 'id' ? 'Lacak dan kelola masalah yang dilaporkan' : 'Track and manage reported issues'}</p>
          </div>
          <Link href="/issues/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {language === 'id' ? 'Laporkan Masalah' : 'Report Issue'}
          </Link>
        </div>
        
        {/* Filters */}
        <div className="space-y-4 mb-6">
          {/* Complaint Type Filters (Both Buyers and Suppliers) */}
          <div className="card">
            <div className="flex gap-2">
              <button
                onClick={() => setComplaintType('MY_COMPLAINTS')}
                className={`px-4 py-2 rounded-button font-medium transition-colors ${
                  complaintType === 'MY_COMPLAINTS'
                    ? 'bg-primary-green text-white'
                    : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                }`}
              >
                My Complaints
              </button>
              <button
                onClick={() => setComplaintType('COMPLAINTS_RECEIVED')}
                className={`px-4 py-2 rounded-button font-medium transition-colors ${
                  complaintType === 'COMPLAINTS_RECEIVED'
                    ? 'bg-primary-green text-white'
                    : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                }`}
              >
                Complaints Received
              </button>
            </div>
          </div>
          
          {/* Status Filters */}
          <div className="card">
            <div className="flex gap-2">
              {(['ALL', 'OPEN', 'RESOLVED'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-button font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-primary-green text-white'
                      : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Loading State */}
        {isLoading && (
          <div className="card text-center py-12 text-text-dark/60">
            {language === 'id' ? 'Memuat masalah...' : 'Loading issues...'}
          </div>
        )}
        
        {/* Error State */}
        {error && !isLoading && (
          <div className="card text-center py-12">
            <p className="text-status-error mb-4">{error}</p>
            <button onClick={fetchIssues} className="btn-primary">{language === 'id' ? 'Coba Lagi' : 'Retry'}</button>
          </div>
        )}
        
        {/* Issues List */}
        {!isLoading && !error && (
          <div className="grid gap-4">
            {filteredIssues.map((issue) => (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              className="card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-primary-green">{issue.issueNumber}</span>
                    <span className={`status-badge ${
                      issue.status === 'OPEN' ? 'status-open' : 'status-resolved'
                    }`}>
                      {issue.status}
                    </span>
                    <span className="text-sm text-text-dark/60">
                      {issueTypeLabels[issue.type as keyof typeof issueTypeLabels]}
                    </span>
                  </div>
                  
                  <div className="text-sm text-text-dark/70 mb-2">
                    <span className="font-medium">{language === 'id' ? 'Pesanan:' : 'Order:'}</span> {issue.orderId} | 
                    {userType === 'SUPPLIER' ? (
                      <>
                        <span className="font-medium ml-2">{language === 'id' ? 'Pembeli:' : 'Buyer:'}</span> {issue.buyerName || issue.buyerId}
                      </>
                    ) : (
                      <>
                        <span className="font-medium ml-2">{language === 'id' ? 'Supplier:' : 'Supplier:'}</span> {issue.supplierName || issue.supplierId}
                      </>
                    )}
                  </div>
                  
                  {issue.description && (
                    <p className="text-text-dark/80 mb-2">{issue.description}</p>
                  )}
                  
                  {issue.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={issue.imageUrl}
                        alt={language === 'id' ? 'Bukti masalah' : 'Issue evidence'}
                        className="max-w-full h-auto max-h-48 rounded-lg border border-cream-grey"
                      />
                    </div>
                  )}
                  
                  <p className="text-xs text-text-dark/50 mt-2">
                    Reported on {formatDate(new Date(issue.createdAt), language)}
                  </p>
                </div>
                
                <div className="ml-4">
                  {issue.status === 'OPEN' ? (
                    <AlertCircle className="w-6 h-6 text-status-error" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-status-success" />
                  )}
                </div>
              </div>
            </Link>
            ))}
          </div>
        )}
        
        {!isLoading && !error && filteredIssues.length === 0 && (
          <div className="card text-center py-12 text-text-dark/60">
            No issues found matching your criteria.
          </div>
        )}
      </div>
    </div>
  )
}


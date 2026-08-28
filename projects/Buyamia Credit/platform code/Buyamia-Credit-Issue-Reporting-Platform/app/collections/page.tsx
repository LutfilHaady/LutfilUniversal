'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import { formatCurrency, formatDate, getUserTypeFromUserId } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'
import { 
  MessageSquare, 
  Filter, 
  Search, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Users, 
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import {
  CollectionAttemptType,
  ToneLevel,
  CollectionAttemptStatus,
} from '@/lib/types/collections'

export default function CollectionsPage() {
  const { language } = useLanguage()
  const t = translations[language].collections
  
  const [userId, setUserId] = useState<string>('SP0023')
  const [filterType, setFilterType] = useState<CollectionAttemptType | 'ALL'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null)
  const [collectionAttempts, setCollectionAttempts] = useState<any[]>([])
  const [collectionStats, setCollectionStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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
      fetchCollectionData()
    }
  }, [userId])
  
  const fetchCollectionData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [attemptsRes, statsRes] = await Promise.all([
        fetch(`/api/collections/history?userId=${userId}`),
        fetch(`/api/collections/stats?userId=${userId}`)
      ])
      
      if (!attemptsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch collection data')
      }
      
      const attemptsData = await attemptsRes.json()
      const statsData = await statsRes.json()
      
      setCollectionAttempts(attemptsData.attempts || [])
      setCollectionStats(statsData)
    } catch (err) {
      console.error('Error fetching collection data:', err)
      setError('Failed to load collection data')
    } finally {
      setIsLoading(false)
    }
  }
  
  const userType = getUserTypeFromUserId(userId)
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-white">
        <Navbar userId={userId} userType={userType} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <p className="text-text-dark/60">Loading collections...</p>
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-cream-white">
        <Navbar userId={userId} userType={userType} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-16 h-16 text-status-error mb-4" />
            <p className="text-text-dark font-semibold mb-2">Error Loading Collections</p>
            <p className="text-text-dark/60 mb-4">{error}</p>
            <button onClick={fetchCollectionData} className="btn-primary">Retry</button>
          </div>
        </div>
      </div>
    )
  }
  
  if (userType !== 'SUPPLIER') {
    return (
      <div className="min-h-screen bg-cream-white">
        <Navbar userId={userId} userType={userType} />
        <div className="container mx-auto px-4 py-8">
          <div className="card-elevated text-center py-12">
            <AlertCircle className="w-16 h-16 text-cream-grey mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-text-dark mb-2">Access Restricted</h2>
            <p className="text-text-dark/60">This page is only available for suppliers.</p>
          </div>
        </div>
      </div>
    )
  }
  
  const filteredAttempts = collectionAttempts.filter((attempt) => {
    const matchesType = filterType === 'ALL' || attempt.attemptType === filterType
    const matchesSearch = 
      attempt.invoice?.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attempt.invoice?.buyer?.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attempt.invoice?.buyer?.userId.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesType && matchesSearch
  })
  
  // Get tone level label
  const getToneLabel = (tone: ToneLevel): string => {
    const labels: Record<ToneLevel, string> = {
      [ToneLevel.FRIENDLY]: t.friendly,
      [ToneLevel.PROFESSIONAL]: t.professional,
      [ToneLevel.URGENT]: t.urgent,
      [ToneLevel.FIRM]: t.firm,
      [ToneLevel.ESCALATED]: t.escalated,
    }
    return labels[tone] || tone
  }
  
  // Get status badge
  const getStatusBadge = (status: CollectionAttemptStatus) => {
    const statusConfig: Record<CollectionAttemptStatus, { bg: string; text: string; icon: any }> = {
      [CollectionAttemptStatus.SENT]: { bg: 'bg-blue-100', text: 'text-blue-700', icon: MessageSquare },
      [CollectionAttemptStatus.DELIVERED]: { bg: 'bg-blue-100', text: 'text-blue-700', icon: CheckCircle },
      [CollectionAttemptStatus.READ]: { bg: 'bg-primary-green/10', text: 'text-primary-green', icon: CheckCircle },
      [CollectionAttemptStatus.ANSWERED]: { bg: 'bg-status-success/10', text: 'text-status-success', icon: CheckCircle },
      [CollectionAttemptStatus.NO_ANSWER]: { bg: 'bg-status-warning/10', text: 'text-status-warning', icon: XCircle },
      [CollectionAttemptStatus.BUSY]: { bg: 'bg-status-warning/10', text: 'text-status-warning', icon: XCircle },
      [CollectionAttemptStatus.FAILED]: { bg: 'bg-status-error/10', text: 'text-status-error', icon: XCircle },
      [CollectionAttemptStatus.PENDING]: { bg: 'bg-cream-grey/30', text: 'text-text-dark/60', icon: Clock },
    }
    const config = statusConfig[status] || statusConfig[CollectionAttemptStatus.PENDING]
    const Icon = config.icon
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    )
  }
  
  // Get attempt type icon - WhatsApp Message or WhatsApp Call
  const getAttemptTypeIcon = (type: CollectionAttemptType) => {
    if (type === CollectionAttemptType.WHATSAPP_CALL) {
      return <MessageSquare className="w-4 h-4 text-primary-green" /> // WhatsApp call icon
    }
    return <MessageSquare className="w-4 h-4" /> // WhatsApp message icon
  }
  
  // Get attempt type label
  const getAttemptTypeLabel = (type: CollectionAttemptType) => {
    if (type === CollectionAttemptType.WHATSAPP_CALL) {
      return 'WhatsApp Call'
    }
    return 'WhatsApp Message'
  }
  
  // Calculate days overdue/until due
  const getDaysInfo = (dueDate: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    const diffTime = due.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { type: 'overdue', days: Math.abs(diffDays) }
    } else {
      return { type: 'until', days: diffDays }
    }
  }
  
  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-dark mb-2">{t.title}</h1>
          <p className="text-text-dark/60">{t.subtitle}</p>
        </div>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-dark/60">{t.activeCollections}</span>
              <TrendingUp className="w-5 h-5 text-primary-green" />
            </div>
            <p className="text-3xl font-bold text-text-dark">{collectionStats?.activeCollections || 0}</p>
          </div>
          
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-dark/60">{t.totalAttempts}</span>
              <MessageSquare className="w-5 h-5 text-primary-olive" />
            </div>
            <p className="text-3xl font-bold text-text-dark">{collectionStats?.totalAttempts || 0}</p>
          </div>
          
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-dark/60">{t.responseRate}</span>
              <CheckCircle className="w-5 h-5 text-status-success" />
            </div>
            <p className="text-3xl font-bold text-text-dark">{collectionStats?.responseRate || 0}%</p>
          </div>
          
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-dark/60">{t.paymentRate}</span>
              <DollarSign className="w-5 h-5 text-primary-green" />
            </div>
            <p className="text-3xl font-bold text-text-dark">{collectionStats?.paymentRate || 0}%</p>
          </div>
        </div>
        
        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-dark/60">{t.averageTimeToPayment}</span>
              <Clock className="w-5 h-5 text-primary-olive" />
            </div>
            <p className="text-2xl font-bold text-text-dark">{collectionStats?.averageTimeToPayment || 0} days</p>
          </div>
          
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-dark/60">{t.totalOutstanding}</span>
              <DollarSign className="w-5 h-5 text-status-warning" />
            </div>
            <p className="text-2xl font-bold text-text-dark">{formatCurrency(collectionStats?.totalOutstanding || 0)}</p>
          </div>
          
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-dark/60">{t.buyersNotResponding}</span>
              <Users className="w-5 h-5 text-status-error" />
            </div>
            <p className="text-2xl font-bold text-text-dark">{collectionStats?.buyersNotResponding || 0}</p>
          </div>
        </div>
        
        {/* Filters and Search */}
        <div className="card-elevated mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cream-grey w-5 h-5" />
              <input
                type="text"
                placeholder="Search by invoice, buyer name, or buyer ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            <div className="flex gap-2">
              {(['ALL', CollectionAttemptType.WHATSAPP_MESSAGE] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-button font-medium transition-colors ${
                    filterType === type
                      ? 'bg-primary-green text-white'
                      : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                  }`}
                >
                  {type === 'ALL' ? t.all : 'WhatsApp Message'}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Collection History Table */}
        <div className="card-elevated overflow-x-auto">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-text-dark">{t.collectionHistory}</h2>
            <p className="text-sm text-text-dark/60">{filteredAttempts.length} attempt{filteredAttempts.length !== 1 ? 's' : ''} found</p>
          </div>
          
          {filteredAttempts.length === 0 ? (
            <div className="text-center py-12 text-text-dark/60">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-cream-grey" />
              <p className="text-lg font-medium mb-2">{t.noAttempts}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-cream-grey">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">{t.invoiceNumber}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">{t.buyer}</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-text-dark">{t.amount}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">{t.dueDate}</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">{t.attemptType}</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">{t.toneLevel}</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">{t.status}</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">{t.timestamp}</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((attempt, index) => {
                  const daysInfo = attempt.invoice?.dueDate ? getDaysInfo(attempt.invoice.dueDate) : null
                  
                  return (
                    <>
                      <tr 
                        key={attempt.id}
                        className={`border-b border-cream-grey/50 hover:bg-cream-beige/30 transition-colors cursor-pointer ${
                          index % 2 === 0 ? 'bg-white' : 'bg-cream-white/50'
                        }`}
                        onClick={() => setExpandedAttempt(expandedAttempt === attempt.id ? null : attempt.id)}
                      >
                        <td className="py-4 px-4">
                          <span className="font-semibold text-primary-green">{attempt.invoice?.invoiceNumber}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <span className="font-medium text-text-dark block">{attempt.invoice?.buyer?.businessName}</span>
                            <span className="text-xs text-text-dark/60">{attempt.invoice?.buyer?.userId}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-semibold text-text-dark">{formatCurrency(attempt.invoice?.amount || 0)}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <span className="text-sm text-text-dark">{attempt.invoice?.dueDate ? formatDate(attempt.invoice.dueDate, language) : '-'}</span>
                            {daysInfo && (
                              <span className={`text-xs block mt-1 ${
                                daysInfo.type === 'overdue' ? 'text-status-error' : 'text-status-warning'
                              }`}>
                                {daysInfo.type === 'overdue' 
                                  ? `${daysInfo.days} ${t.daysOverdue}`
                                  : `${daysInfo.days} ${t.daysUntilDue}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-primary-green">
                            {getAttemptTypeIcon(attempt.attemptType)}
                            <span className="text-xs text-text-dark">{getAttemptTypeLabel(attempt.attemptType)}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-primary-green/10 text-primary-green">
                            {getToneLabel(attempt.toneLevel)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {getStatusBadge(attempt.status)}
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-text-dark/60">{formatDate(attempt.createdAt, language)}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button className="text-primary-green hover:text-primary-olive text-sm font-medium">
                            {expandedAttempt === attempt.id ? 'Hide' : t.viewDetails}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded Details */}
                      {expandedAttempt === attempt.id && (
                        <tr className="bg-cream-beige/20">
                          <td colSpan={9} className="py-6 px-4">
                            <div className="space-y-4">
                              {/* WhatsApp Message Details */}
                              {attempt.attemptType === CollectionAttemptType.WHATSAPP_MESSAGE && attempt.messageId && (
                                <>
                                  <div className="p-4 bg-primary-green/5 rounded-xl border border-primary-green/20">
                                    <h4 className="font-semibold text-text-dark mb-2">Generated WhatsApp Message</h4>
                                    {attempt.messageContent ? (
                                      <p className="text-sm text-text-dark/70 whitespace-pre-wrap">{attempt.messageContent}</p>
                                    ) : (
                                      <p className="text-sm text-text-dark/70">Message sent via WhatsApp template</p>
                                    )}
                                  </div>
                                  
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <div className="p-3 bg-white rounded-lg">
                                      <p className="text-xs text-text-dark/60 mb-1">Message ID</p>
                                      <p className="font-semibold text-text-dark text-xs">{attempt.messageId}</p>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg">
                                      <p className="text-xs text-text-dark/60 mb-1">Status</p>
                                      <p className="font-semibold text-text-dark">{attempt.status}</p>
                                    </div>
                                  </div>
                                </>
                              )}
                              
                              {/* WhatsApp Call Details */}
                              {attempt.attemptType === CollectionAttemptType.WHATSAPP_CALL && attempt.call && (
                                <>
                                  {attempt.call.recordingUrl && (
                                    <div className="p-4 bg-white rounded-xl border border-cream-grey">
                                      <div className="flex items-center gap-2 mb-3">
                                        <MessageSquare className="w-5 h-5 text-primary-green" />
                                        <h4 className="font-semibold text-text-dark">WhatsApp Call Recording</h4>
                                      </div>
                                      <audio controls className="w-full">
                                        <source src={attempt.call.recordingUrl} type="audio/mpeg" />
                                        Your browser does not support the audio element.
                                      </audio>
                                    </div>
                                  )}
                                  
                                  {attempt.call.transcript && (
                                    <div className="p-4 bg-white rounded-xl border border-cream-grey">
                                      <div className="flex items-center gap-2 mb-3">
                                        <MessageSquare className="w-5 h-5 text-primary-green" />
                                        <h4 className="font-semibold text-text-dark">{t.transcript}</h4>
                                      </div>
                                      <p className="text-sm text-text-dark/70 whitespace-pre-wrap">{attempt.call.transcript}</p>
                                    </div>
                                  )}
                                  
                                  {attempt.call.aiResponse && (
                                    <div className="p-4 bg-primary-green/5 rounded-xl border border-primary-green/20">
                                      <h4 className="font-semibold text-text-dark mb-2">AI Generated Script</h4>
                                      <p className="text-sm text-text-dark/70">{attempt.call.aiResponse}</p>
                                    </div>
                                  )}
                                  
                                  <div className="grid md:grid-cols-3 gap-4">
                                    <div className="p-3 bg-white rounded-lg">
                                      <p className="text-xs text-text-dark/60 mb-1">Duration</p>
                                      <p className="font-semibold text-text-dark">
                                        {attempt.call.duration ? `${Math.floor(attempt.call.duration / 60)}:${(attempt.call.duration % 60).toString().padStart(2, '0')}` : '-'}
                                      </p>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg">
                                      <p className="text-xs text-text-dark/60 mb-1">Call Status</p>
                                      <p className="font-semibold text-text-dark">{attempt.call.status}</p>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg">
                                      <p className="text-xs text-text-dark/60 mb-1">Call SID</p>
                                      <p className="font-semibold text-text-dark text-xs">{attempt.call.callSid || '-'}</p>
                                    </div>
                                  </div>
                                </>
                              )}
                              
                              {/* Buyer Response */}
                              {attempt.response && (
                                <div className="p-4 bg-status-success/5 rounded-xl border border-status-success/20">
                                  <h4 className="font-semibold text-text-dark mb-2">{t.response}</h4>
                                  <p className="text-sm text-text-dark/70">{attempt.response}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { formatDate, getUserTypeFromUserId } from '@/lib/utils'
import { ArrowLeft, Mic, Play, CheckCircle } from 'lucide-react'


const issueTypeLabels = {
  NOT_RECEIVED: 'Not Received',
  DAMAGED: 'Damaged',
  DELAYED: 'Delayed',
  WRONG_ITEMS: 'Wrong Items',
  PAYMENT_ISSUE: 'Payment Issue',
  OTHER: 'Other',
}

export default function IssueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [issue, setIssue] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
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
    if (params.id) {
      fetchIssue()
    }
  }, [params.id])
  
  const fetchIssue = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/issues/${params.id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch issue')
      }
      const data = await response.json()
      
      // Generate timeline from issue data
      const timeline = [
        { 
          date: new Date(data.createdAt), 
          action: 'Issue reported', 
          user: data.buyerName || data.buyerId 
        },
        { 
          date: new Date(data.createdAt), 
          action: 'Issue logged in system', 
          user: 'System' 
        },
      ]
      
      if (data.resolvedAt) {
        timeline.push({
          date: new Date(data.resolvedAt),
          action: 'Issue marked as resolved',
          user: 'System'
        })
      }
      
      setIssue({ ...data, timeline })
    } catch (err) {
      console.error('Error fetching issue:', err)
      setError(err instanceof Error ? err.message : 'Failed to load issue')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleResolve = async () => {
    setIsResolving(true)
    try {
      const response = await fetch(`/api/issues/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to resolve issue')
      }
      
      const result = await response.json()
      if (result.success) {
        // Refresh issue data
        await fetchIssue()
        router.push('/issues?resolved=true')
      }
    } catch (err) {
      console.error('Error resolving issue:', err)
      alert('Failed to resolve issue. Please try again.')
    } finally {
      setIsResolving(false)
    }
  }
  
  const userType = getUserTypeFromUserId(userId)
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-white">
        <Navbar userId={userId} userType={userType} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-text-dark/60">
            Loading issue...
          </div>
        </div>
      </div>
    )
  }
  
  if (error || !issue) {
    return (
      <div className="min-h-screen bg-cream-white">
        <Navbar userId={userId} userType={userType} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-status-error mb-4">{error || 'Issue not found'}</p>
            <button onClick={fetchIssue} className="btn-primary">Retry</button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/issues" className="inline-flex items-center gap-2 text-primary-green hover:underline mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Issues
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-text-dark mb-2">{issue.issueNumber}</h1>
              <p className="text-text-dark/60">Issue Details</p>
            </div>
            <span className={`status-badge ${
              issue.status === 'OPEN' ? 'status-open' : 'status-resolved'
            }`}>
              {issue.status}
            </span>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Issue Info Card */}
            <div className="card">
              <h2 className="text-xl font-semibold text-text-dark mb-4">Issue Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-dark/60">Issue Type</label>
                  <p className="text-text-dark font-medium">
                    {issueTypeLabels[issue.type as keyof typeof issueTypeLabels]}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-text-dark/60">Order ID</label>
                  <p className="text-text-dark font-medium">{issue.orderId}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-text-dark/60">Buyer</label>
                    <p className="text-text-dark font-medium">{issue.buyerName || issue.buyerId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text-dark/60">Supplier</label>
                    <p className="text-text-dark font-medium">{issue.supplierName || issue.supplierId}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-text-dark/60">Description</label>
                  <p className="text-text-dark">{issue.description}</p>
                </div>
                
                {issue.imageUrl && (
                  <div>
                    <label className="text-sm font-medium text-text-dark/60 mb-2 block">Image Evidence</label>
                    <div className="mt-2">
                      <img
                        src={issue.imageUrl}
                        alt="Issue evidence"
                        className="max-w-full h-auto max-h-96 rounded-lg border border-cream-grey"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Voice Note Card */}
            {issue.transcript && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Mic className="w-5 h-5 text-primary-green" />
                  <h2 className="text-xl font-semibold text-text-dark">Voice Note Transcript</h2>
                </div>
                
                {issue.audioUrl && (
                  <div className="mb-4 p-4 bg-cream-beige/50 rounded-button">
                    <button className="flex items-center gap-2 text-primary-green hover:underline">
                      <Play className="w-4 h-4" />
                      Play Voice Note
                    </button>
                  </div>
                )}
                
                <div className="p-4 bg-cream-white border border-cream-grey rounded-button">
                  <p className="text-text-dark italic leading-relaxed">{issue.transcript}</p>
                </div>
              </div>
            )}
            
            {/* Timeline Card */}
            <div className="card">
              <h2 className="text-xl font-semibold text-text-dark mb-4">Timeline</h2>
              
              <div className="space-y-4">
                {issue.timeline.map((event: { date: Date; action: string; user: string }, index: number) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-primary-green"></div>
                      {index < issue.timeline.length - 1 && (
                        <div className="w-0.5 h-full bg-cream-grey mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-text-dark font-medium">{event.action}</p>
                      <p className="text-sm text-text-dark/60">
                        {formatDate(event.date)} by {event.user}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Right Column - Actions */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="card">
              <h2 className="text-xl font-semibold text-text-dark mb-4">Actions</h2>
              
              {issue.status === 'OPEN' && (
                <button
                  onClick={handleResolve}
                  disabled={isResolving}
                  className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                  {isResolving ? 'Resolving...' : 'Mark as Resolved'}
                </button>
              )}
              
              <div className="mt-4 p-4 bg-cream-beige/50 rounded-button">
                <p className="text-sm text-text-dark/70">
                  <strong>Note:</strong> Resolving this issue will update credit scores for both parties.
                </p>
              </div>
            </div>
            
            {/* Related Info */}
            <div className="card">
              <h2 className="text-xl font-semibold text-text-dark mb-4">Related Information</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-text-dark/60">Reported On</label>
                  <p className="text-text-dark">{formatDate(new Date(issue.createdAt))}</p>
                </div>
                
                <Link href={`/search?q=${issue.buyerId}`} className="block text-primary-green hover:underline text-sm">
                  View Buyer Profile →
                </Link>
                <Link href={`/search?q=${issue.supplierId}`} className="block text-primary-green hover:underline text-sm">
                  View Supplier Profile →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CreditScoreWidget from '@/components/CreditScoreWidget'
import { formatDate, getUserTypeFromUserId } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { LogOut } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

type ProfileData = {
  userId: string
  type: 'BUYER' | 'SUPPLIER'
  businessName: string
  phoneNumber: string
  address: string
  creditScore: number
  scoreHistory: Array<{ date: string; score: number }>
  paymentStats?: {
    onTimePercent: number
    avgDelayDays: number
    totalOverdue: number
    totalPaid: number
  }
  reliabilityScore?: number
  reliabilityMetrics?: {
    onTimeDelivery: number
    issueResolutionRate: number
    orderAccuracy: number
    totalOrders: number
    completedOrders: number
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const { language } = useLanguage()
  const [userId, setUserId] = useState<string>('')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scoreHistoryFilter, setScoreHistoryFilter] = useState<'current' | 'month' | 'quarter' | 'year'>('current')
  
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
      fetchProfile()
    }
  }, [userId])
  
  const fetchProfile = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/profile?userId=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }
      const data = await response.json()
      setProfile(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }
  
  const userType = getUserTypeFromUserId(userId) // Detect from userId (BJ = buyer, SP = supplier)
  
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    }
    // Clear session/localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('session')
      sessionStorage.clear()
    }
    router.push('/login')
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-white">
        <Navbar userId={userId} userType={userType} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <p className="text-text-dark/60">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }
  
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-cream-white">
        <Navbar userId={userId} userType={userType} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-text-dark font-semibold mb-2">Error Loading Profile</p>
            <p className="text-text-dark/60 mb-4">{error || 'Profile not found'}</p>
            <button onClick={fetchProfile} className="btn-primary">Retry</button>
          </div>
        </div>
      </div>
    )
  }
  
  // Filter score history based on selected filter
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const currentQuarter = Math.floor(currentMonth / 3) // 0 = Q1, 1 = Q2, 2 = Q3, 3 = Q4
  
  let filteredHistory = profile.scoreHistory
  if (scoreHistoryFilter === 'month') {
    filteredHistory = profile.scoreHistory.filter(item => {
      const itemDate = new Date(item.date)
      return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear
    })
  } else if (scoreHistoryFilter === 'quarter') {
    filteredHistory = profile.scoreHistory.filter(item => {
      const itemDate = new Date(item.date)
      const itemQuarter = Math.floor(itemDate.getMonth() / 3)
      return itemQuarter === currentQuarter && itemDate.getFullYear() === currentYear
    })
  } else if (scoreHistoryFilter === 'year') {
    filteredHistory = profile.scoreHistory.filter(item => {
      const itemDate = new Date(item.date)
      return itemDate.getFullYear() === currentYear
    })
  }
  
  // Calculate trend statistics
  const sortedHistory = [...filteredHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const firstScore = sortedHistory[0]?.score || 0
  const lastScore = sortedHistory[sortedHistory.length - 1]?.score || 0
  const scoreChange = lastScore - firstScore
  const scoreChangePercent = firstScore > 0 ? ((scoreChange / firstScore) * 100).toFixed(1) : '0.0'
  const isImproving = scoreChange > 0
  const avgScore = sortedHistory.reduce((sum, item) => sum + item.score, 0) / (sortedHistory.length || 1)
  
  const chartData = filteredHistory.map((item) => ({
    date: new Date(item.date).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'short', day: 'numeric' }),
    score: item.score,
  }))
  
  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={profile.userId} userType={profile.type as 'BUYER' | 'SUPPLIER'} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-dark mb-2">Profile</h1>
          <p className="text-text-dark/60">
            {userType === 'SUPPLIER' 
              ? 'Your account information and reliability history' 
              : 'Your account information and credit history'}
          </p>
        </div>
        
        {/* Profile Info Card */}
        <div className="card mb-8">
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-text-dark mb-4">Account Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-dark/60">User ID</label>
                  <p className="text-text-dark font-semibold text-lg">{profile.userId}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-text-dark/60">Business Name</label>
                  <p className="text-text-dark">{profile.businessName}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-text-dark/60">Phone Number</label>
                  <p className="text-text-dark">{profile.phoneNumber}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-text-dark/60">Address</label>
                  <p className="text-text-dark">{profile.address}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-text-dark/60">Account Type</label>
                  <p className="text-text-dark">{profile.type}</p>
                </div>
              </div>
            </div>
            
            <div className="md:w-64">
              <h2 className="text-xl font-semibold text-text-dark mb-4">
                {userType === 'SUPPLIER' ? 'Current Reliability Score' : 'Current Credit Score'}
              </h2>
              <CreditScoreWidget 
                score={userType === 'SUPPLIER' ? (profile.reliabilityScore || profile.creditScore) : profile.creditScore} 
                size="md" 
              />
            </div>
          </div>
        </div>
        
        {/* Score History Chart */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary-green" />
              <h2 className="text-2xl font-semibold text-text-dark">
                {userType === 'SUPPLIER' ? 'Reliability Score History' : 'Credit Score History'}
              </h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScoreHistoryFilter('current')}
                className={`px-3 py-1.5 text-xs font-medium rounded-button transition-colors ${
                  scoreHistoryFilter === 'current'
                    ? 'bg-primary-green text-white'
                    : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                }`}
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => setScoreHistoryFilter('month')}
                className={`px-3 py-1.5 text-xs font-medium rounded-button transition-colors ${
                  scoreHistoryFilter === 'month'
                    ? 'bg-primary-green text-white'
                    : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setScoreHistoryFilter('quarter')}
                className={`px-3 py-1.5 text-xs font-medium rounded-button transition-colors ${
                  scoreHistoryFilter === 'quarter'
                    ? 'bg-primary-green text-white'
                    : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                }`}
              >
                Quarter
              </button>
              <button
                type="button"
                onClick={() => setScoreHistoryFilter('year')}
                className={`px-3 py-1.5 text-xs font-medium rounded-button transition-colors ${
                  scoreHistoryFilter === 'year'
                    ? 'bg-primary-green text-white'
                    : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                }`}
              >
                Year
              </button>
            </div>
          </div>
          
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E3D9" />
                <XAxis dataKey="date" stroke="#2A2A2A" />
                <YAxis stroke="#2A2A2A" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#F7F4EF', 
                    border: '1px solid #C3C0B8',
                    borderRadius: '8px'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#4C6A4F" 
                  strokeWidth={3}
                  dot={{ fill: '#4C6A4F', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Trend Analysis */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-cream-grey">
            <div className="text-center">
              <p className="text-xs text-text-dark/60 mb-1">Score Change</p>
              <p className={`text-lg font-bold ${isImproving ? 'text-status-success' : scoreChange < 0 ? 'text-status-error' : 'text-text-dark'}`}>
                {isImproving ? '+' : ''}{scoreChange} points
              </p>
              <p className={`text-xs mt-1 ${isImproving ? 'text-status-success' : scoreChange < 0 ? 'text-status-error' : 'text-text-dark'}`}>
                {isImproving ? '↑' : scoreChange < 0 ? '↓' : '→'} {scoreChangePercent}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-dark/60 mb-1">Current Score</p>
              <p className="text-lg font-bold text-text-dark">{lastScore}</p>
              <p className="text-xs text-text-dark/60 mt-1">out of 100</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-dark/60 mb-1">Average Score</p>
              <p className="text-lg font-bold text-text-dark">{avgScore.toFixed(1)}</p>
              <p className="text-xs text-text-dark/60 mt-1">period average</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-dark/60 mb-1">Performance</p>
              <p className={`text-lg font-bold ${isImproving ? 'text-status-success' : scoreChange < 0 ? 'text-status-error' : 'text-status-warning'}`}>
                {isImproving ? 'Improving' : scoreChange < 0 ? 'Declining' : 'Stable'}
              </p>
              <p className="text-xs text-text-dark/60 mt-1">
                {sortedHistory.length} data point{sortedHistory.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        
        {/* Stats Section - Different for Buyer vs Supplier */}
        {userType === 'SUPPLIER' ? (
          <div className="card">
            <h2 className="text-2xl font-semibold text-text-dark mb-6">Reliability Metrics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-4 bg-status-success/10 rounded-button">
                <p className="text-sm font-medium text-text-dark/60 mb-1">On-Time Delivery</p>
                <p className="text-3xl font-bold text-status-success">{profile.reliabilityMetrics?.onTimeDelivery || 0}%</p>
              </div>
              
              <div className="p-4 bg-status-warning/10 rounded-button">
                <p className="text-sm font-medium text-text-dark/60 mb-1">Issue Resolution Rate</p>
                <p className="text-3xl font-bold text-status-warning">{profile.reliabilityMetrics?.issueResolutionRate || 0}%</p>
              </div>
              
              <div className="p-4 bg-primary-green/10 rounded-button">
                <p className="text-sm font-medium text-text-dark/60 mb-1">Order Accuracy</p>
                <p className="text-3xl font-bold text-primary-green">{profile.reliabilityMetrics?.orderAccuracy || 0}%</p>
              </div>
              
              <div className="p-4 bg-primary-olive/10 rounded-button">
                <p className="text-sm font-medium text-text-dark/60 mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-primary-olive">{profile.reliabilityMetrics?.totalOrders || 0}</p>
              </div>
              
              <div className="p-4 bg-status-success/10 rounded-button">
                <p className="text-sm font-medium text-text-dark/60 mb-1">Completed Orders</p>
                <p className="text-3xl font-bold text-status-success">{profile.reliabilityMetrics?.completedOrders || 0}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <h2 className="text-2xl font-semibold text-text-dark mb-6">Payment Behavior</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-4 bg-status-success/10 rounded-button">
                <p className="text-sm font-medium text-text-dark/60 mb-1">On-Time Payment Rate</p>
                <p className="text-3xl font-bold text-status-success">{profile.paymentStats?.onTimePercent || 0}%</p>
              </div>
              
              <div className="p-4 bg-status-warning/10 rounded-button">
                <p className="text-sm font-medium text-text-dark/60 mb-1">Average Delay Days</p>
                <p className="text-3xl font-bold text-status-warning">{profile.paymentStats?.avgDelayDays || 0}</p>
              </div>
              
              <div className="p-4 bg-status-error/10 rounded-button">
                <p className="text-sm font-medium text-text-dark/60 mb-1">Total Overdue Cases</p>
                <p className="text-3xl font-bold text-status-error">{profile.paymentStats?.totalOverdue || 0}</p>
              </div>
              
              <div className="p-4 bg-primary-green/10 rounded-button">
                <p className="text-sm font-medium text-text-dark/60 mb-1">Total Paid Invoices</p>
                <p className="text-3xl font-bold text-primary-green">{profile.paymentStats?.totalPaid || 0}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Logout Button at Bottom */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium text-status-error hover:bg-status-error/10 transition-colors rounded-button border-2 border-status-error/30 hover:border-status-error"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}


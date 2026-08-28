'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CreditScoreWidget from '@/components/CreditScoreWidget'
import Link from 'next/link'
import { Plus, FileText, AlertCircle, CheckCircle, Clock, TrendingUp, Package, Users, ArrowRight, Search, Filter, Wallet, DollarSign, Sparkles, X } from 'lucide-react'
import { formatCurrency, formatDate, getScoreLabel, getScoreColor, getUserTypeFromUserId } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type DashboardData = {
  userId: string
  userType: 'BUYER' | 'SUPPLIER'
  businessName: string
  reliabilityScore?: number
  creditScore?: number
  buyers?: any[]
  suppliers?: any[]
  ongoingOrders: any[]
  reliabilityMetrics?: any
  paymentMetrics?: any
  financialMetrics?: {
    totalReceivables: number
    receivablesChange: number
    overdueAmount: number
    activeBuyers: number
    avgDaysSalesOutstanding: number
    invoiceAging: {
      current: number
      days1to30: number
      days31to60: number
      days60Plus: number
    }
    riskDistribution: {
      high: number
      medium: number
      low: number
    }
  }
}


export default function DashboardPage() {
  const { language } = useLanguage()
  const t = translations[language].dashboard
  
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [userType, setUserType] = useState<'BUYER' | 'SUPPLIER'>('BUYER')
  const [showWelcome, setShowWelcome] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Get userId and userType from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if user has selected a dashboard type
      const selectedUserType = localStorage.getItem('selectedUserType') as 'BUYER' | 'SUPPLIER' | null
      
      // If no selection has been made, redirect to selection page
      if (!selectedUserType) {
        router.replace('/select-dashboard')
        return
      }
      
      // Use selected userType
      setUserType(selectedUserType)
      
      // Get or set userId based on selected type
      let storedUserId = localStorage.getItem('userId')
      
      // If no userId stored, set default based on type
      if (!storedUserId) {
        storedUserId = selectedUserType === 'BUYER' ? 'BJ9436' : 'SP0023'
        localStorage.setItem('userId', storedUserId)
      }
      
      setUserId(storedUserId)
      setIsChecking(false)
      
      fetchDashboardData(storedUserId, selectedUserType)
      
      // Check for welcome query param (new registration)
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('welcome') === 'true') {
        setShowWelcome(true)
        // Remove the query param from URL
        window.history.replaceState({}, '', '/dashboard')
        // Auto-hide after 5 seconds
        setTimeout(() => setShowWelcome(false), 5000)
      }
    }
  }, [router])
  
  const fetchDashboardData = async (uid: string, utype: 'BUYER' | 'SUPPLIER') => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/dashboard?userId=${uid}&userType=${utype}`)
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }
      const data = await response.json()
      setDashboardData(data)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }
  
  if (isChecking || !userId || isLoading || !dashboardData) {
    return (
      <div className="min-h-screen bg-cream-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-dark/60">Loading dashboard...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-cream-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-status-error mx-auto mb-4" />
          <p className="text-text-dark font-semibold mb-2">Error Loading Dashboard</p>
          <p className="text-text-dark/60">{error}</p>
          <button 
            onClick={() => fetchDashboardData(userId, userType)}
            className="mt-4 btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  
  const supplierData = userType === 'SUPPLIER' ? dashboardData : null
  const buyerData = userType === 'BUYER' ? dashboardData : null

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      'Low Risk': { bg: 'bg-status-success/10', text: 'text-status-success' },
      'Medium Risk': { bg: 'bg-status-warning/10', text: 'text-status-warning' },
      'High Risk': { bg: 'bg-status-error/10', text: 'text-status-error' },
      'High Reliability': { bg: 'bg-status-success/10', text: 'text-status-success' },
      'Medium Reliability': { bg: 'bg-status-warning/10', text: 'text-status-warning' },
      'Low Reliability': { bg: 'bg-status-error/10', text: 'text-status-error' },
      'PENDING': { bg: 'bg-slate-200', text: 'text-slate-600' },
      'DUE_SOON': { bg: 'bg-status-warning/10', text: 'text-status-warning' },
      'OVERDUE': { bg: 'bg-status-error/10', text: 'text-status-error' },
    }
    const config = statusConfig[status] || { bg: 'bg-cream-grey/20', text: 'text-text-dark' }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {status}
      </span>
    )
  }

  // Handler to switch dashboard type
  const handleSwitchDashboard = (newType: 'BUYER' | 'SUPPLIER') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedUserType', newType)
      // Set default userId based on type
      const defaultUserId = newType === 'BUYER' ? 'BJ9436' : 'SP0023'
      localStorage.setItem('userId', defaultUserId)
      // Reload to apply changes
      window.location.reload()
    }
  }

  if (userType === 'SUPPLIER' && supplierData) {
    return (
      <div className="min-h-screen bg-cream-white">
        <Navbar userId={userId || supplierData.userId} userType={userType} />
        
        <div className="container mx-auto px-4 py-8">
          {/* Welcome Banner for New Users */}
          {showWelcome && (
            <div className="mb-6 p-4 bg-gradient-to-r from-primary-green to-primary-olive rounded-xl text-white relative overflow-hidden animate-in slide-in-from-top duration-300">
              <button 
                onClick={() => setShowWelcome(false)}
                className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Welcome to Buyamia Credit! 🎉</h3>
                  <p className="text-white/80 text-sm">Your account has been set up successfully. Start exploring your dashboard.</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Header with Add Invoice Button */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-text-dark mb-2">{t.welcomeBack}, {supplierData.businessName}</h1>
              <p className="text-xl font-medium text-text-dark/70">{t.supplierDashboard}</p>
            </div>
            <Link
              href="/invoices/new"
              className="btn-primary flex items-center gap-2 group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              Add Invoice
            </Link>
          </div>

          {/* Reliability Score Section */}
          <div className="card-elevated mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-olive/20 to-primary-green/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary-olive" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text-dark">{t.reliabilityScore}</h2>
                <p className="text-sm text-text-dark/60">{t.yourFulfillmentPerformance}</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center justify-center">
                <CreditScoreWidget score={supplierData.reliabilityScore || 50} size="lg" />
                <p className="mt-4 text-sm text-text-dark/60 text-center max-w-xs">
                  {t.basedOnMetrics}
                </p>
              </div>
              
              {/* Metrics Breakdown */}
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-primary-green/5 to-primary-olive/5 rounded-xl border border-primary-green/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-dark">On-Time Delivery</span>
                    <span className="text-lg font-bold text-primary-green">{supplierData.reliabilityMetrics?.onTimeDelivery || 0}%</span>
                  </div>
                  <div className="w-full bg-cream-grey/30 rounded-full h-2">
                    <div 
                      className="bg-primary-green h-2 rounded-full transition-all duration-500"
                      style={{ width: `${supplierData.reliabilityMetrics?.onTimeDelivery || 0}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="p-4 bg-gradient-to-br from-primary-olive/5 to-primary-green/5 rounded-xl border border-primary-olive/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-dark">{t.issueResolutionRate}</span>
                    <span className="text-lg font-bold text-primary-olive">{supplierData.reliabilityMetrics?.issueResolutionRate || 0}%</span>
                  </div>
                  <div className="w-full bg-cream-grey/30 rounded-full h-2">
                    <div 
                      className="bg-primary-olive h-2 rounded-full transition-all duration-500"
                      style={{ width: `${supplierData.reliabilityMetrics?.issueResolutionRate || 0}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="p-4 bg-gradient-to-br from-primary-green/5 to-primary-olive/5 rounded-xl border border-primary-green/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-dark">{t.orderAccuracy}</span>
                    <span className="text-lg font-bold text-primary-green">{supplierData.reliabilityMetrics?.orderAccuracy || 0}%</span>
                  </div>
                  <div className="w-full bg-cream-grey/30 rounded-full h-2">
                    <div 
                      className="bg-primary-green h-2 rounded-full transition-all duration-500"
                      style={{ width: `${supplierData.reliabilityMetrics?.orderAccuracy || 0}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="p-4 bg-cream-beige/50 rounded-xl border border-cream-grey/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-dark">{t.averageDeliveryTime}</span>
                    <span className="text-lg font-bold text-text-dark">{supplierData.reliabilityMetrics?.averageDeliveryTime || 0} days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Dashboard Metrics */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-dark mb-6">Financial Dashboard</h2>
            
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="card-elevated p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-dark/60">{language === 'id' ? 'Total Piutang' : 'Total Receivables'}</span>
                  <Wallet className="w-5 h-5 text-primary-green" />
                </div>
                <p className="text-3xl font-bold text-text-dark mb-1">
                  {supplierData.financialMetrics ? formatCurrency(supplierData.financialMetrics.totalReceivables) : 'Rp0'}
                </p>
                <p className={`text-xs ${supplierData.financialMetrics?.receivablesChange && supplierData.financialMetrics.receivablesChange >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                  {supplierData.financialMetrics?.receivablesChange !== undefined 
                    ? `${supplierData.financialMetrics.receivablesChange >= 0 ? '+' : ''}${supplierData.financialMetrics.receivablesChange}% from last month`
                    : 'No data'}
                </p>
              </div>
              
              <div className="card-elevated p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-dark/60">{language === 'id' ? 'Jumlah Tunggakan' : 'Overdue Amount'}</span>
                  <AlertCircle className="w-5 h-5 text-status-error" />
                </div>
                <p className="text-3xl font-bold text-text-dark mb-1">
                  {supplierData.financialMetrics ? formatCurrency(supplierData.financialMetrics.overdueAmount) : 'Rp0'}
                </p>
                <p className="text-xs text-status-error">
                  {supplierData.financialMetrics?.overdueAmount && supplierData.financialMetrics.overdueAmount > 0 
                    ? 'Requires attention' 
                    : 'No overdue invoices'}
                </p>
              </div>
              
              <div className="card-elevated p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-dark/60">{language === 'id' ? 'Pembeli Aktif' : 'Active Buyers'}</span>
                  <Users className="w-5 h-5 text-primary-olive" />
                </div>
                <p className="text-3xl font-bold text-text-dark mb-1">
                  {supplierData.financialMetrics?.activeBuyers ?? supplierData.buyers?.length ?? 0}
                </p>
                <p className="text-xs text-text-dark/60">
                  {supplierData.paymentMetrics?.blacklistedBuyersCount 
                    ? `${supplierData.paymentMetrics.blacklistedBuyersCount} blacklisted`
                    : 'All buyers active'}
                </p>
              </div>
              
              <div className="card-elevated p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-dark/60">Avg. Days Sales Outstanding</span>
                  <TrendingUp className="w-5 h-5 text-primary-green" />
                </div>
                <p className="text-3xl font-bold text-text-dark mb-1">
                  {supplierData.financialMetrics?.avgDaysSalesOutstanding ?? 0} Days
                </p>
                <p className="text-xs text-text-dark/60">Industry avg: 45 days</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Invoice Aging Report */}
              <div className="card-elevated p-6">
                <h3 className="text-lg font-bold text-text-dark mb-4">Invoice Aging Report</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={supplierData.financialMetrics ? [
                    { name: 'Current', amount: supplierData.financialMetrics.invoiceAging.current / 1000000 },
                    { name: '1-30 Days', amount: supplierData.financialMetrics.invoiceAging.days1to30 / 1000000 },
                    { name: '31-60 Days', amount: supplierData.financialMetrics.invoiceAging.days31to60 / 1000000 },
                    { name: '60+ Days', amount: supplierData.financialMetrics.invoiceAging.days60Plus / 1000000 },
                  ] : [
                    { name: 'Current', amount: 0 },
                    { name: '1-30 Days', amount: 0 },
                    { name: '31-60 Days', amount: 0 },
                    { name: '60+ Days', amount: 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E3D9" />
                    <XAxis dataKey="name" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip 
                      formatter={(value: number) => [`Rp${(value * 1000000).toLocaleString('id-ID')}`, 'Amount']}
                      contentStyle={{ backgroundColor: '#F7F4EF', border: '1px solid #E8E3D9', borderRadius: '8px' }}
                    />
                    <Bar dataKey="amount" fill="#4C6A4F" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Portfolio Risk Distribution */}
              <div className="card-elevated p-6">
                <h3 className="text-lg font-bold text-text-dark mb-4">Portfolio Risk Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={supplierData.financialMetrics ? [
                        { name: 'High', value: supplierData.financialMetrics.riskDistribution.high, color: '#B44A4A' },
                        { name: 'Medium', value: supplierData.financialMetrics.riskDistribution.medium, color: '#C69F33' },
                        { name: 'Low', value: supplierData.financialMetrics.riskDistribution.low, color: '#3C7F58' },
                      ] : [
                        { name: 'High', value: 0, color: '#B44A4A' },
                        { name: 'Medium', value: 0, color: '#C69F33' },
                        { name: 'Low', value: 0, color: '#3C7F58' },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(supplierData.financialMetrics ? [
                        { name: 'High', value: supplierData.financialMetrics.riskDistribution.high, color: '#B44A4A' },
                        { name: 'Medium', value: supplierData.financialMetrics.riskDistribution.medium, color: '#C69F33' },
                        { name: 'Low', value: supplierData.financialMetrics.riskDistribution.low, color: '#3C7F58' },
                      ] : [
                        { name: 'High', value: 0, color: '#B44A4A' },
                        { name: 'Medium', value: 0, color: '#C69F33' },
                        { name: 'Low', value: 0, color: '#3C7F58' },
                      ]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Ongoing Orders Table Section */}
          <div className="card-elevated">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-olive/20 to-primary-green/20 flex items-center justify-center">
                  <Package className="w-6 h-6 text-primary-olive" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-dark">{t.ongoingOrders}</h2>
                  <p className="text-sm text-text-dark/60">{t.activeInvoicesAndPayment}</p>
                </div>
              </div>
              <Link
                href="/invoices"
                className="text-sm font-medium text-primary-green hover:text-primary-olive transition-colors flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-cream-grey">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-text-dark">{t.invoiceNumber}</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-text-dark">{t.buyer}</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-text-dark">{t.amount}</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-text-dark">{t.dueDate}</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">{t.paymentTerm}</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">{t.status}</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">{t.days}</th>
                  </tr>
                </thead>
                <tbody>
                  {(supplierData.ongoingOrders || []).slice(0, 3).map((order, index) => (
                    <tr 
                      key={order.invoiceNumber}
                      className={`border-b border-cream-grey/50 hover:bg-cream-beige/30 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-cream-white/50'
                      }`}
                    >
                      <td className="py-4 px-4">
                        <span className="font-semibold text-primary-green">{order.invoiceNumber}</span>
                        <p className="text-xs text-text-dark/60 mt-1">Order: {order.orderId}</p>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <span className="font-medium text-text-dark block">{order.buyerName}</span>
                          <span className="text-xs text-text-dark/60">{order.buyerId}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-text-dark">{formatCurrency(order.amount)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-text-dark">{formatDate(order.dueDate, language)}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-olive/10 text-primary-olive">
                          {order.paymentTerm === 'COD' ? 'COD' :
                           order.paymentTerm === 'NET7' ? 'Net 7' :
                           order.paymentTerm === 'NET14' ? 'Net 14' :
                           order.paymentTerm === 'NET30' ? 'Net 30' : order.paymentTerm}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {order.status === 'OVERDUE' ? (
                          <span className="text-status-error text-sm">
                            {order.daysOverdue} {t.daysOverdue}
                          </span>
                        ) : order.status === 'DUE_SOON' ? (
                          <span className="text-status-warning text-sm">
                            {t.dueIn} {order.daysUntilDue} {t.days}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-sm">
                            {order.daysUntilDue} {t.daysLeft}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (userType === 'BUYER' && buyerData) {
    return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId || buyerData.userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Banner for New Users */}
        {showWelcome && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl text-white relative overflow-hidden animate-in slide-in-from-top duration-300">
            <button 
              onClick={() => setShowWelcome(false)}
              className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Welcome to Buyamia Credit! 🎉</h3>
                <p className="text-white/80 text-sm">Your account has been set up successfully. Start exploring your dashboard.</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Header with Dashboard Switcher */}
        <div className="flex items-center justify-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-dark mb-2">{t.welcomeBack}, {buyerData.businessName}</h1>
            <p className="text-xl font-medium text-text-dark/70">{t.buyerDashboard}</p>
          </div>
        </div>

        {/* Credit Score Section */}
        <div className="card-elevated mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-green/20 to-primary-olive/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-green" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-text-dark">{t.creditScore}</h2>
              <p className="text-sm text-text-dark/60">{t.paymentBehavior}</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Score Widget */}
            <div className="flex flex-col items-center justify-center">
              <CreditScoreWidget score={buyerData.creditScore || 50} size="lg" />
              <p className="mt-4 text-sm text-text-dark/60 text-center max-w-xs">
                {t.basedOnPaymentHistory}
              </p>
            </div>
            
            {/* Metrics Breakdown */}
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-primary-green/5 to-primary-olive/5 rounded-xl border border-primary-green/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-dark">{t.onTimePayments}</span>
                  <span className="text-lg font-bold text-primary-green">{buyerData.paymentMetrics?.onTimePaymentRate || 0}%</span>
                </div>
                <div className="w-full bg-cream-grey/30 rounded-full h-2">
                  <div 
                    className="bg-primary-green h-2 rounded-full transition-all duration-500"
                    style={{ width: `${buyerData.paymentMetrics?.onTimePaymentRate || 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="p-4 bg-gradient-to-br from-primary-olive/5 to-primary-green/5 rounded-xl border border-primary-olive/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-dark">{t.latePayments}</span>
                  <span className="text-lg font-bold text-status-warning">{buyerData.paymentMetrics?.latePaymentRate || 0}%</span>
                </div>
                <div className="w-full bg-cream-grey/30 rounded-full h-2">
                  <div 
                    className="bg-status-warning h-2 rounded-full transition-all duration-500"
                    style={{ width: `${buyerData.paymentMetrics?.latePaymentRate || 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="p-4 bg-gradient-to-br from-primary-green/5 to-primary-olive/5 rounded-xl border border-primary-green/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-dark">{t.issuesReported}</span>
                  <span className="text-lg font-bold text-status-error">{buyerData.paymentMetrics?.defaultedPayments || 0}</span>
                </div>
                <div className="w-full bg-cream-grey/30 rounded-full h-2">
                  <div 
                    className="bg-status-error h-2 rounded-full transition-all duration-500"
                    style={{ width: `${buyerData.paymentMetrics?.totalPayments ? ((buyerData.paymentMetrics?.defaultedPayments || 0) / buyerData.paymentMetrics.totalPayments) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="p-4 bg-cream-beige/50 rounded-xl border border-cream-grey/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-dark">{t.averagePaymentDelay}</span>
                  <span className="text-lg font-bold text-text-dark">{buyerData.paymentMetrics?.averagePaymentDelay || 0} days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Suppliers Overview Table Section */}
        <div className="card-elevated mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-green/20 to-primary-olive/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-green" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text-dark">{t.suppliersOverview}</h2>
                <p className="text-sm text-text-dark/60">{t.reliabilityScoresAndPerformance}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg border border-cream-grey hover:bg-cream-beige transition-colors">
                <Filter className="w-5 h-5 text-text-dark/60" />
              </button>
              <button className="p-2 rounded-lg border border-cream-grey hover:bg-cream-beige transition-colors">
                <Search className="w-5 h-5 text-text-dark/60" />
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-cream-grey">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-text-dark">{t.supplierId}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-text-dark">{t.businessName}</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">Reliability Score</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">{t.onTimeDelivery}</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">{t.status}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-text-dark">{t.lastOrder}</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">{t.orders}</th>
                </tr>
              </thead>
              <tbody>
                {(buyerData.suppliers || []).map((supplier, index) => {
                  const getReliabilityColor = (score: number): string => {
                    if (score >= 80) return '#3C7F58' // Green
                    if (score >= 60) return '#C69F33' // Mustard
                    return '#B44A4A' // Red
                  }
                  const reliabilityColor = getReliabilityColor(supplier.reliabilityScore)
                  
                  return (
                    <tr 
                      key={supplier.supplierId}
                      className={`border-b border-cream-grey/50 hover:bg-cream-beige/30 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-cream-white/50'
                      }`}
                    >
                      <td className="py-4 px-4">
                        <span className="font-semibold text-primary-green">{supplier.supplierId}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-text-dark">{supplier.businessName}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="relative w-12 h-12">
                            <svg className="transform -rotate-90" width="48" height="48">
                              <circle
                                cx="24"
                                cy="24"
                                r="18"
                                stroke="#E8E3D9"
                                strokeWidth="4"
                                fill="none"
                              />
                              <circle
                                cx="24"
                                cy="24"
                                r="18"
                                stroke={reliabilityColor}
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={113}
                                strokeDashoffset={113 - (supplier.reliabilityScore / 100) * 113}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-bold" style={{ color: reliabilityColor }}>
                                {supplier.reliabilityScore}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm font-medium text-text-dark">{supplier.onTimeDelivery}%</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {getStatusBadge(supplier.status)}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-text-dark/60">{formatDate(supplier.lastOrderDate, language)}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm text-text-dark/60">{supplier.completedOrders}/{supplier.totalOrders}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ongoing Orders Table Section */}
        <div className="card-elevated">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-olive/20 to-primary-green/20 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary-olive" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text-dark">{t.ongoingOrders}</h2>
                <p className="text-sm text-text-dark/60">{t.invoicesToPay}</p>
              </div>
            </div>
            <Link
              href="/invoices"
              className="text-sm font-medium text-primary-green hover:text-primary-olive transition-colors flex items-center gap-1"
            >
              {t.viewAll}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-cream-grey">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-text-dark">{t.invoiceNumber}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-text-dark">Supplier</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-text-dark">{t.amount}</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-text-dark">{t.dueDate}</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">{t.paymentTerm}</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">{t.status}</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-text-dark">{t.days}</th>
                </tr>
              </thead>
              <tbody>
                {(buyerData.ongoingOrders || []).slice(0, 3).map((order, index) => (
                  <tr 
                    key={order.invoiceNumber}
                    className={`border-b border-cream-grey/50 hover:bg-cream-beige/30 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-cream-white/50'
                    }`}
                  >
                    <td className="py-4 px-4">
                      <span className="font-semibold text-primary-green">{order.invoiceNumber}</span>
                      <p className="text-xs text-text-dark/60 mt-1">Order: {order.orderId}</p>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <span className="font-medium text-text-dark block">{order.supplierName}</span>
                        <span className="text-xs text-text-dark/60">{order.supplierId}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-semibold text-text-dark">{formatCurrency(order.amount)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-text-dark">{formatDate(order.dueDate)}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-olive/10 text-primary-olive">
                        {order.paymentTerm === 'COD' ? 'COD' :
                         order.paymentTerm === 'NET7' ? 'Net 7' :
                         order.paymentTerm === 'NET14' ? 'Net 14' :
                         order.paymentTerm === 'NET30' ? 'Net 30' : order.paymentTerm}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {order.status === 'OVERDUE' ? (
                        <span className="text-status-error text-sm">
                          {(order as any).daysOverdue} {t.daysOverdue}
                        </span>
                      ) : order.status === 'DUE_SOON' ? (
                        <span className="text-status-warning text-sm">
                          {t.dueIn} {order.daysUntilDue} {t.days}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-sm">
                          {order.daysUntilDue} {t.daysLeft}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    )
  }
  
  return null
}

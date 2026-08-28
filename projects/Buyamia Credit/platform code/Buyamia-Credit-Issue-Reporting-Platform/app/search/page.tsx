'use client'

import { useState, useEffect, useRef } from 'react'
import Navbar from '@/components/Navbar'
import CreditScoreWidget from '@/components/CreditScoreWidget'
import { Search, User, FileText, AlertCircle, TrendingUp, TrendingDown, Clock, DollarSign, CheckCircle, XCircle, Calendar, BarChart3, Shield, Package, MapPin, Phone, Mail, Building2, ArrowRight, Download, Users, Bell, Target, Network, X, Cloud, CloudRain } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate, getScoreColor, getUserTypeFromUserId } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'
import { parseRegions, getWeatherStatus, type WeatherData } from '@/lib/weather/client'

// Check if supplier serves "All Indonesia" or similar
const INDONESIA_WIDE_KEYWORDS = [
  'all indonesia',
  'seluruh indonesia',
  'indonesia-wide',
  'nationwide',
  'all regions',
  'semua wilayah',
  'indonesia',
]

// Common Indonesian regions to check for Indonesia-wide suppliers
const COMMON_INDONESIAN_REGIONS = [
  'Jakarta',
  'Bandung',
  'Surabaya',
  'Yogyakarta',
  'Tangerang',
  'Bali',
  'Medan',
  'Semarang',
  'Makassar',
  'Palembang',
  'Denpasar',
]

function isIndonesiaWide(regionsServed: string): boolean {
  if (!regionsServed) return false
  const lower = regionsServed.toLowerCase()
  return INDONESIA_WIDE_KEYWORDS.some(keyword => lower.includes(keyword))
}

// Get regions to check for weather (expanded for Indonesia-wide suppliers)
function getRegionsToCheck(regionsServed: string): string[] {
  if (isIndonesiaWide(regionsServed)) {
    // For Indonesia-wide, check common regions
    return COMMON_INDONESIAN_REGIONS
  }
  // For specific regions, use the listed ones
  return parseRegions(regionsServed)
}

// Check if a supplier serves a specific region
function supplierServesRegion(regionsServed: string, targetRegion: string): boolean {
  if (!regionsServed || !targetRegion) return false
  
  // If supplier serves all Indonesia, they serve all regions
  if (isIndonesiaWide(regionsServed)) {
    return true
  }
  
  // Check if target region is in the supplier's regions list
  const regions = parseRegions(regionsServed)
  return regions.some(region => 
    region.toLowerCase().trim() === targetRegion.toLowerCase().trim()
  )
}

// Get affected regions count and summary
function getWeatherSummary(regions: string[], weatherData: Record<string, WeatherData>) {
  const affectedRegions = regions.filter(region => {
    const weather = weatherData[region]
    if (!weather) return false
    const status = getWeatherStatus(weather)
    return status.status !== 'normal'
  })

  const severeRegions = regions.filter(region => {
    const weather = weatherData[region]
    if (!weather) return false
    const status = getWeatherStatus(weather)
    return status.status === 'severe'
  })

  return {
    total: regions.length,
    affected: affectedRegions.length,
    severe: severeRegions.length,
    affectedRegions,
    severeRegions,
  }
}

// Type definitions for search results
type BuyerResult = {
  userId: string
  type: 'BUYER'
  businessName: string
  phoneNumber: string
  email: string
  address: string
  businessType: string
  yearsInOperation: number
  businessRegistrationNumber: string
  creditScore: number
  creditScoreHistory: Array<{ date: string; score: number }>
  paymentStats: {
    onTimeRate: number
    averageDelayDays: number
    totalInvoices: number
    paidInvoices: number
    overdueInvoices: number
    totalOverdue: number
    averageInvoiceAmount: number
    preferredPaymentTerm: string
  }
  paymentHistory: Array<{
    invoice: string
    amount: number
    dueDate: string
    status: string
    paidDate: string | null
    delayDays: number
  }>
  pastIssues: Array<{
    issue: string
    type: string
    status: string
    date: string
    description: string
  }>
  riskLabel: string
  riskFactors: Array<{ type: string; message: string }>
  recentScoreChanges: Array<{ date: string; change: number; reason: string }>
}

type SupplierResult = {
  userId: string
  type: 'SUPPLIER'
  businessName: string
  phoneNumber: string
  email: string
  address: string
  categories: string[]
  regionsServed: string
  yearsInOperation: number
  reliabilityScore: number
  reliabilityScoreHistory: Array<{ date: string; score: number }>
  reliabilityMetrics: {
    onTimeDelivery: number
    issueResolutionRate: number
    orderAccuracy: number
    averageDeliveryTime: number
    totalOrders: number
    completedOrders: number
  }
  paymentTermsOffered: string[]
  pastIssues: Array<{
    issue: string
    type: string
    status: string
    date: string
    description: string
  }>
  riskLabel: string
  creditLimitRecommendation: number
  paymentPattern: {
    bestMonth: string
    worstMonth: string
    seasonalTrend: string
  }
  disputeHistory: {
    totalDisputes: number
    resolvedDisputes: number
    resolutionRate: number
    averageResolutionTime: number
  }
  networkConnections: {
    suppliers: string[]
    buyers: string[]
    totalConnections: number
  }
  industryBenchmark: {
    averageScore: number
    percentile: number
  }
  alerts: Array<{ type: string; message: string; date: string }>
}

type SupplierListItem = {
  supplierId: string
  businessName: string
  categories: string[]
  categoryLabels: string[]
  reliabilityScore: number
  onTimeDelivery: number
  totalOrders: number
  completedOrders: number
  regionsServed: string
  phoneNumber: string
  address: string
  yearsInOperation: number
  paymentTermsOffered: string[]
}

// Category mapping for search - maps database categories to frontend category values
const categoryMap: Record<string, string[]> = {
  // Fresh Food category
  'meat': ['fresh-food'],
  'fresh food': ['fresh-food'],
  'fresh': ['fresh-food'],
  'fresh vegetables': ['fresh-food'],
  'organic produce': ['fresh-food'],
  'poultry': ['fresh-food'],
  'seafood': ['fresh-food'],
  'fresh fish': ['fresh-food'],
  
  // Frozen Food category
  'frozen': ['frozen-food'],
  'frozen food': ['frozen-food'],
  'frozen seafood': ['frozen-food'],
  'ice cream': ['frozen-food'],
  
  // Dry Groceries category
  'groceries': ['dry-groceries'],
  'dry': ['dry-groceries'],
  'dry groceries': ['dry-groceries'],
  'spices': ['dry-groceries'],
  'condiments': ['dry-groceries'],
  
  // Beverages category
  'beverage': ['beverages'],
  'beverages': ['beverages'],
  'drink': ['beverages'],
  'juice': ['beverages'],
  'mineral water': ['beverages'],
  
  // Bakery category
  'bakery': ['bakery'],
  'pastry': ['bakery'],
  'bread': ['bakery'],
  
  // Packaging category
  'packaging': ['packaging-disposables'],
  'disposables': ['packaging-disposables'],
  'utensils': ['packaging-disposables'],
  
  // Cleaning category
  'cleaning': ['cleaning-sanitation'],
  'sanitation': ['cleaning-sanitation'],
  
  // Household category
  'household': ['household-general'],
  'general': ['household-general'],
  
  // Kitchen Equipment category
  'equipment': ['kitchen-equipment'],
  'kitchen': ['kitchen-equipment'],
  'kitchen equipment': ['kitchen-equipment'],
  'tools': ['kitchen-equipment'],
}

// Category options for selection - includes all categories found in database
const categoryOptions = [
  { value: 'fresh-food', label: 'Fresh Food' },
  { value: 'frozen-food', label: 'Frozen Food' },
  { value: 'dry-groceries', label: 'Dry Groceries' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'bakery', label: 'Bakery & Pastry' },
  { value: 'packaging-disposables', label: 'Packaging & Disposables' },
  { value: 'cleaning-sanitation', label: 'Cleaning & Sanitation' },
  { value: 'household-general', label: 'Household & General' },
  { value: 'kitchen-equipment', label: 'Kitchen Equipment & Tools' },
]

export default function SearchPage() {
  const [searchMode, setSearchMode] = useState<'user' | 'category'>('user')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [searchResult, setSearchResult] = useState<BuyerResult | SupplierResult | null>(null)
  const [supplierList, setSupplierList] = useState<SupplierListItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchResultRef = useRef<HTMLDivElement>(null)
  const [scoreHistoryFilter, setScoreHistoryFilter] = useState<'current' | 'month' | 'quarter' | 'year'>('current')
  const [weatherData, setWeatherData] = useState<Record<string, WeatherData>>({})
  const [loadingWeather, setLoadingWeather] = useState(false)
  const [weatherFilter, setWeatherFilter] = useState<'all' | 'no_issues'>('all')
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set())
  const [buyerLocation, setBuyerLocation] = useState<string>('Jakarta') // Mock - would come from buyer profile
  
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (searchMode === 'user') {
      if (!searchTerm.trim()) return
    } else {
      if (selectedCategories.length === 0) {
        alert('Please select at least one category')
        return
      }
    }
    
    setIsSearching(true)
    setSearchResult(null)
    setSupplierList([])
    
    try {
      if (searchMode === 'user') {
        // User ID search - call database API
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchTerm.trim())}`)
        
        if (!response.ok) {
          throw new Error('Search failed')
        }
        
        const data = await response.json()
        
        if (data.success && data.users && data.users.length > 0) {
          const user = data.users[0]
          
          // Debug: Log user data to check regionsServed
          console.log('[Search] User data from API:', {
            userId: user.userId,
            type: user.type,
            regionsServed: user.regionsServed,
            address: user.address,
            hasRegionsServed: 'regionsServed' in user,
            allKeys: Object.keys(user),
          })
          
          // Transform to expected format
          if (user.type === 'BUYER') {
            setSearchResult({
              userId: user.userId,
              type: 'BUYER',
              businessName: user.businessName,
              phoneNumber: user.phoneNumber || '',
              email: user.email || '',
              address: user.address || '',
              businessType: user.businessType || '',
              yearsInOperation: user.yearsInOperation || 0,
              businessRegistrationNumber: user.businessRegistrationNumber || '',
              creditScore: user.creditScore,
              creditScoreHistory: user.creditScoreHistory || [],
              paymentStats: {
                onTimeRate: user.totalInvoices > 0 ? Math.round((user.paidInvoices / user.totalInvoices) * 100) : 0,
                averageDelayDays: user.averageDelayDays || 0,
                totalInvoices: user.totalInvoices || 0,
                paidInvoices: user.paidInvoices || 0,
                overdueInvoices: (user.totalInvoices || 0) - (user.paidInvoices || 0),
                totalOverdue: user.totalOutstanding || 0,
                averageInvoiceAmount: user.averageInvoiceAmount || 0,
                preferredPaymentTerm: user.preferredPaymentTerm || 'Net 14',
              },
              paymentHistory: user.paymentHistory || [],
              pastIssues: user.pastIssues || [],
              riskLabel: user.riskLevel || 'Medium Risk',
              riskFactors: user.riskFactors || [],
              recentScoreChanges: user.recentScoreChanges || [],
            })
        } else {
            // For suppliers, ensure regionsServed is properly extracted
            // The API returns regionsServed, but we should also check address as fallback
            const regionsServedValue = user.regionsServed || user.address || ''
            
            console.log('[Search] Setting supplier result:', {
              userId: user.userId,
              regionsServed: regionsServedValue,
              fromUserRegionsServed: user.regionsServed,
              fromUserAddress: user.address,
            })
            
            setSearchResult({
              userId: user.userId,
              type: 'SUPPLIER',
              businessName: user.businessName,
              phoneNumber: user.phoneNumber || '',
              email: user.email || '',
              address: user.address || '',
              categories: user.categories || [],
              regionsServed: regionsServedValue,
              yearsInOperation: user.yearsInOperation || 0,
              reliabilityScore: user.reliabilityScore || user.creditScore,
              reliabilityScoreHistory: user.reliabilityScoreHistory || [],
              reliabilityMetrics: {
                onTimeDelivery: user.onTimeDelivery || 0,
                issueResolutionRate: user.issueResolutionRate || 0,
                orderAccuracy: user.orderAccuracy || 0,
                averageDeliveryTime: user.averageDeliveryTime || 0,
                totalOrders: user.totalOrders || 0,
                completedOrders: user.completedOrders || 0,
              },
              paymentTermsOffered: user.paymentTermsOffered || [],
              pastIssues: user.pastIssues || [],
              riskLabel: user.reliabilityLabel || 'Medium Reliability',
              creditLimitRecommendation: user.creditLimitRecommendation || 0,
              paymentPattern: user.paymentPattern || {
                bestMonth: '',
                worstMonth: '',
                seasonalTrend: 'Consistent',
              },
              disputeHistory: user.disputeHistory || {
                totalDisputes: 0,
                resolvedDisputes: 0,
                resolutionRate: 0,
                averageResolutionTime: 0,
              },
              networkConnections: user.networkConnections || {
                suppliers: [],
                buyers: [],
                totalConnections: 0,
              },
              industryBenchmark: user.industryBenchmark || {
                averageScore: 0,
                percentile: 0,
              },
              alerts: user.alerts || [],
            })
            
            // Fetch weather data for supplier's regions
            if (regionsServedValue) {
              const regions = parseRegions(regionsServedValue)
              console.log('[Search] Fetching weather for regions:', regions)
              fetchWeatherForRegions(regions)
            }
        }
      } else {
          alert('No user found with that ID')
        }
      } else {
        // Category search - find suppliers from database
        const response = await fetch(`/api/users/search?type=SUPPLIER`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('Search API error:', response.status, errorData)
          throw new Error(errorData.error || `Search failed: HTTP ${response.status}`)
        }
        
        const data = await response.json()
        
        // Check if API returned an error
        if (!data.success) {
          console.error('Search API returned error:', data)
          throw new Error(data.error || data.message || 'Search failed')
        }
        
        // Check if users array exists (even if empty)
        if (!data.users) {
          console.error('Search API returned invalid response:', data)
          throw new Error('Invalid response from server')
        }
        
        // Debug: Log all users to see what's being returned
        if (data.users && data.users.length > 0) {
          console.log('=== API Response Debug ===')
          console.log('Total users:', data.users.length)
          console.log('Selected categories:', selectedCategories)
          data.users.forEach((user: any, index: number) => {
            console.log(`\n--- User ${index + 1} ---`)
            console.log('userId:', user.userId)
            console.log('businessName:', user.businessName)
            console.log('categories (raw):', user.categories)
            console.log('categories type:', typeof user.categories)
            console.log('categories value (stringified):', JSON.stringify(user.categories))
            console.log('hasCategories:', !!user.categories)
            console.log('categories in user:', 'categories' in user)
            console.log('allKeys:', Object.keys(user))
          })
          console.log('\n=== End API Response Debug ===\n')
        }
        
        // Process suppliers (even if empty array)
        if (data.users) {
          // Helper function to map database categories to frontend category values
          const mapCategoriesToFrontend = (dbCategories: string[]): string[] => {
            const frontendCategories = new Set<string>()
            
            dbCategories.forEach(dbCat => {
              const normalized = dbCat.toLowerCase().trim()
              
              // First try exact match (most reliable)
              if (categoryMap[normalized]) {
                categoryMap[normalized].forEach(val => frontendCategories.add(val))
              } else {
                // Then try partial match (database category contains key or vice versa)
                Object.entries(categoryMap).forEach(([key, values]) => {
                  const keyLower = key.toLowerCase().trim()
                  // Check if normalized category exactly matches key, or contains it, or is contained by it
                  if (normalized === keyLower || 
                      normalized.includes(keyLower) || 
                      keyLower.includes(normalized)) {
                    values.forEach(val => frontendCategories.add(val))
                  }
                })
              }
            })
            
            return Array.from(frontendCategories)
          }
          
          // Helper function to check if supplier matches selected categories
          const matchesSelectedCategories = (user: any): boolean => {
            console.log(`\n🔍 Checking user: ${user.userId} (${user.businessName})`)
            console.log('  Selected categories:', selectedCategories)
            
            if (selectedCategories.length === 0) {
              console.log('  ✅ No categories selected, showing all')
              return true
            }
            
            // API guarantees categories is always an array (never null/undefined)
            const categoriesArray: string[] = Array.isArray(user.categories) ? user.categories : []
            console.log('  Categories array:', categoriesArray, 'Length:', categoriesArray.length)
            
            // Skip if empty array
            if (categoriesArray.length === 0) {
              console.log('  ❌ No categories in array')
              return false
            }
            
            console.log('  📋 Database categories:', categoriesArray)
            
            // Map database categories to frontend categories
            const frontendCategories = mapCategoriesToFrontend(categoriesArray)
            console.log('  🗺️  Mapped to frontend categories:', frontendCategories)
            
            // Must have at least one mapped category
            if (frontendCategories.length === 0) {
              console.log('  ❌ No frontend categories after mapping')
              return false
            }
            
            // Check if any selected category matches
            const matches = selectedCategories.some(selectedCat => 
              frontendCategories.includes(selectedCat)
            )
            
            console.log('  ' + (matches ? '✅ MATCH' : '❌ NO MATCH'))
            return matches
          }
          
          // Filter suppliers by selected categories
          console.log('\n🎯 Starting category filter...')
          console.log('Total suppliers from API:', data.users.length)
          console.log('Selected categories:', selectedCategories)
          
          let filteredUsers = data.users
          if (selectedCategories.length > 0) {
            filteredUsers = data.users.filter(matchesSelectedCategories)
          }
          
          console.log(`\n📊 Filter Results:`)
          console.log(`  Total suppliers: ${data.users.length}`)
          console.log(`  Filtered suppliers: ${filteredUsers.length}`)
          console.log(`  Filtered supplier IDs:`, filteredUsers.map((s: any) => s.userId))
          console.log('\n')
          
          // Transform suppliers to expected format
          const suppliers = filteredUsers.map((user: any) => {
            // Parse categories and create labels
            let dbCategories: string[] = []
            let categoryLabels: string[] = []
            
            if (user.categories) {
              try {
                dbCategories = typeof user.categories === 'string' 
                  ? JSON.parse(user.categories) 
                  : user.categories
                categoryLabels = dbCategories // Use database categories as labels
              } catch (e) {
                console.warn('Failed to parse categories:', e)
              }
            }
            
            // Debug: Log regionsServed from API
            if (filteredUsers.indexOf(user) < 3) {
              console.log(`[Frontend] Supplier ${user.userId}:`, {
                regionsServed: user.regionsServed,
                address: user.address,
                hasRegionsServed: 'regionsServed' in user,
              })
            }
            
            return {
              supplierId: user.userId,
              businessName: user.businessName,
              categories: dbCategories,
              categoryLabels: categoryLabels,
              reliabilityScore: user.reliabilityScore || user.creditScore,
              onTimeDelivery: user.onTimeDelivery || 0,
              totalOrders: user.totalOrders || 0,
              completedOrders: user.completedOrders || 0,
              regionsServed: user.regionsServed || user.address || '',
              phoneNumber: user.phoneNumber || '',
              address: user.address || '',
              yearsInOperation: 0,
              paymentTermsOffered: [],
            }
          })
        
          // Sort by reliability score
          const sortedSuppliers = suppliers.sort((a: any, b: any) => b.reliabilityScore - a.reliabilityScore)
          setSupplierList(sortedSuppliers)
        }
      }
    } catch (error) {
      console.error('Error searching:', error)
      const errorMessage = error instanceof Error ? error.message : 'Search failed. Please try again.'
      console.error('Full error details:', error)
      alert(errorMessage)
      setSearchResult(null)
      setSupplierList([])
    } finally {
      setIsSearching(false)
    }
  }
  
  const handleClearSearch = () => {
    setSearchTerm('')
    setSelectedCategories([])
    setSearchResult(null)
    setSupplierList([])
    setIsSearching(false)
  }

  const handleCategoryToggle = (categoryValue: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryValue)) {
        return prev.filter(c => c !== categoryValue)
      } else {
        return [...prev, categoryValue]
      }
    })
  }
  
  const handleCategorySearch = () => {
    if (selectedCategories.length === 0) {
      alert('Please select at least one category')
      return
    }
    handleSearch()
  }

  // Fetch weather data for specific regions
  const fetchWeatherForRegions = async (regions: string[]) => {
    setLoadingWeather(true)
    try {
      if (regions.length === 0) {
        setLoadingWeather(false)
        return
      }

      // Fetch weather for all regions
      const response = await fetch(`/api/weather?regions=${regions.join(',')}`)
      
      if (!response.ok) {
        console.error('Failed to fetch weather data')
        setLoadingWeather(false)
        return
      }

      const result = await response.json()
      if (result.success && result.data) {
        setWeatherData(prev => ({ ...prev, ...result.data }))
      }
    } catch (error) {
      console.error('Error fetching weather:', error)
    } finally {
      setLoadingWeather(false)
    }
  }

  // Fetch weather data for suppliers
  const fetchWeatherForSuppliers = async (suppliers: SupplierListItem[]) => {
    // Collect all unique regions from all suppliers
    const allRegions = new Set<string>()
    suppliers.forEach(supplier => {
      const regions = parseRegions(supplier.regionsServed)
      regions.forEach(region => allRegions.add(region))
    })

    if (allRegions.size > 0) {
      const regionsArray = Array.from(allRegions)
      await fetchWeatherForRegions(regionsArray)
    }
  }
  
  const isBuyer = searchResult?.type === 'BUYER'
  const isSupplier = searchResult?.type === 'SUPPLIER'
  
  // TODO: Get userId from auth context/session
  // For now, get userId from localStorage (set during login)
  const [userId, setUserId] = useState<string>('')
  const { language } = useLanguage()
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        setUserId(storedUserId)
      } else {
        // Default fallback to buyer
        const defaultUserId = 'BJ1045'
        localStorage.setItem('userId', defaultUserId)
        setUserId(defaultUserId)
      }
    }
  }, [])

  // Auto-scroll to search result when it's displayed
  useEffect(() => {
    if (searchResult && searchResultRef.current) {
      // Small delay to ensure the DOM has updated
      setTimeout(() => {
        searchResultRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 100)
    }
  }, [searchResult])
  
  const userType = getUserTypeFromUserId(userId)
  const tSearch = translations[language].searchPage
  
  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-dark mb-2">
            {userType === 'BUYER' ? 'Search for Suppliers' : 'Search Buyer/Supplier'}
          </h1>
          <p className="text-text-dark/60">
            {userType === 'BUYER' 
              ? 'Find suppliers by category or search by ID' 
              : 'Comprehensive credit profiles and payment history'}
          </p>
        </div>
        
        {/* Search Mode Toggle - Only for Buyers */}
        {userType === 'BUYER' && (
          <div className="card-elevated mb-6">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setSearchMode('user')
                  setSearchTerm('')
                  setSearchResult(null)
                  setSupplierList([])
                }}
                className={`flex-1 px-4 py-3 rounded-button font-medium transition-colors ${
                  searchMode === 'user'
                    ? 'bg-primary-green text-white'
                    : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                }`}
              >
                <User className="w-4 h-4 inline mr-2" />
                Search by User ID
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchMode('category')
                  setSearchTerm('')
                  setSelectedCategories([])
                  setSearchResult(null)
                  setSupplierList([])
                }}
                className={`flex-1 px-4 py-3 rounded-button font-medium transition-colors ${
                  searchMode === 'category'
                    ? 'bg-primary-green text-white'
                    : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                }`}
              >
                <Package className="w-4 h-4 inline mr-2" />
                Search by Category
              </button>
            </div>
          </div>
        )}
        
        {/* Search Form - User ID Mode (For Suppliers, always show this. For Buyers, show when user mode is selected) */}
        {(userType === 'SUPPLIER' || searchMode === 'user') && (
          <div className="card-elevated mb-8">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cream-grey w-5 h-5" />
                <input
                  type="text"
                  placeholder={language === 'id' ? 'Masukkan ID Pembeli (BJ####) atau ID Supplier (SP####)...' : 'Enter Buyer ID (BJ####) or Supplier ID (SP####)...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                  className="input-field pl-10 pr-10"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cream-grey hover:text-text-dark transition-colors"
                    aria-label={language === 'id' ? 'Bersihkan pencarian' : 'Clear search'}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button type="submit" className="btn-primary" disabled={isSearching}>
                {isSearching ? (language === 'id' ? 'Mencari...' : 'Searching...') : (language === 'id' ? 'Cari' : 'Search')}
              </button>
            </form>
          </div>
        )}
        
        {/* Category Selection - Category Mode (Only for Buyers) */}
        {userType === 'BUYER' && searchMode === 'category' && (
          <div className="card-elevated mb-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-text-dark mb-2">{language === 'id' ? 'Pilih Kategori' : 'Select Categories'}</h2>
              <p className="text-sm text-text-dark/60">{language === 'id' ? 'Pilih satu atau lebih kategori untuk menemukan supplier' : 'Choose one or more categories to find suppliers'}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {categoryOptions.map((category) => {
                const isSelected = selectedCategories.includes(category.value)
                return (
                  <label
                    key={category.value}
                    className={`checkbox-card cursor-pointer transition-all ${
                      isSelected ? 'checkbox-card-selected' : 'checkbox-card-unselected'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleCategoryToggle(category.value)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'bg-primary-green border-primary-green' 
                          : 'border-cream-grey bg-white'
                      }`}>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-text-dark">{category.label}</span>
                    </div>
                  </label>
                )
              })}
            </div>
            
            {selectedCategories.length > 0 && (
              <div className="mb-4 p-3 bg-primary-green/5 rounded-xl border border-primary-green/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-text-dark">
                    {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected:
                  </p>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-xs font-medium text-primary-green hover:text-status-error transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCategories.map((catValue) => {
                    const category = categoryOptions.find(c => c.value === catValue)
                    return (
                      <span
                        key={catValue}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-primary-green/10 text-primary-green flex items-center gap-2"
                      >
                        {category?.label}
                        <button
                          type="button"
                          onClick={() => handleCategoryToggle(catValue)}
                          className="hover:text-status-error transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
            
            <button
              type="button"
              onClick={handleCategorySearch}
              disabled={isSearching || selectedCategories.length === 0}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? (language === 'id' ? 'Mencari...' : 'Searching...') : `${language === 'id' ? 'Cari Supplier' : 'Search Suppliers'} (${selectedCategories.length} ${selectedCategories.length === 1 ? (language === 'id' ? 'kategori' : 'category') : (language === 'id' ? 'kategori' : 'categories')})`}
            </button>
          </div>
        )}
        
        {/* Supplier List Results (Category Search - Only for Buyers) */}
        {userType === 'BUYER' && supplierList.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-text-dark">{language === 'id' ? 'Supplier Ditemukan' : 'Suppliers Found'}</h2>
                <p className="text-text-dark/60 mt-1">
                  {supplierList.length} supplier{supplierList.length !== 1 ? 's' : ''} found
                  {selectedCategories.length > 0 && (
                    <span> for {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'}</span>
                  )}
                  <span className="text-xs ml-2">(Ranked by Reliability Score)</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeatherFilter(weatherFilter === 'all' ? 'no_issues' : 'all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    weatherFilter === 'no_issues'
                      ? 'bg-primary-green text-white'
                      : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                  }`}
                >
                  <CloudRain className="w-4 h-4" />
                  {weatherFilter === 'no_issues' ? tSearch.noWeatherIssues : tSearch.showAll}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {supplierList
                .filter(supplier => {
                  if (weatherFilter === 'no_issues') {
                    // Filter to show only suppliers with no weather issues
                    const regions = parseRegions(supplier.regionsServed)
                    return regions.every(region => {
                      const weather = weatherData[region]
                      if (!weather) return true // Include if weather not loaded yet
                      const status = getWeatherStatus(weather)
                      return status.status === 'normal'
                    })
                  }
                  return true
                })
                .map((supplier) => {
                const getReliabilityColor = (score: number): string => {
                  if (score >= 80) return '#3C7F58' // Green
                  if (score >= 60) return '#C69F33' // Mustard
                  return '#B44A4A' // Red
                }
                const reliabilityColor = getReliabilityColor(supplier.reliabilityScore)
                const statusLabel = supplier.reliabilityScore >= 80 ? 'High Reliability' : 
                                   supplier.reliabilityScore >= 60 ? 'Medium Reliability' : 'Low Reliability'
                
                return (
                  <div key={supplier.supplierId} className="card-elevated hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-text-dark mb-1">{supplier.businessName}</h3>
                        <span className="text-xs font-medium text-primary-green">{supplier.supplierId}</span>
                      </div>
                      <div className="relative w-16 h-16 flex-shrink-0">
                        <svg className="transform -rotate-90 w-16 h-16">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="#E8E3D9"
                            strokeWidth="6"
                            fill="none"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke={reliabilityColor}
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={176}
                            strokeDashoffset={176 - (supplier.reliabilityScore / 100) * 176}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-bold" style={{ color: reliabilityColor }}>
                            {supplier.reliabilityScore}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        statusLabel === 'High Reliability' ? 'bg-status-success/10 text-status-success' :
                        statusLabel === 'Medium Reliability' ? 'bg-status-warning/10 text-status-warning' :
                        'bg-status-error/10 text-status-error'
                      }`}>
                        {statusLabel}
                      </span>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div>
                        <p className="text-xs font-medium text-text-dark/60 mb-1">Categories</p>
                        <div className="flex flex-wrap gap-2">
                          {supplier.categoryLabels.map((label, idx) => (
                            <span key={idx} className="px-2 py-1 rounded text-xs bg-primary-green/10 text-primary-green">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-text-dark/60">On-Time Delivery</p>
                          <p className="font-semibold text-text-dark">{supplier.onTimeDelivery}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-dark/60">Orders</p>
                          <p className="font-semibold text-text-dark">{supplier.completedOrders}/{supplier.totalOrders}</p>
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <p className="text-xs text-text-dark/60 mb-2">{tSearch.regionsServed}</p>
                        {(() => {
                          // Use regionsServed if available, otherwise fallback to address
                          const regionsServedValue = supplier.regionsServed || supplier.address || ''
                          const regionsToCheck = getRegionsToCheck(regionsServedValue)
                          const isNationwide = isIndonesiaWide(regionsServedValue)
                          const isExpanded = expandedRegions.has(supplier.supplierId)
                          const summary = getWeatherSummary(regionsToCheck, weatherData)
                          const regions = isNationwide && !isExpanded ? [] : parseRegions(regionsServedValue)
                          
                          // Check buyer's region status
                          const buyerRegionWeather = weatherData[buyerLocation]
                          const buyerRegionStatus = buyerRegionWeather ? getWeatherStatus(buyerRegionWeather) : null
                          
                          if (isNationwide && !isExpanded) {
                            // Show summary for Indonesia-wide suppliers
                            return (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-text-dark text-xs">{tSearch.indonesiaWide}</span>
                                  {summary.affected > 0 ? (
                                    <span className="text-xs text-status-warning">
                                      ⚠️ {summary.affected} {tSearch.regionsAffected}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-status-success">
                                      ✅ {tSearch.normalNationwide}
                                    </span>
                                  )}
                                </div>
                                
                                
                                <button
                                  onClick={() => {
                                    setExpandedRegions(prev => {
                                      const newSet = new Set(prev)
                                      newSet.add(supplier.supplierId)
                                      return newSet
                                    })
                                  }}
                                  className="text-xs text-primary-green hover:text-primary-olive transition-colors flex items-center gap-1 w-full justify-start"
                                >
                                  {tSearch.viewDetails} →
                                </button>
                              </div>
                            )
                          }
                          
                          // Expanded view or regular view (not Indonesia-wide)
                          // For Indonesia-wide, show only affected regions when expanded
                          const displayRegions = isNationwide && isExpanded 
                            ? summary.affectedRegions 
                            : regions
                          
                          // Sort regions by status: normal first, then affected/severe
                          const sortedRegions = [...displayRegions].sort((a, b) => {
                            const weatherA = weatherData[a]
                            const weatherB = weatherData[b]
                            const statusA = weatherA ? getWeatherStatus(weatherA) : null
                            const statusB = weatherB ? getWeatherStatus(weatherB) : null
                            
                            // Priority: normal (0) < affected (1) < severe (2)
                            const priorityA = statusA?.status === 'normal' ? 0 : statusA?.status === 'affected' ? 1 : statusA?.status === 'severe' ? 2 : 3
                            const priorityB = statusB?.status === 'normal' ? 0 : statusB?.status === 'affected' ? 1 : statusB?.status === 'severe' ? 2 : 3
                            
                            return priorityA - priorityB
                          })
                          
                          // Separate into normal and affected groups
                          const normalRegions = sortedRegions.filter(region => {
                            const weather = weatherData[region]
                            const status = weather ? getWeatherStatus(weather) : null
                            return status?.status === 'normal'
                          })
                          
                          const affectedRegions = sortedRegions.filter(region => {
                            const weather = weatherData[region]
                            const status = weather ? getWeatherStatus(weather) : null
                            return status && status.status !== 'normal'
                          })
                          
                          // If no regions parsed but regionsServedValue exists, show it directly
                          if (sortedRegions.length === 0 && regionsServedValue && !isNationwide) {
                            return (
                              <div className="text-xs text-text-dark/80">
                                {regionsServedValue}
                              </div>
                            )
                          }
                          
                          return (
                            <div className="space-y-2">
                              {sortedRegions.length > 0 ? (
                                <>
                                  {/* Normal conditions (majority) */}
                                  {normalRegions.length > 0 && normalRegions.map((region, idx) => {
                                    const weather = weatherData[region]
                                    const status = weather ? getWeatherStatus(weather) : null
                                    
                                    return (
                                      <div 
                                        key={idx} 
                                        className="flex items-center justify-between text-xs py-1.5"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-text-dark">
                                            {region}
                                          </span>
                                          {region === buyerLocation && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-green/10 text-primary-green border border-primary-green/20">
                                              {tSearch.buyersRegion}
                                            </span>
                                          )}
                                        </div>
                                        {loadingWeather ? (
                                          <span className="text-text-dark/40 text-xs">{tSearch.loadingWeather}</span>
                                        ) : status ? (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-sm">{status.icon}</span>
                                            <span className={`text-xs ${
                                              status.status === 'normal' ? 'text-status-success' :
                                              status.status === 'affected' ? 'text-status-warning' :
                                              'text-status-error'
                                            }`}>
                                              {status.status === 'normal' ? tSearch.normalConditions :
                                               status.status === 'affected' ? tSearch.mayExperienceDelays :
                                               tSearch.severeWeather}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-text-dark/40 text-xs">—</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                  
                                  {/* Affected regions (minority) - separated visually */}
                                  {affectedRegions.length > 0 && (
                                    <>
                                      {normalRegions.length > 0 && (
                                        <div className="my-2 border-t border-cream-grey/30"></div>
                                      )}
                                      {affectedRegions.map((region, idx) => {
                                        const weather = weatherData[region]
                                        const status = weather ? getWeatherStatus(weather) : null
                                        
                                        return (
                                          <div 
                                            key={`affected-${idx}`} 
                                            className="flex items-center justify-between text-xs py-1.5"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-text-dark">
                                                {region}
                                              </span>
                                              {region === buyerLocation && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-green/10 text-primary-green border border-primary-green/20">
                                                  {tSearch.buyersRegion}
                                                </span>
                                              )}
                                            </div>
                                            {loadingWeather ? (
                                              <span className="text-text-dark/40 text-xs">{tSearch.loadingWeather}</span>
                                            ) : status ? (
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-sm">{status.icon}</span>
                                                <span className={`text-xs ${
                                                  status.status === 'normal' ? 'text-status-success' :
                                                  status.status === 'affected' ? 'text-status-warning' :
                                                  'text-status-error'
                                                }`}>
                                                  {status.status === 'normal' ? tSearch.normalConditions :
                                                   status.status === 'affected' ? tSearch.mayExperienceDelays :
                                                   tSearch.severeWeather}
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="text-text-dark/40 text-xs">—</span>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </>
                                  )}
                                </>
                              ) : regionsServedValue ? (
                                // Show regionsServed or address if available but no weather data yet
                                <div className="text-xs text-text-dark/80">
                                  {isNationwide ? tSearch.indonesiaWide : regionsServedValue}
                                </div>
                              ) : (
                                <div className="text-center py-2 text-text-dark/60 text-xs">
                                  {tSearch.noWeatherIssues}
                                </div>
                              )}
                              
                              {isNationwide && isExpanded && (
                                <button
                                  onClick={() => {
                                    setExpandedRegions(prev => {
                                      const newSet = new Set(prev)
                                      newSet.delete(supplier.supplierId)
                                      return newSet
                                    })
                                  }}
                                  className="text-xs text-text-dark/60 hover:text-text-dark transition-colors flex items-center gap-1 w-full justify-start mt-2"
                                >
                                  ↑ Show Summary
                                </button>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                      
                      <div className="text-sm">
                        <p className="text-xs text-text-dark/60 mb-1">Payment Terms</p>
                        <div className="flex flex-wrap gap-1">
                          {supplier.paymentTermsOffered.map((term, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-xs bg-cream-beige text-text-dark">
                              {term === 'COD' ? 'COD' : term === 'NET7' ? 'Net 7' : term === 'NET14' ? 'Net 14' : term === 'NET30' ? 'Net 30' : term}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setSearchMode('user')
                        setSearchTerm(supplier.supplierId)
                        // Trigger search for this supplier ID
                        setIsSearching(true)
                        setTimeout(async () => {
                          if (supplier.supplierId.startsWith('SP')) {
                            // Fetch supplier profile from database
                            try {
                              const response = await fetch(`/api/users/search?q=${supplier.supplierId}`)
                              if (response.ok) {
                                const data = await response.json()
                                if (data.success && data.users && data.users.length > 0) {
                                  const user = data.users[0]
                                  // Transform to SupplierResult format (same as in handleSearch)
                                  setSearchResult({
                                    userId: user.userId,
                                    type: 'SUPPLIER',
                                    businessName: user.businessName,
                                    phoneNumber: user.phoneNumber || '',
                                    email: user.email || '',
                                    address: user.address || '',
                                    categories: user.categories || [],
                                    regionsServed: user.regionsServed || '',
                                    yearsInOperation: user.yearsInOperation || 0,
                                    reliabilityScore: user.reliabilityScore || user.creditScore,
                                    reliabilityScoreHistory: user.reliabilityScoreHistory || [],
                                    reliabilityMetrics: {
                                      onTimeDelivery: user.onTimeDelivery || 0,
                                      issueResolutionRate: user.issueResolutionRate || 0,
                                      orderAccuracy: user.orderAccuracy || 0,
                                      averageDeliveryTime: user.averageDeliveryTime || 0,
                                      totalOrders: user.totalOrders || 0,
                                      completedOrders: user.completedOrders || 0,
                                    },
                                    paymentTermsOffered: user.paymentTermsOffered || [],
                                    pastIssues: user.pastIssues || [],
                                    riskLabel: user.reliabilityLabel || 'Medium Reliability',
                                    creditLimitRecommendation: user.creditLimitRecommendation || 0,
                                    paymentPattern: user.paymentPattern || {
                                      bestMonth: '',
                                      worstMonth: '',
                                      seasonalTrend: 'Consistent',
                                    },
                                    disputeHistory: user.disputeHistory || {
                                      totalDisputes: 0,
                                      resolvedDisputes: 0,
                                      resolutionRate: 0,
                                      averageResolutionTime: 0,
                                    },
                                    networkConnections: user.networkConnections || {
                                      suppliers: [],
                                      buyers: [],
                                      totalConnections: 0,
                                    },
                                    industryBenchmark: user.industryBenchmark || {
                                      averageScore: 0,
                                      percentile: 0,
                                    },
                                    alerts: user.alerts || [],
                                  })
                                  // Fetch weather for this supplier's regions
                                  if (user.regionsServed) {
                                    const regions = parseRegions(user.regionsServed)
                                    fetchWeatherForRegions(regions)
                                  }
                                }
                              }
                            } catch (error) {
                              console.error('Error fetching supplier profile:', error)
                            }
                          }
                          setIsSearching(false)
                        }, 500)
                      }}
                      className="w-full btn-secondary text-sm"
                    >
                      View Full Profile
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
        {/* Empty States for Category Search (Only for Buyers) */}
        {userType === 'BUYER' && supplierList.length === 0 && searchMode === 'category' && selectedCategories.length > 0 && !isSearching && (
          <div className="card-elevated text-center py-12">
            <Package className="w-16 h-16 text-cream-grey mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-dark mb-2">No Suppliers Found</h3>
            <p className="text-text-dark/60 mb-4">
              No suppliers found for the selected categories. Try selecting different categories.
            </p>
          </div>
        )}
        
        {userType === 'BUYER' && searchMode === 'category' && selectedCategories.length === 0 && supplierList.length === 0 && (
          <div className="card-elevated text-center py-12">
            <Package className="w-16 h-16 text-cream-grey mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text-dark mb-2">Select Categories to Search</h3>
            <p className="text-text-dark/60">
              Choose one or more categories above to find suppliers ranked by reliability score.
            </p>
          </div>
        )}
        
        {/* Clear Search Button - Shows when there are results */}
        {(searchResult || supplierList.length > 0) && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={handleClearSearch}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-dark/60 hover:text-text-dark bg-cream-beige hover:bg-cream-grey rounded-button transition-colors"
            >
              <X className="w-4 h-4" />
              Clear Search
            </button>
          </div>
        )}

        {/* Search Results (User ID Search) */}
        {searchResult && (
          <div ref={searchResultRef} className={`space-y-6 ${supplierList.length > 0 ? 'mt-8' : ''}`}>
            {/* Profile Header Card */}
            <div className="card-elevated relative">
              <button
                onClick={() => setSearchResult(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-cream-grey/50 hover:bg-cream-grey text-text-dark/60 hover:text-text-dark transition-colors z-10"
                aria-label={language === 'id' ? 'Tutup profil' : 'Close profile'}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex flex-col md:flex-row items-start gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-green/20 to-primary-olive/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary-green" />
                    </div>
                    <h2 className="text-2xl font-bold text-text-dark">{searchResult.businessName}</h2>
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-primary-green/10 text-primary-green">
                      {searchResult.userId}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      searchResult.riskLabel === 'Low Risk' ? 'bg-status-success/10 text-status-success' :
                      searchResult.riskLabel === 'Medium Risk' ? 'bg-status-warning/10 text-status-warning' :
                      'bg-status-error/10 text-status-error'
                    }`}>
                      {searchResult.riskLabel}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm text-text-dark/70">
                      <Building2 className="w-4 h-4 text-primary-green" />
                      <span className="font-medium">Type:</span> {searchResult.type}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-text-dark/70">
                      <Phone className="w-4 h-4 text-primary-green" />
                      <span>{searchResult.phoneNumber}</span>
                    </div>
                    {isBuyer && 'email' in searchResult && (
                      <div className="flex items-center gap-2 text-sm text-text-dark/70">
                        <Mail className="w-4 h-4 text-primary-green" />
                        <span>{searchResult.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-text-dark/70">
                      <MapPin className="w-4 h-4 text-primary-green" />
                      <span>{searchResult.address}</span>
                    </div>
                    {isBuyer && 'yearsInOperation' in searchResult && (
                      <div className="flex items-center gap-2 text-sm text-text-dark/70">
                        <Calendar className="w-4 h-4 text-primary-green" />
                        <span>{searchResult.yearsInOperation} years in operation</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="md:w-48">
                  {isBuyer && 'creditScore' in searchResult ? (
                    <CreditScoreWidget score={searchResult.creditScore} size="lg" />
                  ) : isSupplier && 'reliabilityScore' in searchResult ? (
                    <div>
                      <p className="text-sm font-medium text-text-dark/60 mb-2 text-center">Reliability Score</p>
                      <CreditScoreWidget score={searchResult.reliabilityScore} size="lg" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Score History Chart */}
            {isBuyer && 'creditScoreHistory' in searchResult && (() => {
              const history = searchResult.creditScoreHistory
              const now = new Date()
              const currentMonth = now.getMonth()
              const currentYear = now.getFullYear()
              const currentQuarter = Math.floor(currentMonth / 3) // 0 = Q1, 1 = Q2, 2 = Q3, 3 = Q4
              
              // Filter data based on selected filter
              let filteredHistory = history
              if (scoreHistoryFilter === 'month') {
                filteredHistory = history.filter(item => {
                  const itemDate = new Date(item.date)
                  return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear
                })
              } else if (scoreHistoryFilter === 'quarter') {
                filteredHistory = history.filter(item => {
                  const itemDate = new Date(item.date)
                  const itemQuarter = Math.floor(itemDate.getMonth() / 3)
                  return itemQuarter === currentQuarter && itemDate.getFullYear() === currentYear
                })
              } else if (scoreHistoryFilter === 'year') {
                filteredHistory = history.filter(item => {
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
              
              return (
                <div className="card-elevated">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-primary-green" />
                      <h2 className="text-xl font-bold text-text-dark">Credit Score History</h2>
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
                      <LineChart data={filteredHistory.map(item => ({
                        date: new Date(item.date).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'short', day: 'numeric' }),
                        score: item.score,
                      }))}>
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
              )
            })()}

            {/* Reliability Score History Chart (Supplier) */}
            {isSupplier && 'reliabilityScoreHistory' in searchResult && (() => {
              const history = searchResult.reliabilityScoreHistory
              const now = new Date()
              const currentMonth = now.getMonth()
              const currentYear = now.getFullYear()
              const currentQuarter = Math.floor(currentMonth / 3) // 0 = Q1, 1 = Q2, 2 = Q3, 3 = Q4
              
              // Filter data based on selected filter
              let filteredHistory = history
              if (scoreHistoryFilter === 'month') {
                filteredHistory = history.filter(item => {
                  const itemDate = new Date(item.date)
                  return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear
                })
              } else if (scoreHistoryFilter === 'quarter') {
                filteredHistory = history.filter(item => {
                  const itemDate = new Date(item.date)
                  const itemQuarter = Math.floor(itemDate.getMonth() / 3)
                  return itemQuarter === currentQuarter && itemDate.getFullYear() === currentYear
                })
              } else if (scoreHistoryFilter === 'year') {
                filteredHistory = history.filter(item => {
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
              
              return (
                <div className="card-elevated">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-primary-green" />
                      <h2 className="text-xl font-bold text-text-dark">Reliability Score History</h2>
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
                      <LineChart data={filteredHistory.map(item => ({
                        date: new Date(item.date).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'short', day: 'numeric' }),
                        score: item.score,
                      }))}>
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
              )
            })()}

            {/* Payment Statistics (Buyer) */}
            {isBuyer && 'paymentStats' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-6">
                  <BarChart3 className="w-6 h-6 text-primary-green" />
                  <h2 className="text-xl font-bold text-text-dark">Payment Statistics</h2>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-gradient-to-br from-status-success/10 to-status-success/5 rounded-xl border border-status-success/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">On-Time Rate</p>
                    <p className="text-2xl font-bold text-status-success">{searchResult.paymentStats.onTimeRate}%</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-status-warning/10 to-status-warning/5 rounded-xl border border-status-warning/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Avg Delay Days</p>
                    <p className="text-2xl font-bold text-status-warning">{searchResult.paymentStats.averageDelayDays} days</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-status-error/10 to-status-error/5 rounded-xl border border-status-error/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Overdue Invoices</p>
                    <p className="text-2xl font-bold text-status-error">{searchResult.paymentStats.overdueInvoices}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-primary-green/10 to-primary-olive/5 rounded-xl border border-primary-green/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Total Outstanding</p>
                    <p className="text-lg font-bold text-primary-green">{formatCurrency(searchResult.paymentStats.totalOverdue)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-cream-beige/50 rounded-xl">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Total Invoices</p>
                    <p className="text-xl font-bold text-text-dark">{searchResult.paymentStats.totalInvoices}</p>
                    <p className="text-xs text-text-dark/60 mt-1">{searchResult.paymentStats.paidInvoices} paid</p>
                  </div>
                  <div className="p-4 bg-cream-beige/50 rounded-xl">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Average Invoice Amount</p>
                    <p className="text-xl font-bold text-text-dark">{formatCurrency(searchResult.paymentStats.averageInvoiceAmount)}</p>
                  </div>
                  <div className="p-4 bg-cream-beige/50 rounded-xl">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Preferred Payment Term</p>
                    <p className="text-xl font-bold text-text-dark">{searchResult.paymentStats.preferredPaymentTerm}</p>
                  </div>
                </div>
              </div>
            )}


            {/* Reliability Metrics (Supplier) */}
            {isSupplier && 'reliabilityMetrics' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="w-6 h-6 text-primary-olive" />
                  <h2 className="text-xl font-bold text-text-dark">Reliability Metrics</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gradient-to-br from-primary-green/5 to-primary-olive/5 rounded-xl border border-primary-green/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text-dark">On-Time Delivery</span>
                      <span className="text-lg font-bold text-primary-green">{searchResult.reliabilityMetrics.onTimeDelivery}%</span>
                    </div>
                    <div className="w-full bg-cream-grey/30 rounded-full h-2">
                      <div 
                        className="bg-primary-green h-2 rounded-full transition-all duration-500"
                        style={{ width: `${searchResult.reliabilityMetrics.onTimeDelivery}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-primary-olive/5 to-primary-green/5 rounded-xl border border-primary-olive/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text-dark">Issue Resolution Rate</span>
                      <span className="text-lg font-bold text-primary-olive">{searchResult.reliabilityMetrics.issueResolutionRate}%</span>
                    </div>
                    <div className="w-full bg-cream-grey/30 rounded-full h-2">
                      <div 
                        className="bg-primary-olive h-2 rounded-full transition-all duration-500"
                        style={{ width: `${searchResult.reliabilityMetrics.issueResolutionRate}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-primary-green/5 to-primary-olive/5 rounded-xl border border-primary-green/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text-dark">Order Accuracy</span>
                      <span className="text-lg font-bold text-primary-green">{searchResult.reliabilityMetrics.orderAccuracy}%</span>
                    </div>
                    <div className="w-full bg-cream-grey/30 rounded-full h-2">
                      <div 
                        className="bg-primary-green h-2 rounded-full transition-all duration-500"
                        style={{ width: `${searchResult.reliabilityMetrics.orderAccuracy}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-cream-beige/50 rounded-xl border border-cream-grey/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-dark">Average Delivery Time</span>
                      <span className="text-lg font-bold text-text-dark">{searchResult.reliabilityMetrics.averageDeliveryTime} days</span>
                    </div>
                    <p className="text-xs text-text-dark/60 mt-2">{searchResult.reliabilityMetrics.completedOrders} of {searchResult.reliabilityMetrics.totalOrders} orders completed</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Score Changes (Buyer) */}
            {isBuyer && 'recentScoreChanges' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-6 h-6 text-primary-green" />
                  <h2 className="text-xl font-bold text-text-dark">Recent Score Changes</h2>
                </div>
                <div className="space-y-3">
                  {searchResult.recentScoreChanges.map((change, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-cream-beige/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        {change.change > 0 ? (
                          <TrendingUp className="w-5 h-5 text-status-success" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-status-error" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-text-dark">{change.reason}</p>
                          <p className="text-xs text-text-dark/60">{formatDate(change.date)}</p>
                        </div>
                      </div>
                      <span className={`font-bold ${
                        change.change > 0 ? 'text-status-success' : 'text-status-error'
                      }`}>
                        {change.change > 0 ? '+' : ''}{change.change}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Factors (Buyer) */}
            {isBuyer && 'riskFactors' in searchResult && searchResult.riskFactors.length > 0 && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-status-warning" />
                  <h2 className="text-xl font-bold text-text-dark">Risk Factors</h2>
                </div>
                <div className="space-y-2">
                  {searchResult.riskFactors.map((factor, index) => (
                    <div key={index} className={`p-3 rounded-lg ${
                      factor.type === 'warning' ? 'bg-status-warning/10 border border-status-warning/20' :
                      'bg-primary-green/10 border border-primary-green/20'
                    }`}>
                      <p className="text-sm text-text-dark">{factor.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment History */}
            {isBuyer && 'paymentHistory' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-primary-green" />
                    <h2 className="text-xl font-bold text-text-dark">Payment History</h2>
                  </div>
                  <Link href={`/invoices?buyer=${searchResult.userId}`} className="text-sm font-medium text-primary-green hover:text-primary-olive transition-colors flex items-center gap-1">
                    View All
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-cream-grey">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Invoice</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-text-dark">Amount</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Due Date</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Paid Date</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Delay Days</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResult.paymentHistory.map((payment, index) => (
                        <tr 
                          key={index}
                          className={`border-b border-cream-grey/50 hover:bg-cream-beige/30 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-cream-white/50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className="font-semibold text-primary-green">{payment.invoice}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-semibold text-text-dark">{formatCurrency(payment.amount)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-text-dark">{formatDate(payment.dueDate)}</span>
                          </td>
                          <td className="py-3 px-4">
                            {payment.paidDate ? (
                              <span className="text-sm text-text-dark">{formatDate(payment.paidDate)}</span>
                            ) : (
                              <span className="text-sm text-text-dark/40">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {payment.delayDays !== null && (
                              <span className={`text-sm font-medium ${
                                payment.delayDays < 0 ? 'text-status-success' :
                                payment.delayDays === 0 ? 'text-text-dark' :
                                'text-status-error'
                              }`}>
                                {payment.delayDays > 0 ? `+${payment.delayDays}` : payment.delayDays} days
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              payment.status === 'PAID' ? 'bg-status-success/10 text-status-success' :
                              'bg-status-error/10 text-status-error'
                            }`}>
                              {payment.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Past Issues */}
            {searchResult.pastIssues && searchResult.pastIssues.length > 0 && (
              <div className="card-elevated">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-status-warning" />
                    <h2 className="text-xl font-bold text-text-dark">Issue History</h2>
                  </div>
                  <Link href={`/issues?user=${searchResult.userId}`} className="text-sm font-medium text-primary-green hover:text-primary-olive transition-colors flex items-center gap-1">
                    View All
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                
                <div className="space-y-3">
                  {searchResult.pastIssues.map((issue, index) => (
                    <div key={index} className="p-4 bg-cream-beige/30 rounded-xl border border-cream-grey/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-primary-green">{issue.issue}</span>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-status-warning/10 text-status-warning">
                            {issue.type}
                          </span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          issue.status === 'RESOLVED' ? 'bg-status-success/10 text-status-success' :
                          'bg-status-error/10 text-status-error'
                        }`}>
                          {issue.status}
                        </span>
                      </div>
                      <p className="text-sm text-text-dark/70 mb-1">{issue.description}</p>
                      <p className="text-xs text-text-dark/60">{formatDate(issue.date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Info for Suppliers */}
            {isSupplier && 'paymentTermsOffered' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-olive/20 to-primary-green/20 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary-olive" />
                  </div>
                  <h2 className="text-xl font-bold text-text-dark">Business Information</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Categories Card */}
                  <div className="p-5 bg-gradient-to-br from-primary-green/5 to-primary-green/0 rounded-xl border border-primary-green/10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-green/10 flex items-center justify-center">
                        <Package className="w-4 h-4 text-primary-green" />
                      </div>
                      <p className="text-sm font-semibold text-text-dark">Categories</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchResult.categories.map((cat, index) => (
                        <span key={index} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-green/10 text-primary-green border border-primary-green/20">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Payment Terms Card */}
                  <div className="p-5 bg-gradient-to-br from-primary-olive/5 to-primary-olive/0 rounded-xl border border-primary-olive/10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-olive/10 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-primary-olive" />
                  </div>
                      <p className="text-sm font-semibold text-text-dark">Payment Terms Offered</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchResult.paymentTermsOffered.map((term, index) => (
                        <span key={index} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-olive/10 text-primary-olive border border-primary-olive/20">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Regions Served Card - Full Width */}
                  <div className="md:col-span-2 p-5 bg-gradient-to-br from-cream-beige/30 to-cream-white rounded-xl border border-cream-grey/30">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-primary-green/10 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-primary-green" />
                  </div>
                      <p className="text-sm font-semibold text-text-dark">{tSearch.regionsServed}</p>
                </div>
                    {(() => {
                      if (!searchResult.regionsServed) return <span className="text-text-dark/40 text-sm">—</span>
                      
                      const regionsToCheck = getRegionsToCheck(searchResult.regionsServed)
                      const isNationwide = isIndonesiaWide(searchResult.regionsServed)
                      const profileExpandedKey = `profile-${searchResult.userId}`
                      const isExpanded = expandedRegions.has(profileExpandedKey)
                      const summary = getWeatherSummary(regionsToCheck, weatherData)
                      const regions = isNationwide && !isExpanded ? [] : parseRegions(searchResult.regionsServed)
                      
                      // Check buyer's region status
                      const buyerRegionWeather = weatherData[buyerLocation]
                      const buyerRegionStatus = buyerRegionWeather ? getWeatherStatus(buyerRegionWeather) : null
                      
                      if (isNationwide && !isExpanded) {
                        // Show summary for Indonesia-wide suppliers
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-text-dark text-sm">{tSearch.indonesiaWide}</span>
                              {summary.affected > 0 ? (
                                <span className="text-sm text-status-warning">
                                  ⚠️ {summary.affected} {tSearch.regionsAffected}
                                </span>
                              ) : (
                                <span className="text-sm text-status-success">
                                  ✅ {tSearch.normalNationwide}
                                </span>
                              )}
              </div>
                            
                            
                            <button
                              onClick={() => {
                                setExpandedRegions(prev => {
                                  const newSet = new Set(prev)
                                  newSet.add(profileExpandedKey)
                                  return newSet
                                })
                              }}
                              className="text-sm text-primary-green hover:text-primary-olive transition-colors flex items-center gap-1"
                            >
                              {tSearch.viewDetails} →
                            </button>
                          </div>
                        )
                      }
                      
                      // Expanded view or regular view (not Indonesia-wide)
                      // For Indonesia-wide, show only affected regions when expanded
                      const displayRegions = isNationwide && isExpanded 
                        ? summary.affectedRegions 
                        : regions
                      
                      // Sort regions by status: normal first, then affected/severe
                      const sortedRegions = [...displayRegions].sort((a, b) => {
                        const weatherA = weatherData[a]
                        const weatherB = weatherData[b]
                        const statusA = weatherA ? getWeatherStatus(weatherA) : null
                        const statusB = weatherB ? getWeatherStatus(weatherB) : null
                        
                        // Priority: normal (0) < affected (1) < severe (2)
                        const priorityA = statusA?.status === 'normal' ? 0 : statusA?.status === 'affected' ? 1 : statusA?.status === 'severe' ? 2 : 3
                        const priorityB = statusB?.status === 'normal' ? 0 : statusB?.status === 'affected' ? 1 : statusB?.status === 'severe' ? 2 : 3
                        
                        return priorityA - priorityB
                      })
                      
                      // Separate into normal, affected, and no-weather-data groups
                      const normalRegions = sortedRegions.filter(region => {
                        const weather = weatherData[region]
                        const status = weather ? getWeatherStatus(weather) : null
                        return status?.status === 'normal'
                      })
                      
                      const affectedRegions = sortedRegions.filter(region => {
                        const weather = weatherData[region]
                        const status = weather ? getWeatherStatus(weather) : null
                        return status && status.status !== 'normal'
                      })
                      
                      // Regions without weather data (should still be displayed)
                      const regionsWithoutWeather = sortedRegions.filter(region => {
                        return !weatherData[region]
                      })
                      
                      // Debug: Log regions parsing
                      console.log('[Search] Regions display logic:', {
                        regionsServed: searchResult.regionsServed,
                        parsedRegions: regions,
                        displayRegions: displayRegions,
                        sortedRegions: sortedRegions,
                        hasWeatherData: Object.keys(weatherData).length > 0,
                      })
                      
                      return (
                        <div className="space-y-2">
                          {sortedRegions.length > 0 ? (
                            <>
                              {/* Normal conditions (majority) */}
                              {normalRegions.length > 0 && normalRegions.map((region, idx) => {
                                const weather = weatherData[region]
                                const status = weather ? getWeatherStatus(weather) : null
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className="flex items-center justify-between p-3 rounded-lg bg-white border border-cream-grey/30 hover:border-cream-grey/50 transition-all"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <MapPin className="w-4 h-4 text-text-dark/40" />
                                      <span className="font-medium text-sm text-text-dark">
                                        {region}
                                      </span>
                                      {region === buyerLocation && (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-green/10 text-primary-green border border-primary-green/20">
                                          {tSearch.buyersRegion}
                                        </span>
                                      )}
                                    </div>
                                    {loadingWeather ? (
                                      <span className="text-text-dark/40 text-xs">{tSearch.loadingWeather}</span>
                                    ) : status ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-base">{status.icon}</span>
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                          status.status === 'normal' 
                                            ? 'bg-status-success/10 text-status-success border border-status-success/20' :
                                            status.status === 'affected' 
                                            ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' :
                                            'bg-status-error/10 text-status-error border border-status-error/20'
                                        }`}>
                                          {status.status === 'normal' ? tSearch.normalConditions :
                                           status.status === 'affected' ? tSearch.mayExperienceDelays :
                                           tSearch.severeWeather}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-text-dark/40 text-xs">—</span>
                                    )}
                                  </div>
                                )
                              })}
                              
                              {/* Regions without weather data */}
                              {regionsWithoutWeather.length > 0 && (
                                <>
                                  {(normalRegions.length > 0 || affectedRegions.length > 0) && (
                                    <div className="my-3 border-t border-cream-grey/30"></div>
                                  )}
                                  {regionsWithoutWeather.map((region, idx) => (
                                    <div 
                                      key={`no-weather-${idx}`} 
                                      className="flex items-center justify-between p-3 rounded-lg bg-white border border-cream-grey/30"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <MapPin className="w-4 h-4 text-text-dark/40" />
                                        <span className="font-medium text-sm text-text-dark">
                                          {region}
                                        </span>
                                      </div>
                                      {loadingWeather ? (
                                        <span className="text-text-dark/40 text-xs">{tSearch.loadingWeather}</span>
                                      ) : (
                                        <span className="text-text-dark/40 text-xs">—</span>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                              
                              {/* Affected regions (minority) - separated visually */}
                              {affectedRegions.length > 0 && (
                                <>
                                  {normalRegions.length > 0 && (
                                    <div className="my-3 border-t border-cream-grey/30"></div>
                                  )}
                                  {affectedRegions.map((region, idx) => {
                                    const weather = weatherData[region]
                                    const status = weather ? getWeatherStatus(weather) : null
                                    
                                    return (
                                      <div 
                                        key={`affected-${idx}`} 
                                        className="flex items-center justify-between p-3 rounded-lg bg-white border border-cream-grey/30 hover:border-cream-grey/50 transition-all"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <MapPin className="w-4 h-4 text-text-dark/40" />
                                          <span className="font-medium text-sm text-text-dark">
                                            {region}
                                          </span>
                                          {region === buyerLocation && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-green/10 text-primary-green border border-primary-green/20">
                                              {tSearch.buyersRegion}
                                            </span>
                                          )}
                                        </div>
                                        {loadingWeather ? (
                                          <span className="text-text-dark/40 text-xs">{tSearch.loadingWeather}</span>
                                        ) : status ? (
                                          <div className="flex items-center gap-2">
                                            <span className="text-base">{status.icon}</span>
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                              status.status === 'normal' 
                                                ? 'bg-status-success/10 text-status-success border border-status-success/20' :
                                                status.status === 'affected' 
                                                ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' :
                                                'bg-status-error/10 text-status-error border border-status-error/20'
                                            }`}>
                                              {status.status === 'normal' ? tSearch.normalConditions :
                                               status.status === 'affected' ? tSearch.mayExperienceDelays :
                                               tSearch.severeWeather}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-text-dark/40 text-xs">—</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </>
                              )}
                            </>
                          ) : regions.length > 0 ? (
                            // Show regions even if weather data isn't loaded yet
                            <div className="space-y-2">
                              {regions.map((region, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex items-center justify-between p-3 rounded-lg bg-white border border-cream-grey/30"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <MapPin className="w-4 h-4 text-text-dark/40" />
                                    <span className="font-medium text-sm text-text-dark">
                                      {region}
                                    </span>
                                  </div>
                                  {loadingWeather ? (
                                    <span className="text-text-dark/40 text-xs">{tSearch.loadingWeather}</span>
                                  ) : (
                                    <span className="text-text-dark/40 text-xs">—</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : searchResult.regionsServed ? (
                            // Fallback: Show raw regionsServed string if parsing failed
                            <div className="p-3 rounded-lg bg-white border border-cream-grey/30">
                              <span className="font-medium text-sm text-text-dark">
                                {searchResult.regionsServed}
                              </span>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-text-dark/60 text-sm">
                              {tSearch.noWeatherIssues}
                            </div>
                          )}
                          
                          {isNationwide && isExpanded && (
                            <button
                              onClick={() => {
                                setExpandedRegions(prev => {
                                  const newSet = new Set(prev)
                                  newSet.delete(profileExpandedKey)
                                  return newSet
                                })
                              }}
                              className="text-sm text-text-dark/60 hover:text-text-dark transition-colors flex items-center gap-1 mt-2"
                            >
                              ↑ Show Summary
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Years in Operation Card */}
                  <div className="p-5 bg-gradient-to-br from-cream-beige/20 to-cream-white rounded-xl border border-cream-grey/20">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-green/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-primary-green" />
                      </div>
                      <p className="text-sm font-semibold text-text-dark">Years in Operation</p>
                    </div>
                    <p className="text-lg font-bold text-text-dark ml-10">{searchResult.yearsInOperation} years</p>
                  </div>
                </div>
              </div>
            )}

            {/* Credit Limit Recommendation (Buyer) */}
            {isBuyer && 'creditLimitRecommendation' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Target className="w-6 h-6 text-primary-green" />
                    <h2 className="text-xl font-bold text-text-dark">Credit Limit Recommendation</h2>
                  </div>
                </div>
                {isSupplier && 'creditLimitRecommendation' in searchResult && (
                  <div className="p-6 bg-gradient-to-br from-primary-green/10 to-primary-olive/5 rounded-xl border border-primary-green/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-dark/60 mb-2">Recommended Credit Limit</p>
                        <p className="text-3xl font-bold text-primary-green">{formatCurrency(Number((searchResult as any).creditLimitRecommendation) || 0)}</p>
                        <p className="text-xs text-text-dark/60 mt-2">Based on payment history and current score</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-text-dark/60 mb-1">Current Outstanding</p>
                        <p className="text-xl font-bold text-text-dark">
                          {formatCurrency(isBuyer && 'paymentStats' in searchResult ? (searchResult as any).paymentStats.totalOverdue : 0)}
                        </p>
                        <p className="text-xs text-text-dark/60 mt-2">
                          {Number((searchResult as any).creditLimitRecommendation) > 0 
                            ? `${Math.round(((isBuyer && 'paymentStats' in searchResult ? (searchResult as any).paymentStats.totalOverdue : 0) / Number((searchResult as any).creditLimitRecommendation)) * 100)}% utilized`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Pattern Analysis */}
            {'paymentPattern' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-6 h-6 text-primary-green" />
                  <h2 className="text-xl font-bold text-text-dark">Payment Pattern Analysis</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-status-success/10 to-status-success/5 rounded-xl border border-status-success/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Best Payment Month</p>
                    <p className="text-lg font-bold text-status-success">{searchResult.paymentPattern.bestMonth}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-status-warning/10 to-status-warning/5 rounded-xl border border-status-warning/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Worst Payment Month</p>
                    <p className="text-lg font-bold text-status-warning">{searchResult.paymentPattern.worstMonth}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-primary-green/10 to-primary-olive/5 rounded-xl border border-primary-green/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Seasonal Trend</p>
                    <p className="text-lg font-bold text-primary-green">{searchResult.paymentPattern.seasonalTrend}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dispute History */}
            {'disputeHistory' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-status-warning" />
                  <h2 className="text-xl font-bold text-text-dark">Dispute History</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-cream-beige/50 rounded-xl">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Total Disputes</p>
                    <p className="text-2xl font-bold text-text-dark">{searchResult.disputeHistory.totalDisputes}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-status-success/10 to-status-success/5 rounded-xl border border-status-success/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Resolution Rate</p>
                    <p className="text-2xl font-bold text-status-success">{searchResult.disputeHistory.resolutionRate}%</p>
                  </div>
                  <div className="p-4 bg-cream-beige/50 rounded-xl">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Resolved</p>
                    <p className="text-2xl font-bold text-text-dark">{searchResult.disputeHistory.resolvedDisputes}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-primary-green/10 to-primary-olive/5 rounded-xl border border-primary-green/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Avg Resolution Time</p>
                    <p className="text-2xl font-bold text-primary-green">{searchResult.disputeHistory.averageResolutionTime} days</p>
                  </div>
                </div>
              </div>
            )}

            {/* Network Connections */}
            {isSupplier && 'networkConnections' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-4">
                  <Network className="w-6 h-6 text-primary-olive" />
                  <h2 className="text-xl font-bold text-text-dark">Network Connections</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {searchResult.networkConnections.suppliers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-text-dark/60 mb-3">Suppliers ({searchResult.networkConnections.suppliers.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {searchResult.networkConnections.suppliers.map((supplierId: string, index: number) => (
                          <Link
                            key={index}
                            href={`/search?q=${supplierId}`}
                            className="px-3 py-1 rounded-full text-xs font-medium bg-primary-olive/10 text-primary-olive hover:bg-primary-olive/20 transition-colors"
                          >
                            {supplierId}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {isSupplier && searchResult.networkConnections.buyers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-text-dark/60 mb-3">Buyers ({searchResult.networkConnections.buyers.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {searchResult.networkConnections.buyers.map((buyerId: string, index: number) => (
                          <Link
                            key={index}
                            href={`/search?q=${buyerId}`}
                            className="px-3 py-1 rounded-full text-xs font-medium bg-primary-green/10 text-primary-green hover:bg-primary-green/20 transition-colors"
                          >
                            {buyerId}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="p-4 bg-gradient-to-br from-primary-green/10 to-primary-olive/5 rounded-xl border border-primary-green/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-1">Total Connections</p>
                    <p className="text-3xl font-bold text-primary-green">{searchResult.networkConnections.totalConnections}</p>
                    <p className="text-xs text-text-dark/60 mt-2">Active business relationships</p>
                  </div>
                </div>
              </div>
            )}

            {/* Industry Benchmark */}
            {'industryBenchmark' in searchResult && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-6 h-6 text-primary-green" />
                  <h2 className="text-xl font-bold text-text-dark">Industry Benchmark</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-gradient-to-br from-primary-green/10 to-primary-olive/5 rounded-xl border border-primary-green/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-2">Industry Average</p>
                    <p className="text-3xl font-bold text-primary-green">{searchResult.industryBenchmark.averageScore}</p>
                    <p className="text-xs text-text-dark/60 mt-2">Based on similar businesses</p>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-primary-olive/10 to-primary-green/5 rounded-xl border border-primary-olive/20">
                    <p className="text-sm font-medium text-text-dark/60 mb-2">Percentile Ranking</p>
                    <p className="text-3xl font-bold text-primary-olive">{searchResult.industryBenchmark.percentile}th</p>
                    <p className="text-xs text-text-dark/60 mt-2">
                      {searchResult.industryBenchmark.percentile >= 75 ? 'Top performer' :
                       searchResult.industryBenchmark.percentile >= 50 ? 'Above average' :
                       searchResult.industryBenchmark.percentile >= 25 ? 'Average' : 'Below average'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Alerts & Notifications */}
            {'alerts' in searchResult && searchResult.alerts.length > 0 && (
              <div className="card-elevated">
                <div className="flex items-center gap-3 mb-4">
                  <Bell className="w-6 h-6 text-status-warning" />
                  <h2 className="text-xl font-bold text-text-dark">Recent Alerts & Notifications</h2>
                </div>
                <div className="space-y-3">
                  {searchResult.alerts.map((alert, index) => (
                    <div key={index} className={`p-4 rounded-xl border ${
                      alert.type === 'warning' ? 'bg-status-warning/10 border-status-warning/20' :
                      alert.type === 'success' ? 'bg-status-success/10 border-status-success/20' :
                      'bg-primary-green/10 border-primary-green/20'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-dark">{alert.message}</p>
                          <p className="text-xs text-text-dark/60 mt-1">{formatDate(alert.date)}</p>
                        </div>
                        {alert.type === 'warning' && <AlertCircle className="w-5 h-5 text-status-warning flex-shrink-0" />}
                        {alert.type === 'success' && <CheckCircle className="w-5 h-5 text-status-success flex-shrink-0" />}
                        {alert.type === 'info' && <Bell className="w-5 h-5 text-primary-green flex-shrink-0" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Report Button */}
            <div className="card-elevated">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-text-dark mb-1">Export Credit Report</h3>
                  <p className="text-sm text-text-dark/60">Download a comprehensive PDF report of this profile</p>
                </div>
                <button className="btn-primary flex items-center gap-2 group">
                  <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
                  Export PDF
                </button>
              </div>
            </div>
          </div>
        )}
        
        {!searchResult && supplierList.length === 0 && !isSearching && (
          <div className="card-elevated text-center py-12 text-text-dark/60 mt-8">
            <Search className="w-12 h-12 mx-auto mb-4 text-cream-grey" />
            <p className="text-lg font-medium mb-2">Search for Credit Profiles</p>
            <p className="text-sm">Enter a Buyer ID (BJ####) or Supplier ID (SP####) to view comprehensive credit history</p>
          </div>
        )}
      </div>
    </div>
  )
}

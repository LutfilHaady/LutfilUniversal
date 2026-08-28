'use client'

import React, { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import AIRiskAssessment from '@/components/AIRiskAssessment'
import CreditScoreWidget from '@/components/CreditScoreWidget'
import { formatCurrency, formatDate, getUserTypeFromUserId, getScoreColor } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'
import { Search, MapPin, Building2, Brain, Users, UserSearch, X, List, Table2, UserPlus, Ban } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import BuyerBlacklistBadge from '@/components/BuyerBlacklistBadge'
import { isBadCredit } from '@/lib/utils/buyer-credit'

type TabMode = 'myBuyers' | 'potentialBuyers' | 'searchAll'

// AI Risk Assessment data for selected buyer
const getAIRiskAssessment = (buyerId: string) => {
  const assessments: Record<string, any> = {
    'BJ1123': {
      riskLevel: 'Critical Risk' as const,
      aiScore: 10,
      description: 'The buyer presents critical credit risk due to zero paid invoices, an overdue invoice, and a disputed invoice, compounded by a high historical risk status. The current outstanding further highlights financial instability.',
      flaggedFactors: [
        { id: '1', label: 'No record of paid invoices', checked: true },
        { id: '2', label: 'Overdue invoices', checked: true },
        { id: '3', label: 'Disputed invoices', checked: true },
        { id: '4', label: 'High historical risk', checked: true },
        { id: '5', label: 'Existing outstanding debt', checked: true },
      ],
      recommendedCreditLimit: 0,
    },
    'BJ1045': {
      riskLevel: 'Low Risk' as const,
      aiScore: 85,
      description: 'The buyer demonstrates excellent payment behavior with consistent on-time payments and a strong credit history.',
      flaggedFactors: [
        { id: '1', label: 'No record of paid invoices', checked: false },
        { id: '2', label: 'Overdue invoices', checked: false },
        { id: '3', label: 'Disputed invoices', checked: false },
        { id: '4', label: 'High historical risk', checked: false },
        { id: '5', label: 'Existing outstanding debt', checked: false },
      ],
      recommendedCreditLimit: 50000000,
    },
    'BJ1089': {
      riskLevel: 'Medium Risk' as const,
      aiScore: 65,
      description: 'The buyer shows moderate payment behavior with occasional late payments but generally maintains good standing.',
      flaggedFactors: [
        { id: '1', label: 'No record of paid invoices', checked: false },
        { id: '2', label: 'Overdue invoices', checked: true },
        { id: '3', label: 'Disputed invoices', checked: false },
        { id: '4', label: 'High historical risk', checked: false },
        { id: '5', label: 'Existing outstanding debt', checked: true },
      ],
      recommendedCreditLimit: 30000000,
    },
  }
  return assessments[buyerId] || assessments['BJ1045']
}

export default function BuyerRegistryPage() {
  const { language } = useLanguage()
  const t = translations[language].buyerRegistry || {
    title: 'Buyer Registry',
    subtitle: 'View and manage buyer profiles',
    searchPlaceholder: 'Search by name or NIB...',
    selectBuyer: 'Select a buyer to view details',
    creditScore: 'CREDIT SCORE',
    totalOutstanding: 'TOTAL OUTSTANDING',
    generateReport: 'Generate Report',
    myBuyers: 'My Buyers',
    searchAll: 'Search All',
    searchByUserId: 'Search by User ID (BJ#### or SP####)',
    searchByCategory: 'Search by Category',
  }

  const [userId, setUserId] = useState<string>('')
  
  // State with default values (will be hydrated from localStorage in useEffect)
  const [activeTab, setActiveTab] = useState<TabMode>('myBuyers')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBuyer, setSelectedBuyer] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState<'user' | 'category'>('user')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [searchResult, setSearchResult] = useState<any>(null)
  const [searchResults, setSearchResults] = useState<any[]>([]) // List of buyers from category search
  const [isSearching, setIsSearching] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list')
  const [myBuyers, setMyBuyers] = useState<any[]>([])
  const [isLoadingBuyers, setIsLoadingBuyers] = useState(false)
  const [potentialBuyers, setPotentialBuyers] = useState<any[]>([])
  const [isLoadingPotentialBuyers, setIsLoadingPotentialBuyers] = useState(false)
  const [blacklistedBuyers, setBlacklistedBuyers] = useState<Set<string>>(new Set())
  const [showBlacklisted, setShowBlacklisted] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        setUserId(storedUserId)
      } else {
        // Default to supplier if no userId stored
        const defaultUserId = 'SP0023'
        localStorage.setItem('userId', defaultUserId)
        setUserId(defaultUserId)
      }
    }
  }, [])

  // Persist state changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('buyerRegistry_activeTab', activeTab)
    }
  }, [activeTab])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('buyerRegistry_searchTerm', searchTerm)
    }
  }, [searchTerm])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedBuyer) {
        localStorage.setItem('buyerRegistry_selectedBuyer', selectedBuyer)
      } else {
        localStorage.removeItem('buyerRegistry_selectedBuyer')
      }
    }
  }, [selectedBuyer])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('buyerRegistry_searchMode', searchMode)
    }
  }, [searchMode])

  // Fetch blacklisted buyers (MOCK DATA for demo)
  useEffect(() => {
    const fetchBlacklisted = async () => {
      if (!userId || !userId.startsWith('SP')) return
      
      try {
        const response = await fetch(`/api/suppliers/blacklist?supplierId=${userId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            const blacklistedIds = new Set<string>(data.blacklistedBuyers.map((b: any) => String(b.buyerId)))
            setBlacklistedBuyers(blacklistedIds)
          }
        }
      } catch (error) {
        console.error('Error fetching blacklist:', error)
        // Fallback to mock data if API fails
        setBlacklistedBuyers(new Set(['BJ1123']))
      }
    }
    
    fetchBlacklisted()
  }, [userId])

  // Fetch potential buyers
  useEffect(() => {
    const fetchPotentialBuyers = async () => {
      if (!userId || !userId.startsWith('SP')) return
      
      setIsLoadingPotentialBuyers(true)
      try {
        const response = await fetch('/api/suppliers/potential-buyers')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.buyerIds && data.buyerIds.length > 0) {
            // Fetch full buyer details for each potential buyer ID
            const buyerDetails = await Promise.all(
              data.buyerIds.map(async (buyerUserId: string) => {
                const buyerResponse = await fetch(`/api/users/search?q=${buyerUserId}&type=BUYER`)
                if (buyerResponse.ok) {
                  const buyerData = await buyerResponse.json()
                  if (buyerData.success && buyerData.users && buyerData.users.length > 0) {
                    const user = buyerData.users[0]
                    return {
                      id: user.id,
                      userId: user.userId,
                      businessName: user.businessName,
                      creditScore: user.creditScore,
                      riskLevel: user.riskLevel || null,
                      totalOutstanding: user.totalOutstanding || 0,
                      address: user.address || '',
                      businessTypes: user.businessTypes || '[]',
                      preferredPaymentTerm: user.preferredPaymentTerm || 'NET14',
                    }
                  }
                }
                return null
              })
            )
            setPotentialBuyers(buyerDetails.filter((b: any) => b !== null))
          } else {
            setPotentialBuyers([])
          }
        }
      } catch (error) {
        console.error('Error fetching potential buyers:', error)
      } finally {
        setIsLoadingPotentialBuyers(false)
      }
    }
    
    fetchPotentialBuyers()
  }, [userId])

  // Fetch my buyers from database
  useEffect(() => {
    const fetchMyBuyers = async () => {
      if (!userId || !userId.startsWith('SP')) return
      
      setIsLoadingBuyers(true)
      try {
        const response = await fetch(`/api/users/search?type=BUYER&supplierId=${userId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.users) {
            setMyBuyers(data.users.map((user: any) => ({
              id: user.id,
              userId: user.userId,
              businessName: user.businessName,
              nib: '',
              category: 'Business',
              riskLevel: user.riskLevel || null,
              creditScore: user.creditScore,
              totalOutstanding: user.totalOutstanding || 0,
              address: user.address || '',
              sector: 'Business Sector',
              lastPaymentDate: user.lastPaymentDate,
              totalInvoices: user.totalInvoices || 0,
              paidInvoices: user.paidInvoices || 0,
              preferredPaymentTerm: user.preferredPaymentTerm || 'NET14',
            })))
          }
        }
      } catch (error) {
        console.error('Error fetching buyers:', error)
      } finally {
        setIsLoadingBuyers(false)
      }
    }

    fetchMyBuyers()
  }, [userId])

  const userType = getUserTypeFromUserId(userId)

  // Only show for suppliers
  if (userType !== 'SUPPLIER') {
    return (
      <div className="min-h-screen bg-cream-white">
        <Navbar userId={userId} userType={userType} />
        <div className="container mx-auto px-4 py-8">
          <div className="card-elevated text-center py-12">
            <h2 className="text-2xl font-bold text-text-dark mb-2">Access Restricted</h2>
            <p className="text-text-dark/60">This page is only available for suppliers.</p>
          </div>
        </div>
      </div>
    )
  }

  // Filter My Buyers (from database)
  const filteredMyBuyers = myBuyers
    .filter((buyer) => {
      // Filter by search term
      const matchesSearch =
        buyer.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        buyer.userId.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (!matchesSearch) return false
      
      // Filter by blacklist status
      const isBlacklisted = blacklistedBuyers.has(buyer.userId)
      if (showBlacklisted) {
        return isBlacklisted // Show only blacklisted
      } else {
        return !isBlacklisted // Hide blacklisted
      }
    })
    .map((buyer) => ({
      ...buyer,
      isBlacklisted: blacklistedBuyers.has(buyer.userId),
      isBadCredit: isBadCredit({
        creditScore: buyer.creditScore,
        riskLevel: buyer.riskLevel,
        overdueInvoices: buyer.totalInvoices - buyer.paidInvoices,
      }),
    }))

  // Handle search in Search All tab - searches database
  const handleSearch = async () => {
    if (searchMode === 'user' && !searchTerm.trim()) return
    
    setIsSearching(true)
    setSearchResult(null)
    
    try {
      if (searchMode === 'user') {
        // Search database for buyer by ID
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchTerm.trim())}&type=BUYER`)
        
        if (!response.ok) {
          throw new Error('Search failed')
        }
        
        const data = await response.json()
        
        if (data.success && data.users && data.users.length > 0) {
          const user = data.users[0]
          const comprehensiveData = {
            userId: user.userId,
            businessName: user.businessName,
            phoneNumber: user.phoneNumber || '',
            address: user.address || '',
            businessType: 'Business',
            creditScore: user.creditScore,
            totalOutstanding: user.totalOutstanding || 0,
            creditScoreHistory: [],
            paymentStats: {
              onTimeRate: user.totalInvoices > 0 ? Math.round((user.paidInvoices / user.totalInvoices) * 100) : 0,
              averageDelayDays: 0,
              totalInvoices: user.totalInvoices || 0,
              paidInvoices: user.paidInvoices || 0,
              overdueInvoices: (user.totalInvoices || 0) - (user.paidInvoices || 0),
              totalOverdue: user.totalOutstanding || 0,
            },
          }
          setSearchResult(comprehensiveData)
          setSelectedBuyer(user.userId)
        } else {
          alert('No buyer found with that ID')
        }
      } else if (searchMode === 'category' && selectedCategories.length > 0) {
        // Category search - get all buyers
        const response = await fetch(`/api/users/search?type=BUYER`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('API Error:', errorData)
          throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: Search failed`)
        }
        
        const data = await response.json()
        
        if (!data.success) {
          throw new Error(data.message || data.error || 'Search failed')
        }
        
        if (data.users && data.users.length > 0) {
            // Filter buyers by selected categories (if businessTypes field exists)
            let filteredUsers = data.users
            
            // Filter by category if businessTypes is available
            if (selectedCategories.length > 0) {
              filteredUsers = data.users.filter((user: any) => {
                // Check if user has businessTypes field
                if (user.businessTypes) {
                  try {
                    const businessTypes = typeof user.businessTypes === 'string' 
                      ? JSON.parse(user.businessTypes) 
                      : user.businessTypes
                    
                    // Normalize category names for matching
                    const normalizeCategory = (cat: string) => cat.toLowerCase().trim()
                    
                    // Check if any selected category matches user's business types
                    const userTypes = Array.isArray(businessTypes) 
                      ? businessTypes.map((bt: string) => normalizeCategory(bt))
                      : []
                    
                    return selectedCategories.some(cat => {
                      const normalizedCat = normalizeCategory(cat)
                      return userTypes.some((ut: string) => 
                        ut.includes(normalizedCat) || normalizedCat.includes(ut)
                      )
                    })
                  } catch (e) {
                    // If parsing fails, include all users (no filtering)
                    console.warn('Failed to parse businessTypes:', e)
                    return true
                  }
                }
                // If no businessTypes field, include all users (no filtering)
                return true
              })
            }
            
            // Map to buyer format
            const buyersList = filteredUsers.map((user: any) => ({
              id: user.id,
              userId: user.userId,
              businessName: user.businessName,
              nib: user.businessRegistrationNumber || '',
              category: selectedCategories.join(', ') || 'Business',
              riskLevel: user.riskLevel || null,
              creditScore: user.creditScore,
              totalOutstanding: user.totalOutstanding || 0,
              address: user.address || '',
              sector: 'Business Sector',
              lastPaymentDate: user.lastPaymentDate,
              totalInvoices: user.totalInvoices || 0,
              paidInvoices: user.paidInvoices || 0,
              preferredPaymentTerm: user.preferredPaymentTerm || 'NET14',
            }))
            
            setSearchResults(buyersList)
            setSearchResult(null) // Clear single result
            setSelectedBuyer(null) // Clear selection
            
            if (buyersList.length === 0) {
              alert(`No buyers found for selected categories: ${selectedCategories.join(', ')}`)
            }
          } else {
            alert('No buyers found in database')
          }
      }
    } catch (error) {
      console.error('Search error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Show detailed error message
      let userMessage = 'Search failed. '
      
      if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('not configured')) {
        userMessage += 'Database is not configured. Please check your environment variables.'
      } else if (errorMessage.includes('connection failed') || errorMessage.includes('unreachable')) {
        userMessage += 'Cannot connect to database. Please check your database connection.'
      } else if (errorMessage.includes('schema') || errorMessage.includes('does not exist')) {
        userMessage += 'Database schema mismatch. Please run: npx prisma db pull && npx prisma generate'
      } else if (errorMessage.includes('PrismaClientInitializationError')) {
        userMessage += 'Prisma client not generated. Please run: npx prisma generate'
      } else {
        userMessage += errorMessage
      }
      
      alert(userMessage)
      setSearchResults([])
      setSearchResult(null)
      setSelectedBuyer(null)
    } finally {
      setIsSearching(false)
    }
  }

  // Refresh My Buyers list
  const refreshMyBuyers = async () => {
    if (!userId || !userId.startsWith('SP')) return
    
    setIsLoadingBuyers(true)
    try {
      // First refresh the blacklist to get updated blacklisted buyer IDs
      const blacklistResponse = await fetch(`/api/suppliers/blacklist?supplierId=${userId}`)
      let blacklistedIds = new Set<string>()
      if (blacklistResponse.ok) {
        const blacklistData = await blacklistResponse.json()
        if (blacklistData.success) {
          blacklistedIds = new Set<string>(blacklistData.blacklistedBuyers.map((b: any) => String(b.buyerId)))
          setBlacklistedBuyers(blacklistedIds)
        }
      }
      
      // Then fetch buyers
      const response = await fetch(`/api/users/search?type=BUYER&supplierId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.users) {
          // Calculate risk assessments for all buyers in parallel
          const buyersWithRisk = await Promise.all(
            data.users.map(async (user: any) => {
              // Fetch risk assessment for each buyer
              try {
                const riskResponse = await fetch(
                  `/api/buyers/${user.userId}/risk-assessment?supplierId=${userId}`
                )
                if (riskResponse.ok) {
                  const riskData = await riskResponse.json()
                  if (riskData.success) {
                    return {
                      id: user.id,
                      userId: user.userId,
                      businessName: user.businessName,
                      nib: '',
                      category: 'Business',
                      riskLevel: riskData.riskLevel || null,
                      creditScore: user.creditScore,
                      totalOutstanding: user.totalOutstanding || 0,
                      address: user.address || '',
                      sector: 'Business Sector',
                      lastPaymentDate: user.lastPaymentDate,
                      totalInvoices: user.totalInvoices || 0,
                      paidInvoices: user.paidInvoices || 0,
                      preferredPaymentTerm: user.preferredPaymentTerm || 'NET14',
                      isBlacklisted: blacklistedIds.has(user.userId),
                      aiScore: riskData.aiScore || null,
                    }
                  }
                }
              } catch (error) {
                console.error(`Error fetching risk for ${user.userId}:`, error)
              }
              
              // Fallback if risk assessment fails - use stored riskLevel or calculate from credit score
              return {
                id: user.id,
                userId: user.userId,
                businessName: user.businessName,
                nib: '',
                category: 'Business',
                riskLevel: user.riskLevel || null,
                creditScore: user.creditScore,
                totalOutstanding: user.totalOutstanding || 0,
                address: user.address || '',
                sector: 'Business Sector',
                lastPaymentDate: user.lastPaymentDate,
                totalInvoices: user.totalInvoices || 0,
                paidInvoices: user.paidInvoices || 0,
                preferredPaymentTerm: user.preferredPaymentTerm || 'NET14',
                isBlacklisted: blacklistedIds.has(user.userId),
                aiScore: null,
              }
            })
          )
          
          setMyBuyers(buyersWithRisk)
        }
      }
    } catch (error) {
      console.error('Error refreshing buyers:', error)
    } finally {
      setIsLoadingBuyers(false)
    }
  }

  // Handle remove buyer (blacklist if in My Buyers, or remove from potential buyers)
  const handleRemoveBuyer = async (buyerId: string) => {
    try {
      // Check if buyer is in potential buyers or my buyers
      const isInPotential = isBuyerInPotentialBuyers(buyerId)
      
      if (isInPotential) {
        // Remove from potential buyers
        const response = await fetch(`/api/suppliers/potential-buyers?buyerId=${buyerId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setPotentialBuyers(prev => prev.filter(b => b.userId !== buyerId && b.id !== buyerId))
          alert(`Buyer ${buyerId} removed from potential buyers`)
        } else {
          throw new Error('Failed to remove buyer from potential buyers')
        }
      } else {
        // Blacklist if in My Buyers
        const response = await fetch('/api/suppliers/blacklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyerId: buyerId,
            reason: 'Removed by supplier',
            supplierId: userId, // Add supplierId for dev mode authentication
          }),
        })

        if (response.ok) {
          const responseData = await response.json()
          console.log('Blacklist POST response:', responseData)
          
          // Check if actually succeeded (response might be 200 but with error in body)
          if (!responseData.success) {
            throw new Error(responseData.error || 'Failed to blacklist buyer')
          }
          
          // Refresh My Buyers list (this will also refresh blacklist)
          await refreshMyBuyers()
          
          alert(`Buyer ${buyerId} has been removed and blacklisted`)
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error('Blacklist POST failed:', response.status, errorData)
          throw new Error(errorData.error || 'Failed to blacklist buyer')
        }
      }
    } catch (error) {
      console.error('Error removing buyer:', error)
      alert('Failed to remove buyer. Please try again.')
    }
  }

  // Handle restore buyer from blacklist
  const handleRestoreBuyer = async (buyerId: string) => {
    try {
      const response = await fetch(`/api/suppliers/blacklist/${buyerId}?supplierId=${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const responseData = await response.json()
        
        if (!responseData.success) {
          throw new Error(responseData.error || 'Failed to restore buyer')
        }
        
        // Refresh My Buyers list (this will also refresh blacklist)
        await refreshMyBuyers()
        
        alert(`Buyer ${buyerId} restored successfully`)
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to restore buyer')
      }
    } catch (error) {
      console.error('Error restoring buyer:', error)
      alert('Failed to restore buyer. Please try again.')
    }
  }

  // Handle add new buyer from Search All
  const handleAddBuyer = async (buyerId: string) => {
    try {
      const response = await fetch('/api/suppliers/potential-buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: buyerId,
          supplierId: userId, // Add supplierId for dev mode authentication
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Fetch full buyer details
          const buyerResponse = await fetch(`/api/users/search?q=${buyerId}&type=BUYER`)
          if (buyerResponse.ok) {
            const buyerData = await buyerResponse.json()
            if (buyerData.success && buyerData.users && buyerData.users.length > 0) {
              const user = buyerData.users[0]
              const newBuyer = {
                id: user.id,
                userId: user.userId,
                businessName: user.businessName,
                creditScore: user.creditScore,
                riskLevel: user.riskLevel || null,
                totalOutstanding: user.totalOutstanding || 0,
                address: user.address || '',
                businessTypes: user.businessTypes || '[]',
                preferredPaymentTerm: user.preferredPaymentTerm || 'NET14',
              }
              setPotentialBuyers(prev => [...prev, newBuyer])
              alert(`Buyer ${buyerId} added to potential buyers`)
            }
          }
        } else {
          throw new Error(data.message || 'Failed to add buyer')
        }
      } else {
        throw new Error('Failed to add buyer')
      }
    } catch (error) {
      console.error('Error adding buyer:', error)
      alert('Failed to add buyer. Please try again.')
    }
  }


  // Helper function to check if buyer is already in My Buyers
  const isBuyerInMyBuyers = (buyerIdOrUserId: string) => {
    return myBuyers.some(b => b.id === buyerIdOrUserId || b.userId === buyerIdOrUserId)
  }

  // Helper function to check if buyer is in Potential Buyers
  const isBuyerInPotentialBuyers = (buyerIdOrUserId: string) => {
    return potentialBuyers.some(b => b.id === buyerIdOrUserId || b.userId === buyerIdOrUserId)
  }

  // Helper function to check if buyer can be added (not in My Buyers, not in Potential Buyers, and not blacklisted)
  const canAddBuyer = (buyer: any) => {
    const buyerId = buyer.id || buyer.userId
    return !isBuyerInMyBuyers(buyerId) && !isBuyerInPotentialBuyers(buyerId) && !blacklistedBuyers.has(buyer.userId || buyerId)
  }

  // Get selected buyer data
  const getSelectedBuyerData = () => {
    if (activeTab === 'myBuyers') {
      return selectedBuyer ? myBuyers.find((b) => b.id === selectedBuyer || b.userId === selectedBuyer) : null
    } else if (activeTab === 'potentialBuyers') {
      return selectedBuyer ? potentialBuyers.find((b) => b.id === selectedBuyer || b.userId === selectedBuyer) : null
    } else {
      // For search all tab, check both searchResult (single) and searchResults (list)
      if (selectedBuyer) {
        const buyerFromList = searchResults.find((b) => b.id === selectedBuyer || b.userId === selectedBuyer)
        if (buyerFromList) return buyerFromList
      }
      return searchResult
    }
  }

  const selectedBuyerData = getSelectedBuyerData()
  const [riskAssessment, setRiskAssessment] = useState<any>(null)
  const [isLoadingRiskAssessment, setIsLoadingRiskAssessment] = useState(false)
  
  // Helper to get effective risk level for a buyer (uses AI Risk Assessment if available for selected buyer)
  // Only returns AI risk assessment value, never calculated from credit score
  const getEffectiveRiskLevel = (buyer: any) => {
    if (!selectedBuyerData || !riskAssessment) return buyer.riskLevel || null
    const buyerId = buyer.userId || buyer.id
    const selectedBuyerId = selectedBuyerData.userId || selectedBuyerData.id
    if (buyerId === selectedBuyerId && riskAssessment.riskLevel) {
      return riskAssessment.riskLevel
    }
    return buyer.riskLevel || null
  }

  // Fetch real AI risk assessment from API
  useEffect(() => {
    const fetchRiskAssessment = async () => {
      // Compute selectedBuyerData inside the effect to avoid dependency issues
      const currentSelectedBuyerData = getSelectedBuyerData()
      
      if (!currentSelectedBuyerData) {
        setRiskAssessment(null)
        return
      }

      setIsLoadingRiskAssessment(true)
      try {
        const buyerId = currentSelectedBuyerData.userId || currentSelectedBuyerData.id
        const supplierId = userId && userId.startsWith('SP') ? userId : undefined
        const url = supplierId
          ? `/api/buyers/${buyerId}/risk-assessment?supplierId=${supplierId}`
          : `/api/buyers/${buyerId}/risk-assessment`
        
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            const riskLevel = data.riskLevel
            
            setRiskAssessment({
              riskLevel: riskLevel,
              aiScore: data.aiScore,
              description: data.description,
              flaggedFactors: data.flaggedFactors,
              recommendedCreditLimit: data.recommendedCreditLimit,
            })
            
            // Update the buyer's riskLevel in the relevant list to match AI Risk Assessment
            if (activeTab === 'myBuyers') {
              setMyBuyers(prev => prev.map(b => 
                (b.userId === buyerId || b.id === buyerId) ? { ...b, riskLevel } : b
              ))
            } else if (activeTab === 'potentialBuyers') {
              setPotentialBuyers(prev => prev.map(b => 
                (b.userId === buyerId || b.id === buyerId) ? { ...b, riskLevel } : b
              ))
            } else if (activeTab === 'searchAll') {
              if (searchResult && (searchResult.userId === buyerId || searchResult.id === buyerId)) {
                setSearchResult({ ...searchResult, riskLevel })
              }
              setSearchResults(prev => prev.map(b => 
                (b.userId === buyerId || b.id === buyerId) ? { ...b, riskLevel } : b
              ))
            }
          } else {
            // Fallback to mock if API fails
            setRiskAssessment(getAIRiskAssessment(buyerId))
          }
        } else {
          // Fallback to mock if API fails
          setRiskAssessment(getAIRiskAssessment(buyerId))
        }
      } catch (error) {
        console.error('Error fetching risk assessment:', error)
        // Fallback to mock if API fails
        const buyerId = currentSelectedBuyerData.userId || currentSelectedBuyerData.id
        setRiskAssessment(getAIRiskAssessment(buyerId))
      } finally {
        setIsLoadingRiskAssessment(false)
      }
    }

    fetchRiskAssessment()
  }, [selectedBuyer, userId, activeTab]) // Use stable primitives instead of selectedBuyerData object

  // Helper function for risk badge - moved outside to avoid JSX parsing issues
  const getCreditScoreBadge = (creditScore: number) => {
    // Color coding: >=80 dark green, >=60 yellow/gold, >=40 orange, <40 red
    let fillColor = ''
    let textColor = ''
    
    if (creditScore >= 80) {
      fillColor = '#3C7F58' // Dark green (like in the image)
      textColor = '#3C7F58'
    } else if (creditScore >= 60) {
      fillColor = '#C69F33' // Golden yellow
      textColor = '#C69F33'
    } else if (creditScore >= 40) {
      fillColor = '#F97316' // Orange
      textColor = '#F97316'
    } else {
      fillColor = '#B44A4A' // Red
      textColor = '#B44A4A'
    }
    
    // Calculate progress for circle: 48px SVG, radius 20px (with stroke width 4, total radius = 22)
    const size = 48
    const radius = 20
    const circumference = 2 * Math.PI * radius
    const progress = creditScore / 100
    const strokeDashoffset = circumference - (progress * circumference)
    
    return (
      <div className="relative flex-shrink-0" style={{ width: '48px', height: '48px' }}>
        <svg className="transform -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle (unfilled) - light gray */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E8E3D9"
            strokeWidth="3"
            fill="none"
          />
          {/* Progress circle (filled) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={fillColor}
            strokeWidth="3"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Score number in center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-bold leading-none" style={{ color: textColor }}>
            {creditScore}
          </span>
        </div>
      </div>
    )
  }
  
  // Keep getRiskBadge for detailed view (AI Risk Assessment panel)
  const getRiskBadge = (riskLevel: string | null | undefined) => {
    if (!riskLevel) {
      return null
    }
    const config: Record<string, { bg: string; text: string }> = {
      'Low Risk': { bg: 'bg-status-success/10', text: 'text-status-success' },
      'Medium Risk': { bg: 'bg-status-warning/10', text: 'text-status-warning' },
      'High Risk': { bg: 'bg-status-error/10', text: 'text-status-error' },
      'Critical Risk': { bg: 'bg-status-error/10', text: 'text-status-error' },
    }
    const style = config[riskLevel] || config['Low Risk']
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {riskLevel}
      </span>
    )
  }
  
  // Handle generate report - calculate and persist risk level
  const handleGenerateReport = async () => {
    if (!selectedBuyerData) return
    
    try {
      const buyerId = selectedBuyerData.userId || selectedBuyerData.id
      const supplierId = userId && userId.startsWith('SP') ? userId : undefined
      const url = supplierId
        ? `/api/buyers/${buyerId}/risk-assessment?supplierId=${supplierId}`
        : `/api/buyers/${buyerId}/risk-assessment`
      
      const response = await fetch(url, {
        method: 'POST',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Refresh the risk assessment
          const assessmentResponse = await fetch(url)
          if (assessmentResponse.ok) {
            const assessmentData = await assessmentResponse.json()
            if (assessmentData.success) {
              setRiskAssessment({
                riskLevel: assessmentData.riskLevel,
                aiScore: assessmentData.aiScore,
                description: assessmentData.description,
                flaggedFactors: assessmentData.flaggedFactors,
                recommendedCreditLimit: assessmentData.recommendedCreditLimit,
              })
            }
          }
          
          // Refresh buyer lists to show updated risk level
          if (activeTab === 'myBuyers') {
            await refreshMyBuyers()
          } else if (activeTab === 'potentialBuyers') {
            // Re-fetch potential buyers
            if (userId && userId.startsWith('SP')) {
              try {
                const response = await fetch('/api/suppliers/potential-buyers')
                if (response.ok) {
                  const data = await response.json()
                  if (data.success && data.buyerIds && data.buyerIds.length > 0) {
                    const buyerDetails = await Promise.all(
                      data.buyerIds.map(async (buyerUserId: string) => {
                        const buyerResponse = await fetch(`/api/users/search?q=${buyerUserId}&type=BUYER`)
                        if (buyerResponse.ok) {
                          const buyerData = await buyerResponse.json()
                          if (buyerData.success && buyerData.users && buyerData.users.length > 0) {
                            const user = buyerData.users[0]
                            return {
                              id: user.id,
                              userId: user.userId,
                              businessName: user.businessName,
                              creditScore: user.creditScore,
                              riskLevel: user.riskLevel || null,
                              totalOutstanding: user.totalOutstanding || 0,
                              address: user.address || '',
                              businessTypes: user.businessTypes || '[]',
                              preferredPaymentTerm: user.preferredPaymentTerm || 'NET14',
                            }
                          }
                        }
                        return null
                      })
                    )
                    setPotentialBuyers(buyerDetails.filter((b: any) => b !== null))
                  } else {
                    setPotentialBuyers([])
                  }
                }
              } catch (error) {
                console.error('Error refreshing potential buyers:', error)
              }
            }
          }
          
          alert('Risk assessment calculated and saved successfully!')
        } else {
          throw new Error(data.error || 'Failed to generate report')
        }
      } else {
        throw new Error('Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Failed to generate report. Please try again.')
    }
  }

  const categories = ['Restaurant', 'Cafe', 'Retail', 'Hotel', 'Wholesale', 'Hospitality']

  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-dark mb-2">Buyer Registry</h1>
          <p className="text-text-dark/60">View and manage buyer profiles and credit assessments</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setActiveTab('myBuyers')
              setSelectedBuyer(null)
              setSearchResult(null)
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'myBuyers'
                ? 'bg-primary-green text-white'
                : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
            }`}
          >
            <Users className="w-5 h-5" />
            {language === 'id' ? 'Pembeli Saya' : 'My Buyers'}
          </button>
          <button
            onClick={() => {
              setActiveTab('potentialBuyers')
              setSelectedBuyer(null)
              setSearchResult(null)
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'potentialBuyers'
                ? 'bg-primary-green text-white'
                : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
            }`}
          >
            <UserPlus className="w-5 h-5" />
            {language === 'id' ? 'Pembeli Potensial' : 'Potential Buyers'}
          </button>
          <button
            onClick={() => {
              setActiveTab('searchAll')
              setSelectedBuyer(null)
              setSearchResult(null)
              setSearchResults([])
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'searchAll'
                ? 'bg-primary-green text-white'
                : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
            }`}
          >
            <UserSearch className="w-5 h-5" />
            {language === 'id' ? 'Cari Semua' : 'Search All'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel */}
          <div className="card-elevated">
            {activeTab === 'myBuyers' ? (
              <React.Fragment>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                    <h2 className="text-xl font-bold text-text-dark">My Buyers</h2>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showBlacklisted}
                          onChange={(e) => setShowBlacklisted(e.target.checked)}
                          className="w-4 h-4 text-primary-green rounded border-cream-grey"
                        />
                        <span className="text-sm text-text-dark">Show blacklisted only</span>
                      </label>
                      <div className="flex gap-2">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-colors ${
                          viewMode === 'list'
                            ? 'bg-primary-green text-white'
                            : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                        }`}
                        title="List View"
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded-lg transition-colors ${
                          viewMode === 'table'
                            ? 'bg-primary-green text-white'
                            : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                        }`}
                        title="Table View"
                      >
                        <Table2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cream-grey w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search by name or NIB..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>
                  </div>
                </div>

                {viewMode === 'list' ? (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {isLoadingBuyers && (
                      <div className="text-center py-8 text-text-dark/60">
                        <p>Loading buyers and calculating risk assessments...</p>
                      </div>
                    )}
                    {!isLoadingBuyers && filteredMyBuyers.length === 0 && (
                      <div className="text-center py-8 text-text-dark/60">
                        <p>No buyers found</p>
                      </div>
                    )}
                    {!isLoadingBuyers && filteredMyBuyers.map((buyer) => {
                      return (
                        <div
                          key={buyer.id}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            selectedBuyer === buyer.id
                              ? 'border-primary-green bg-primary-green/5'
                              : 'border-cream-grey hover:border-primary-green/50 hover:bg-cream-beige/30'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 cursor-pointer" onClick={() => setSelectedBuyer(buyer.id)}>
                              <h3 className="font-semibold text-text-dark mb-1">{buyer.businessName}</h3>
                              <p className="text-xs text-text-dark/60 mb-1">NIB: {buyer.nib || buyer.userId}</p>
                              <p className="text-xs text-text-dark/60">{buyer.category}</p>
                            </div>
                            <div className="flex flex-col items-end gap-3 ml-4">
                              {getCreditScoreBadge(buyer.creditScore)}
                              {buyer.isBlacklisted && (
                                <BuyerBlacklistBadge isBlacklisted={buyer.isBlacklisted} />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-end gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            {!buyer.isBlacklisted && (
                              <button
                                onClick={() => handleRemoveBuyer(buyer.userId)}
                                className="px-3 py-1 text-xs font-medium bg-status-error/10 text-status-error rounded-lg hover:bg-status-error/20 transition-colors flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                Remove
                              </button>
                            )}
                            {buyer.isBlacklisted && (
                              <button
                                onClick={() => handleRestoreBuyer(buyer.userId)}
                                className="px-3 py-1 text-xs font-medium bg-primary-green/10 text-primary-green rounded-lg hover:bg-primary-green/20 transition-colors flex items-center gap-1"
                              >
                                <UserPlus className="w-3 h-3" />
                                Restore
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b-2 border-cream-grey">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Buyer ID</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Business Name</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Credit Score</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-text-dark">Total Outstanding</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Credit Score</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Last Payment</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Payment Rate</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Payment Term</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMyBuyers.map((buyer, index) => {
                          const paymentRate = buyer.totalInvoices ? Math.round((buyer.paidInvoices / buyer.totalInvoices) * 100) : 0
                          const scoreColor = getScoreColor(buyer.creditScore)
                          return (
                            <tr
                              key={buyer.id}
                              className={`border-b border-cream-grey/50 hover:bg-cream-beige/30 transition-colors ${
                                selectedBuyer === buyer.id
                                  ? 'bg-primary-green/5'
                                  : index % 2 === 0 ? 'bg-white' : 'bg-cream-white/50'
                              }`}
                            >
                              <td className="py-3 px-4">
                                <span className="font-semibold text-primary-green">{buyer.userId}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-medium text-text-dark">{buyer.businessName}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="relative w-10 h-10">
                                    <svg className="transform -rotate-90" width="40" height="40">
                                      <circle
                                        cx="20"
                                        cy="20"
                                        r="15"
                                        stroke="#E8E3D9"
                                        strokeWidth="3"
                                        fill="none"
                                      />
                                      <circle
                                        cx="20"
                                        cy="20"
                                        r="15"
                                        stroke={scoreColor}
                                        strokeWidth="3"
                                        fill="none"
                                        strokeDasharray={94}
                                        strokeDashoffset={94 - (buyer.creditScore / 100) * 94}
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <span className="text-xs font-bold" style={{ color: scoreColor }}>
                                        {buyer.creditScore}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="font-semibold text-text-dark">{formatCurrency(buyer.totalOutstanding)}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {getCreditScoreBadge(buyer.creditScore)}
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm text-text-dark/60">
                                  {buyer.lastPaymentDate ? formatDate(buyer.lastPaymentDate, language) : '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-12 bg-cream-grey/30 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all duration-500 ${
                                        paymentRate >= 80 ? 'bg-status-success' :
                                        paymentRate >= 60 ? 'bg-status-warning' : 'bg-status-error'
                                      }`}
                                      style={{ width: `${paymentRate}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-medium text-text-dark/60">{paymentRate}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-green/10 text-primary-green">
                                  {buyer.preferredPaymentTerm === 'COD' ? 'COD' :
                                   buyer.preferredPaymentTerm === 'NET7' ? 'Net 7' :
                                   buyer.preferredPaymentTerm === 'NET14' ? 'Net 14' :
                                   buyer.preferredPaymentTerm === 'NET30' ? 'Net 30' : buyer.preferredPaymentTerm || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <BuyerBlacklistBadge isBlacklisted={buyer.isBlacklisted} />
                                  {!buyer.isBlacklisted && (
                                    <button
                                      onClick={() => handleRemoveBuyer(buyer.userId)}
                                      className="px-3 py-1 text-xs font-medium bg-status-error/10 text-status-error rounded-lg hover:bg-status-error/20 transition-colors flex items-center gap-1"
                                      title="Remove and blacklist buyer"
                                    >
                                      <X className="w-3 h-3" />
                                      Remove
                                    </button>
                                  )}
                                  {buyer.isBlacklisted && (
                                    <button
                                      onClick={() => handleRestoreBuyer(buyer.userId)}
                                      className="px-3 py-1 text-xs font-medium bg-primary-green/10 text-primary-green rounded-lg hover:bg-primary-green/20 transition-colors flex items-center gap-1"
                                      title="Restore buyer from blacklist"
                                    >
                                      <UserPlus className="w-3 h-3" />
                                      Restore
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setSelectedBuyer(buyer.id)}
                                    className="px-3 py-1 text-xs font-medium bg-primary-green/10 text-primary-green rounded-lg hover:bg-primary-green/20 transition-colors"
                                  >
                                    View
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </React.Fragment>
            ) : activeTab === 'potentialBuyers' ? (
              <React.Fragment>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-text-dark">Potential Buyers</h2>
                      <p className="text-sm text-text-dark/60 mt-1">Buyers you've added from search but haven't created invoices with yet</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-colors ${
                          viewMode === 'list'
                            ? 'bg-primary-green text-white'
                            : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                        }`}
                        title="List View"
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded-lg transition-colors ${
                          viewMode === 'table'
                            ? 'bg-primary-green text-white'
                            : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                        }`}
                        title="Table View"
                      >
                        <Table2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cream-grey w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search by name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                {isLoadingPotentialBuyers ? (
                  <div className="text-center py-8 text-text-dark/60">{language === 'id' ? 'Memuat pembeli potensial...' : 'Loading potential buyers...'}</div>
                ) : potentialBuyers.length === 0 ? (
                  <div className="text-center py-8 text-text-dark/60">{language === 'id' ? 'Belum ada pembeli potensial. Tambah pembeli dari tab "Cari Semua".' : 'No potential buyers yet. Add buyers from the "Search All" tab.'}</div>
                ) : viewMode === 'list' ? (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {potentialBuyers
                      .filter(buyer => 
                        !searchTerm || 
                        buyer.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        buyer.userId.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((buyer) => (
                        <div
                          key={buyer.id}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            selectedBuyer === buyer.id
                              ? 'border-primary-green bg-primary-green/5'
                              : 'border-cream-grey hover:border-primary-green/50 hover:bg-cream-beige/30'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 cursor-pointer" onClick={() => setSelectedBuyer(buyer.id)}>
                              <h3 className="font-semibold text-text-dark mb-1">{buyer.businessName}</h3>
                              <p className="text-xs text-text-dark/60 mb-1">ID: {buyer.userId}</p>
                              <p className="text-xs text-text-dark/60">
                                {typeof buyer.businessTypes === 'string' 
                                  ? JSON.parse(buyer.businessTypes || '[]').join(', ') || 'N/A'
                                  : Array.isArray(buyer.businessTypes) 
                                    ? buyer.businessTypes.join(', ')
                                    : 'N/A'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getCreditScoreBadge(buyer.creditScore)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="text-sm text-text-dark/60">
                              Credit Score: <span className="font-semibold">{buyer.creditScore}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveBuyer(buyer.userId)}
                              className="px-3 py-1 text-xs font-medium bg-status-error/10 text-status-error rounded-lg hover:bg-status-error/20 transition-colors flex items-center gap-1"
                              title="Remove from potential buyers"
                            >
                              <X className="w-3 h-3" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b-2 border-cream-grey">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Buyer ID</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Business Name</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Credit Score</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Category</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Credit Score</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {potentialBuyers
                          .filter(buyer => 
                            !searchTerm || 
                            buyer.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            buyer.userId.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((buyer, index) => {
                            const scoreColor = getScoreColor(buyer.creditScore)
                            const businessTypes = typeof buyer.businessTypes === 'string' 
                              ? JSON.parse(buyer.businessTypes || '[]')
                              : Array.isArray(buyer.businessTypes) ? buyer.businessTypes : []
                            return (
                              <tr
                                key={buyer.id}
                                className={`border-b border-cream-grey/50 hover:bg-cream-beige/30 transition-colors ${
                                  selectedBuyer === buyer.id
                                    ? 'bg-primary-green/5'
                                    : index % 2 === 0 ? 'bg-white' : 'bg-cream-white/50'
                                }`}
                              >
                                <td className="py-3 px-4">
                                  <span className="font-semibold text-primary-green">{buyer.userId}</span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-medium text-text-dark">{buyer.businessName}</span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="relative w-10 h-10">
                                      <svg className="transform -rotate-90" width="40" height="40">
                                        <circle
                                          cx="20"
                                          cy="20"
                                          r="15"
                                          stroke="#E8E3D9"
                                          strokeWidth="3"
                                          fill="none"
                                        />
                                        <circle
                                          cx="20"
                                          cy="20"
                                          r="15"
                                          stroke={scoreColor}
                                          strokeWidth="3"
                                          fill="none"
                                          strokeDasharray={94}
                                          strokeDashoffset={94 - (buyer.creditScore / 100) * 94}
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xs font-bold" style={{ color: scoreColor }}>
                                          {buyer.creditScore}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-sm text-text-dark/60">
                                    {businessTypes.length > 0 ? businessTypes.join(', ') : 'N/A'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {getCreditScoreBadge(buyer.creditScore)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => handleRemoveBuyer(buyer.userId)}
                                      className="px-3 py-1 text-xs font-medium bg-status-error/10 text-status-error rounded-lg hover:bg-status-error/20 transition-colors flex items-center gap-1"
                                      title="Remove from potential buyers"
                                    >
                                      <X className="w-3 h-3" />
                                      Remove
                                    </button>
                                    <button
                                      onClick={() => setSelectedBuyer(buyer.id)}
                                      className="px-3 py-1 text-xs font-medium bg-primary-green/10 text-primary-green rounded-lg hover:bg-primary-green/20 transition-colors"
                                    >
                                      View
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-text-dark mb-4">{language === 'id' ? 'Cari Semua Pembeli' : 'Search All Buyers'}</h2>
                  
                  {/* Search Mode Toggle */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setSearchMode('user')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        searchMode === 'user'
                          ? 'bg-primary-green text-white'
                          : 'bg-cream-beige text-text-dark'
                      }`}
                    >
                      {language === 'id' ? 'ID User' : 'User ID'}
                    </button>
                    <button
                      onClick={() => setSearchMode('category')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                        searchMode === 'category'
                          ? 'bg-primary-green text-white'
                          : 'bg-cream-beige text-text-dark'
                      }`}
                    >
                      {language === 'id' ? 'Kategori' : 'Category'}
                    </button>
                  </div>

                  {/* User ID Search */}
                  {searchMode === 'user' && (
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cream-grey w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Enter User ID (BJ####)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="input-field pl-10"
                      />
                      <button
                        onClick={handleSearch}
                        disabled={isSearching || !searchTerm.trim()}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 btn-primary px-4 py-1.5 text-sm"
                      >
                        {isSearching ? (language === 'id' ? 'Mencari...' : 'Searching...') : (language === 'id' ? 'Cari' : 'Search')}
                      </button>
                    </div>
                  )}

                  {/* Category Search */}
                  {searchMode === 'category' && (
                    <div className="mb-4">
                      <p className="text-sm text-text-dark/60 mb-2">{language === 'id' ? 'Pilih kategori:' : 'Select categories:'}</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => {
                              setSelectedCategories(prev =>
                                prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                              )
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              selectedCategories.includes(cat)
                                ? 'bg-primary-green text-white'
                                : 'bg-cream-beige text-text-dark hover:bg-cream-grey'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleSearch}
                        disabled={selectedCategories.length === 0}
                        className="mt-3 w-full btn-primary"
                      >
                        {language === 'id' ? 'Cari Berdasarkan Kategori' : 'Search by Category'}
                      </button>
                    </div>
                  )}

                  {/* Search Results - Category Search List */}
                  {searchMode === 'category' && searchResults.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-text-dark">
                          {language === 'id' ? `Ditemukan ${searchResults.length} pembeli${searchResults.length !== 1 ? '' : ''}` : `Found ${searchResults.length} buyer${searchResults.length !== 1 ? 's' : ''}`}
                        </h3>
                        <button
                          onClick={() => {
                            setSearchResults([])
                            setSearchResult(null)
                            setSelectedBuyer(null)
                          }}
                          className="text-cream-grey hover:text-text-dark"
                          title="Clear results"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {searchResults.map((buyer) => (
                          <div
                            key={buyer.id || buyer.userId}
                            onClick={() => setSelectedBuyer(buyer.id || buyer.userId)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedBuyer === (buyer.id || buyer.userId)
                                ? 'border-primary-green bg-primary-green/5'
                                : 'border-cream-grey hover:border-primary-green/50 hover:bg-cream-beige/30'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1">
                                <h4 className="font-semibold text-text-dark text-sm">{buyer.businessName}</h4>
                                <p className="text-xs text-text-dark/60">{buyer.userId}</p>
                              </div>
                              {getCreditScoreBadge(buyer.creditScore)}
                            </div>
                            {canAddBuyer(buyer) && (
                              <div className="flex items-center justify-end mt-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleAddBuyer(buyer.userId || buyer.id)}
                                  className="px-3 py-1 text-xs font-medium bg-primary-green/10 text-primary-green rounded-lg hover:bg-primary-green/20 transition-colors flex items-center gap-1"
                                  title="Add buyer to My Buyers"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  {language === 'id' ? 'Tambah' : 'Add'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Results - User ID Search (Single) */}
                  {searchMode === 'user' && searchResult && (
                    <div className="mt-4 p-4 bg-primary-green/5 rounded-lg border border-primary-green/20">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-text-dark">{searchResult.businessName}</h3>
                        <button
                          onClick={() => {
                            setSearchResult(null)
                            setSelectedBuyer(null)
                          }}
                          className="text-cream-grey hover:text-text-dark"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-text-dark/60">{searchResult.userId}</p>
                          <p className="text-sm text-text-dark/60">Credit Score: {searchResult.creditScore}/100</p>
                        </div>
                        {canAddBuyer(searchResult) && (
                          <button
                            onClick={() => handleAddBuyer(searchResult.userId || searchResult.id)}
                            className="px-3 py-1 text-xs font-medium bg-primary-green/10 text-primary-green rounded-lg hover:bg-primary-green/20 transition-colors flex items-center gap-1"
                            title="Add buyer to My Buyers"
                          >
                            <UserPlus className="w-3 h-3" />
                            {language === 'id' ? 'Tambah' : 'Add'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            )}
          </div>

          {/* Right Panel - Buyer Details */}
          <div className="card-elevated">
            {selectedBuyerData ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-text-dark">
                    {selectedBuyerData.businessName}
                  </h2>
                  {activeTab === 'searchAll' && canAddBuyer(selectedBuyerData) && (
                    <button
                      onClick={() => handleAddBuyer(selectedBuyerData.userId || selectedBuyerData.id)}
                      className="px-4 py-2 text-sm font-medium bg-primary-green text-white rounded-lg hover:bg-primary-green/90 transition-colors flex items-center gap-2"
                      title="Add buyer to My Buyers"
                    >
                      <UserPlus className="w-4 h-4" />
                      {language === 'id' ? 'Tambah' : 'Add'}
                    </button>
                  )}
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2 text-text-dark/70">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{selectedBuyerData.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-dark/70">
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm">{selectedBuyerData.sector || selectedBuyerData.businessType}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gradient-to-br from-primary-green/5 to-primary-olive/5 rounded-xl border border-primary-green/10">
                    <p className="text-xs text-text-dark/60 mb-2 font-semibold">CREDIT SCORE</p>
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16">
                        <svg className="transform -rotate-90" width="64" height="64">
                          <circle
                            cx="32"
                            cy="32"
                            r="24"
                            stroke="#E8E3D9"
                            strokeWidth="4"
                            fill="none"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="24"
                            stroke={getScoreColor(selectedBuyerData.creditScore)}
                            strokeWidth="4"
                            fill="none"
                            strokeDasharray={150}
                            strokeDashoffset={150 - (selectedBuyerData.creditScore / 100) * 150}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span
                            className="text-lg font-bold"
                            style={{ color: getScoreColor(selectedBuyerData.creditScore) }}
                          >
                            {selectedBuyerData.creditScore}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-text-dark">{selectedBuyerData.creditScore}/100</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-primary-olive/5 to-primary-green/5 rounded-xl border border-primary-olive/10">
                    <p className="text-xs text-text-dark/60 mb-2 font-semibold">TOTAL OUTSTANDING</p>
                    <p className="text-2xl font-bold text-text-dark">
                      {formatCurrency(selectedBuyerData.totalOutstanding)}
                    </p>
                  </div>
                </div>

                {/* Credit Score History Chart (if available) */}
                {selectedBuyerData.creditScoreHistory && selectedBuyerData.creditScoreHistory.length > 0 && (
                  <div className="mb-6 p-4 bg-white rounded-xl border border-cream-grey">
                    <h3 className="text-sm font-semibold text-text-dark mb-4">Credit Score History</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={selectedBuyerData.creditScoreHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E3D9" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#6B7280"
                          tickFormatter={(value) => formatDate(value, language).split(' ')[0]}
                        />
                        <YAxis stroke="#6B7280" domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#F7F4EF', border: '1px solid #E8E3D9', borderRadius: '8px' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#4C6A4F" 
                          strokeWidth={2}
                          dot={{ fill: '#4C6A4F', r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Payment Stats (if available) */}
                {selectedBuyerData.paymentStats && (
                  <div className="mb-6 p-4 bg-white rounded-xl border border-cream-grey">
                    <h3 className="text-sm font-semibold text-text-dark mb-3">Payment Statistics</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-text-dark/60">On-Time Rate</p>
                        <p className="font-bold text-text-dark">{selectedBuyerData.paymentStats.onTimeRate}%</p>
                      </div>
                      <div>
                        <p className="text-text-dark/60">Total Invoices</p>
                        <p className="font-bold text-text-dark">{selectedBuyerData.paymentStats.totalInvoices}</p>
                      </div>
                      <div>
                        <p className="text-text-dark/60">Paid Invoices</p>
                        <p className="font-bold text-text-dark">{selectedBuyerData.paymentStats.paidInvoices}</p>
                      </div>
                      <div>
                        <p className="text-text-dark/60">Overdue Invoices</p>
                        <p className="font-bold text-text-dark">{selectedBuyerData.paymentStats.overdueInvoices}</p>
                      </div>
                    </div>
                  </div>
                )}

                {riskAssessment && (
                  <div className="mb-6">
                    <AIRiskAssessment {...riskAssessment} />
                  </div>
                )}

                <button 
                  onClick={handleGenerateReport}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <Brain className="w-5 h-5" />
                  Generate Report
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                <div className="w-24 h-24 rounded-full bg-cream-grey/30 flex items-center justify-center mb-4">
                  <Building2 className="w-12 h-12 text-cream-grey" />
                </div>
                <p className="text-text-dark/60 text-lg">
                  {activeTab === 'myBuyers' ? 'Select a buyer to view details' : 
                   activeTab === 'potentialBuyers' ? 'Select a potential buyer to view details' :
                   'Search for a buyer to view details'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}


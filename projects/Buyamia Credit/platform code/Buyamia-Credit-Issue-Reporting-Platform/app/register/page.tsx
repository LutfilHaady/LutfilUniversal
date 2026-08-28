'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, CheckCircle, Loader2, Building2, User, AlertCircle, X, RefreshCw, ExternalLink, ShoppingCart, Package } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { LanguageToggle } from '@/components/LanguageToggle'

interface BuyamiaAccount {
  type: 'BUYER' | 'SUPPLIER'
  externalId: string
  userId?: string
  name: string
  email: string | null
  phone: string | null
  businessName: string | null
  address?: {
    line1: string
    line2?: string
    city: string
    state: string
    country: string
    zipCode: string
  }
  creditLimit?: number | null
}

type Step = 'search' | 'select' | 'otp'

export default function RegisterPage() {
  const router = useRouter()
  const { language } = useLanguage()
  
  const [step, setStep] = useState<Step>('search')
  const [searchInput, setSearchInput] = useState('')
  const [searchType, setSearchType] = useState<'email' | 'phone'>('email')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [noAccountFound, setNoAccountFound] = useState(false)
  const [foundAccounts, setFoundAccounts] = useState<BuyamiaAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<BuyamiaAccount | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [showExistsModal, setShowExistsModal] = useState(false)
  const [existingUserId, setExistingUserId] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isResending, setIsResending] = useState(false)
  const otpInputRef = useRef<HTMLInputElement>(null)
  
  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])
  
  // Auto-submit OTP when 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && !isSubmitting && step === 'otp') {
      handleOtpSubmit()
    }
  }, [otp])
  
  // Focus OTP input when step changes to OTP
  useEffect(() => {
    if (step === 'otp' && otpInputRef.current) {
      otpInputRef.current.focus()
    }
  }, [step])
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchInput.trim()) {
      setSearchError('Please enter your email or phone number')
      return
    }
    
    setIsSearching(true)
    setSearchError('')
    setNoAccountFound(false)
    setFoundAccounts([])
    
    try {
      const response = await fetch('/api/auth/search-buyamia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: searchType === 'email' ? searchInput : undefined,
          phone: searchType === 'phone' ? searchInput : undefined,
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.accounts.length > 0) {
        setFoundAccounts(data.accounts)
        // If only one account found, auto-select it
        if (data.accounts.length === 1) {
          handleSelectAccount(data.accounts[0])
        } else {
          setStep('select')
        }
      } else {
        setNoAccountFound(true)
      }
    } catch (error) {
      setSearchError('Failed to search. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }
  
  const handleSelectAccount = async (account: BuyamiaAccount) => {
    setSelectedAccount(account)
    setIsSubmitting(true)
    setSearchError('')
    
    try {
      const response = await fetch('/api/auth/register-buyamia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: account.type,
          externalId: account.externalId,
          externalUserId: account.userId,
          name: account.name,
          email: account.email,
          phone: account.phone,
          businessName: account.businessName || account.name,
          address: account.address,
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setStep('otp')
        setResendCooldown(60) // Start 60 second cooldown after OTP sent
      } else {
        // If account already exists, show popup
        if (data.existingUserId) {
          setExistingUserId(data.existingUserId)
          setShowExistsModal(true)
          setSelectedAccount(null)
          return
        }
        setSearchError(data.error || 'Registration failed')
        setSelectedAccount(null)
      }
    } catch (error) {
      setSearchError('Failed to register. Please try again.')
      setSelectedAccount(null)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // OTP submit function (used by both form submit and auto-submit)
  const handleOtpSubmit = async () => {
    if (otp.length !== 6 || isSubmitting) return
    
    setIsSubmitting(true)
    setOtpError('')
    
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: selectedAccount?.phone,
          code: otp,
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Store Buyamia data in session storage for the complete-profile page
        sessionStorage.setItem('buyamia_account', JSON.stringify(selectedAccount))
        router.push('/register/complete-profile')
      } else {
        setOtpError(data.error || 'Invalid code. Please try again.')
        setOtp('') // Clear OTP on error for retry
      }
    } catch (error) {
      setOtpError('Verification failed. Please try again.')
      setOtp('') // Clear OTP on error for retry
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      setOtpError('Please enter a 6-digit code')
      return
    }
    handleOtpSubmit()
  }
  
  // Go back to previous step
  const handleBack = () => {
    if (step === 'otp') {
      setStep('select')
      setOtp('')
      setOtpError('')
    } else if (step === 'select') {
      setStep('search')
      setFoundAccounts([])
      setSelectedAccount(null)
    }
  }
  
  const handleResendOtp = async () => {
    if (!selectedAccount || resendCooldown > 0) return
    
    setIsResending(true)
    setOtpError('')
    
    try {
      const response = await fetch('/api/auth/register-buyamia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedAccount.type,
          externalId: selectedAccount.externalId,
          externalUserId: selectedAccount.userId,
          name: selectedAccount.name,
          email: selectedAccount.email,
          phone: selectedAccount.phone,
          businessName: selectedAccount.businessName || selectedAccount.name,
          address: selectedAccount.address,
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setResendCooldown(60) // Reset 60 second cooldown
        setOtp('') // Clear any existing input
      } else {
        setOtpError(data.error || 'Failed to resend code')
      }
    } catch (error) {
      setOtpError('Failed to resend code. Please try again.')
    } finally {
      setIsResending(false)
    }
  }
  
  const formatAddress = (address: BuyamiaAccount['address']) => {
    if (!address) return null
    const parts = [address.line1, address.line2, address.city, address.state].filter(Boolean)
    return parts.join(', ')
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-white via-cream-beige to-cream-white flex items-center justify-center py-12 px-4 relative overflow-hidden">
      {/* Account Already Exists Modal */}
      {showExistsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowExistsModal(false)}
              className="absolute top-4 right-4 text-text-dark/40 hover:text-text-dark"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-orange-600" />
              </div>
              
              <h2 className="text-xl font-bold text-text-dark mb-2">
                Account Already Exists
              </h2>
              
              <p className="text-text-dark/60 mb-6">
                An account with this phone number is already registered on Buyamia Credit.
                {existingUserId && (
                  <span className="block mt-2 font-medium text-text-dark">
                    User ID: {existingUserId}
                  </span>
                )}
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExistsModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="flex-1 btn-primary"
                >
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-green/5 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-olive/5 rounded-full blur-3xl -z-10"></div>
      
      {/* Language Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>
      
      <div className="max-w-md w-full relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-primary-green hover:text-primary-olive transition-colors mb-6 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </Link>
        
        <div className="card-elevated backdrop-blur-sm">
          {/* Header */}
          <div className="mb-6 pb-6 border-b-2 border-cream-beige">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-green to-primary-olive flex items-center justify-center shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-dark">
                  Register for Buyamia Credit
                </h1>
                <p className="text-text-dark/60 text-sm">
                  {step === 'search' && 'Find your Buyamia account to get started'}
                  {step === 'select' && 'Select your account'}
                  {step === 'otp' && 'Verify your phone number'}
                </p>
              </div>
            </div>
            
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mt-4">
              {['search', 'select', 'otp'].map((s, idx) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    step === s ? 'bg-primary-green text-white' : 
                    ['search', 'select', 'otp'].indexOf(step) > idx ? 'bg-primary-green/20 text-primary-green' : 
                    'bg-cream-grey/50 text-text-dark/40'
                  }`}>
                    {idx + 1}
                  </div>
                  {idx < 2 && (
                    <div className={`w-8 h-0.5 ${
                      ['search', 'select', 'otp'].indexOf(step) > idx ? 'bg-primary-green/40' : 'bg-cream-grey/50'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Step 1: Search */}
          {step === 'search' && (
            <form onSubmit={handleSearch} className="space-y-4">
              <p className="text-sm text-text-dark/70">
                Enter the email or phone number you use on the Buyamia marketplace.
              </p>
              
              {/* Search type toggle */}
              <div className="flex rounded-lg bg-cream-beige/50 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => { setSearchType('email'); setSearchInput(''); setSearchError(''); setNoAccountFound(false); }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    searchType === 'email' ? 'bg-white shadow-sm text-primary-green' : 'text-text-dark/60'
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchType('phone'); setSearchInput(''); setSearchError(''); setNoAccountFound(false); }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    searchType === 'phone' ? 'bg-white shadow-sm text-primary-green' : 'text-text-dark/60'
                  }`}
                >
                  Phone
                </button>
              </div>
              
              <div>
                <input
                  type={searchType === 'email' ? 'email' : 'tel'}
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); setSearchError(''); setNoAccountFound(false); }}
                  placeholder={searchType === 'email' ? 'your@email.com' : '+62 812-3456-7890'}
                  className="input-field text-lg"
                  autoFocus
                />
              </div>
              
              {/* No Account Found - Special UI */}
              {noAccountFound && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-800 mb-1">No Buyamia Account Found</h4>
                      <p className="text-sm text-amber-700 mb-3">
                        We couldn't find a Buyamia marketplace account with this {searchType}. You need a Buyamia account to register for Buyamia Credit.
                      </p>
                      <a 
                        href="https://buyamia.com/register" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                      >
                        Create Buyamia Account
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
              
              {searchError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{searchError}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isSearching || !searchInput.trim()}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                {isSearching ? 'Searching...' : 'Find My Account'}
              </button>
              
              <p className="text-xs text-text-dark/50 text-center pt-2">
                Don't have a Buyamia account?{' '}
                <a href="https://buyamia.com" target="_blank" rel="noopener noreferrer" className="text-primary-green hover:underline">
                  Sign up here
                </a>
              </p>
            </form>
          )}
          
          {/* Step 2: Select Account */}
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-text-dark/70">
                We found {foundAccounts.length} account(s). Select one to continue:
              </p>
              
              <div className="space-y-3">
                {foundAccounts.map((account, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectAccount(account)}
                    disabled={isSubmitting}
                    className="w-full p-4 border-2 rounded-xl text-left hover:border-primary-green hover:bg-primary-green/5 transition-all disabled:opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        account.type === 'BUYER' ? 'bg-blue-100' : 'bg-orange-100'
                      }`}>
                        {account.type === 'BUYER' ? (
                          <User className="w-5 h-5 text-blue-700" />
                        ) : (
                          <Building2 className="w-5 h-5 text-orange-700" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            account.type === 'BUYER' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {account.type}
                          </span>
                        </div>
                        <p className="font-semibold text-text-dark mt-1 truncate">
                          {account.businessName || account.name}
                        </p>
                        <p className="text-sm text-text-dark/60 truncate">
                          {account.email || account.phone}
                        </p>
                        {account.address && (
                          <p className="text-xs text-text-dark/40 mt-1 truncate">
                            {formatAddress(account.address)}
                          </p>
                        )}
                      </div>
                      {isSubmitting && selectedAccount?.externalId === account.externalId && (
                        <Loader2 className="w-5 h-5 animate-spin text-primary-green" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {searchError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{searchError}</p>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => { setStep('search'); setFoundAccounts([]); setSearchError(''); }}
                className="w-full btn-secondary"
              >
                ← Search Again
              </button>
            </div>
          )}
          
          {/* Step 3: OTP Verification */}
          {step === 'otp' && (
            <form onSubmit={handleOtpVerify} className="space-y-4">
              {/* Selected Account Summary */}
              {selectedAccount && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selectedAccount.type === 'BUYER' ? 'bg-blue-100' : 'bg-orange-100'
                  }`}>
                    {selectedAccount.type === 'BUYER' ? (
                      <ShoppingCart className="w-5 h-5 text-blue-700" />
                    ) : (
                      <Package className="w-5 h-5 text-orange-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-dark text-sm truncate">
                      {selectedAccount.businessName || selectedAccount.name}
                    </p>
                    <p className="text-xs text-text-dark/60">
                      {selectedAccount.type === 'BUYER' ? 'Buyer' : 'Supplier'} Account
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                </div>
              )}
              
              <div className="text-center py-2">
                <p className="text-sm text-text-dark/60">
                  We sent a 6-digit verification code to
                </p>
                <p className="font-semibold text-text-dark text-lg">
                  {selectedAccount?.phone}
                </p>
              </div>
              
              {/* OTP Input */}
              <div className="relative">
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                  placeholder="000000"
                  className="input-field text-center text-3xl tracking-[0.5em] font-mono"
                  autoComplete="one-time-code"
                />
                {isSubmitting && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-green" />
                  </div>
                )}
              </div>
              
              {/* Progress dots */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i < otp.length ? 'bg-primary-green scale-110' : 'bg-cream-grey'
                    }`}
                  />
                ))}
              </div>
              
              {otpError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 text-center">{otpError}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
              </button>
              
              {/* Resend code & Back buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-sm text-text-dark/60 hover:text-text-dark transition-colors"
                >
                  ← Change account
                </button>
                
                {resendCooldown > 0 ? (
                  <p className="text-sm text-text-dark/50">
                    Resend in <span className="font-semibold text-primary-green">{resendCooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isResending}
                    className="inline-flex items-center gap-1 text-sm text-primary-green hover:text-primary-olive font-medium transition-colors disabled:opacity-50"
                  >
                    {isResending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    {isResending ? 'Sending...' : 'Resend'}
                  </button>
                )}
              </div>
              
              <p className="text-xs text-text-dark/40 text-center">
                Check WhatsApp • <span className="text-primary-green">Dev: check console</span>
              </p>
            </form>
          )}
          
          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-cream-beige">
            <p className="text-sm text-text-dark/60 text-center">
              Already registered?{' '}
              <Link href="/login" className="text-primary-green hover:text-primary-olive font-semibold transition-colors">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

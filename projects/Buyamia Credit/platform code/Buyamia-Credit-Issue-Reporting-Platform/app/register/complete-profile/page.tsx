'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Loader2, Building2, User, MapPin, ShoppingCart, Package, Shield, Edit2 } from 'lucide-react'
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

// Phone number formatting function
const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/[^\d+]/g, '')
  
  if (cleaned.startsWith('+62')) {
    const digits = cleaned.slice(3)
    if (digits.length <= 3) return `+62 ${digits}`
    if (digits.length <= 7) return `+62 ${digits.slice(0, 3)}-${digits.slice(3)}`
    if (digits.length <= 11) return `+62 ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    return `+62 ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
  }
  
  return cleaned
}

export default function CompleteProfilePage() {
  const router = useRouter()
  const { language } = useLanguage()
  
  const [buyamiaAccount, setBuyamiaAccount] = useState<BuyamiaAccount | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [editingBasicInfo, setEditingBasicInfo] = useState(false)
  
  // Common form state
  const [form, setForm] = useState({
    // Pre-filled from Buyamia (editable if needed)
    businessName: '',
    ownerName: '',
    phoneNumber: '',
    address: '',
    
    // BUYER-specific fields
    businessTypes: [] as string[],
    averagePurchaseVolume: '',
    orderFrequency: '',
    preferredPaymentTerm: '',
    yearsInOperation: '',
    businessRegistrationNumber: '',
    
    // SUPPLIER-specific fields
    categories: [] as string[],
    regionsServed: [] as string[],
    averageSupplyCapacity: '',
    creditTermsOffered: [] as string[],
    deliveryMethods: [] as string[],
    returnPolicy: '',
    
    // Common contact person
    contactPersonName: '',
    contactPersonPhone: '',
    contactPersonEmail: '',
  })
  
  // Load Buyamia account data from session storage
  useEffect(() => {
    const stored = sessionStorage.getItem('buyamia_account')
    if (stored) {
      try {
        const account = JSON.parse(stored) as BuyamiaAccount
        setBuyamiaAccount(account)
        
        // Pre-fill form with Buyamia data
        const address = account.address 
          ? [account.address.line1, account.address.line2, account.address.city, account.address.state]
              .filter(Boolean).join(', ')
          : ''
        
        setForm(prev => ({
          ...prev,
          businessName: account.businessName || account.name || '',
          ownerName: account.name || '',
          phoneNumber: account.phone || '',
          address: address,
          contactPersonName: account.name || '',
          contactPersonPhone: account.phone || '',
          contactPersonEmail: account.email || '',
        }))
      } catch (e) {
        router.push('/register')
      }
    } else {
      router.push('/register')
    }
  }, [router])
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    // Common validations
    if (!form.businessName.trim()) newErrors.businessName = 'Business name is required'
    if (!form.ownerName.trim()) newErrors.ownerName = 'Owner name is required'
    if (!form.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required'
    if (!form.address.trim()) newErrors.address = 'Address is required'
    if (!form.contactPersonName.trim()) newErrors.contactPersonName = 'Contact person name is required'
    if (!form.contactPersonPhone.trim()) newErrors.contactPersonPhone = 'Contact person phone is required'
    
    // Type-specific validations
    if (buyamiaAccount?.type === 'BUYER') {
      if (form.businessTypes.length === 0) newErrors.businessTypes = 'Select at least one business type'
      if (!form.averagePurchaseVolume) newErrors.averagePurchaseVolume = 'Select purchase volume'
      if (!form.orderFrequency) newErrors.orderFrequency = 'Select order frequency'
      if (!form.preferredPaymentTerm) newErrors.preferredPaymentTerm = 'Select payment term'
      if (!form.yearsInOperation) newErrors.yearsInOperation = 'Enter years in operation'
    } else if (buyamiaAccount?.type === 'SUPPLIER') {
      if (form.categories.length === 0) newErrors.categories = 'Select at least one category'
      if (form.regionsServed.length === 0) newErrors.regionsServed = 'Select at least one region'
      if (!form.averageSupplyCapacity) newErrors.averageSupplyCapacity = 'Select supply capacity'
      if (form.creditTermsOffered.length === 0) newErrors.creditTermsOffered = 'Select at least one credit term'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.text-status-error')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: buyamiaAccount?.externalId,
          type: buyamiaAccount?.type,
          businessName: form.businessName,
          ownerName: form.ownerName,
          phoneNumber: form.phoneNumber,
          address: form.address,
          // Buyer fields
          businessTypes: form.businessTypes,
          averagePurchaseVolume: form.averagePurchaseVolume,
          orderFrequency: form.orderFrequency,
          preferredPaymentTerm: form.preferredPaymentTerm,
          yearsInOperation: form.yearsInOperation ? parseInt(form.yearsInOperation) : null,
          businessRegistrationNumber: form.businessRegistrationNumber || null,
          // Supplier fields
          categories: form.categories,
          regionsServed: form.regionsServed,
          averageSupplyCapacity: form.averageSupplyCapacity,
          creditTermsOffered: form.creditTermsOffered,
          deliveryMethods: form.deliveryMethods,
          returnPolicy: form.returnPolicy,
          // Contact
          contactPersonName: form.contactPersonName,
          contactPersonPhone: form.contactPersonPhone,
          contactPersonEmail: form.contactPersonEmail || null,
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        sessionStorage.removeItem('buyamia_account')
        // Store userId in localStorage for dashboard
        if (data.data?.userId) {
          localStorage.setItem('userId', data.data.userId)
        }
        router.push('/dashboard?welcome=true')
      } else {
        setErrors({ submit: data.error || 'Failed to complete registration' })
      }
    } catch (error) {
      setErrors({ submit: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  if (!buyamiaAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary-green" />
      </div>
    )
  }
  
  const isBuyer = buyamiaAccount.type === 'BUYER'
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-white via-cream-beige to-cream-white py-8 px-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-green/5 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-olive/5 rounded-full blur-3xl -z-10"></div>
      
      {/* Language Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>
      
      <div className="max-w-2xl mx-auto relative z-10">
        <Link href="/register" className="inline-flex items-center gap-2 text-primary-green hover:text-primary-olive transition-colors mb-4 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back</span>
        </Link>
        
        <div className="card-elevated backdrop-blur-sm">
          {/* Header */}
          <div className="mb-6 pb-6 border-b-2 border-cream-beige">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                isBuyer 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                  : 'bg-gradient-to-br from-orange-500 to-orange-600'
              }`}>
                {isBuyer ? (
                  <ShoppingCart className="w-6 h-6 text-white" />
                ) : (
                  <Package className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-dark">
                  Complete Your {isBuyer ? 'Buyer' : 'Supplier'} Profile
                </h1>
                <p className="text-text-dark/60 text-sm">
                  Just a few more details to get you started
                </p>
              </div>
            </div>
            
            {/* Account type badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isBuyer ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              <Shield className="w-4 h-4" />
              Registering as {isBuyer ? 'Buyer' : 'Supplier'}
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Pre-filled Section - Collapsible/Editable */}
            <div className="rounded-xl border-2 border-cream-grey overflow-hidden">
              <button
                type="button"
                onClick={() => setEditingBasicInfo(!editingBasicInfo)}
                className="w-full p-4 bg-cream-beige/30 flex items-center justify-between hover:bg-cream-beige/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary-green" />
                  <div className="text-left">
                    <h3 className="font-semibold text-text-dark">Account Information</h3>
                    <p className="text-xs text-text-dark/60">From your Buyamia account</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!editingBasicInfo && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  <Edit2 className={`w-4 h-4 transition-transform ${editingBasicInfo ? 'rotate-45' : ''}`} />
                </div>
              </button>
              
              {editingBasicInfo ? (
                <div className="p-4 space-y-4 border-t border-cream-grey">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-dark mb-1">
                        Business Name <span className="text-status-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.businessName}
                        onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                        className={`input-field ${errors.businessName ? 'border-status-error' : ''}`}
                      />
                      {errors.businessName && <p className="text-xs text-status-error mt-1">{errors.businessName}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-text-dark mb-1">
                        Owner Name <span className="text-status-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.ownerName}
                        onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                        className={`input-field ${errors.ownerName ? 'border-status-error' : ''}`}
                      />
                      {errors.ownerName && <p className="text-xs text-status-error mt-1">{errors.ownerName}</p>}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-dark mb-1">
                      Phone Number <span className="text-status-error">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.phoneNumber}
                      onChange={(e) => setForm({ ...form, phoneNumber: formatPhoneNumber(e.target.value) })}
                      className={`input-field ${errors.phoneNumber ? 'border-status-error' : ''}`}
                    />
                    {errors.phoneNumber && <p className="text-xs text-status-error mt-1">{errors.phoneNumber}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-dark mb-1">
                      Business Address <span className="text-status-error">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className={`input-field resize-none ${errors.address ? 'border-status-error' : ''}`}
                    />
                    {errors.address && <p className="text-xs text-status-error mt-1">{errors.address}</p>}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-2 border-t border-cream-grey bg-green-50/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-dark/60">Business</span>
                    <span className="font-medium text-text-dark">{form.businessName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-dark/60">Owner</span>
                    <span className="font-medium text-text-dark">{form.ownerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-dark/60">Phone</span>
                    <span className="font-medium text-text-dark">{form.phoneNumber}</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-text-dark/60">Address</span>
                    <span className="font-medium text-text-dark text-right max-w-[60%]">{form.address}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Type-Specific Fields */}
            {isBuyer ? (
              /* BUYER FIELDS */
              <div className="space-y-5">
                <h3 className="text-lg font-semibold text-text-dark flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  Buyer Information
                </h3>
                
                {/* Business Types */}
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-2">
                    Business Type <span className="text-status-error">*</span>
                  </label>
                  <p className="text-xs text-text-dark/60 mb-2">Select all that apply</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'restaurant', label: 'Restaurant' },
                      { value: 'cafe', label: 'Cafe' },
                      { value: 'hotel', label: 'Hotel' },
                      { value: 'catering', label: 'Catering' },
                      { value: 'minimarket', label: 'Minimarket' },
                      { value: 'retail', label: 'Retail' },
                      { value: 'bakery', label: 'Bakery' },
                      { value: 'other', label: 'Other' },
                    ].map((type) => (
                      <label
                        key={type.value}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          form.businessTypes.includes(type.value) 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-cream-grey hover:border-blue-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.businessTypes.includes(type.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, businessTypes: [...form.businessTypes, type.value] })
                            } else {
                              setForm({ ...form, businessTypes: form.businessTypes.filter(t => t !== type.value) })
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-cream-grey rounded"
                        />
                        <span className="text-sm">{type.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.businessTypes && <p className="text-xs text-status-error mt-1">{errors.businessTypes}</p>}
                </div>
                
                {/* Purchase Volume & Frequency */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-dark mb-1">
                      Avg. Monthly Purchase <span className="text-status-error">*</span>
                    </label>
                    <select
                      value={form.averagePurchaseVolume}
                      onChange={(e) => setForm({ ...form, averagePurchaseVolume: e.target.value })}
                      className={`input-field ${errors.averagePurchaseVolume ? 'border-status-error' : ''}`}
                    >
                      <option value="">Select range</option>
                      <option value="<5M">&lt; 5M IDR</option>
                      <option value="5-20M">5M - 20M IDR</option>
                      <option value="20-50M">20M - 50M IDR</option>
                      <option value="50-100M">50M - 100M IDR</option>
                      <option value="100M+">100M+ IDR</option>
                    </select>
                    {errors.averagePurchaseVolume && <p className="text-xs text-status-error mt-1">{errors.averagePurchaseVolume}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-dark mb-1">
                      Order Frequency <span className="text-status-error">*</span>
                    </label>
                    <select
                      value={form.orderFrequency}
                      onChange={(e) => setForm({ ...form, orderFrequency: e.target.value })}
                      className={`input-field ${errors.orderFrequency ? 'border-status-error' : ''}`}
                    >
                      <option value="">Select frequency</option>
                      <option value="daily">Daily</option>
                      <option value="2-3x-week">2-3x / week</option>
                      <option value="weekly">Weekly</option>
                      <option value="bi-weekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    {errors.orderFrequency && <p className="text-xs text-status-error mt-1">{errors.orderFrequency}</p>}
                  </div>
                </div>
                
                {/* Payment Term & Years */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-dark mb-1">
                      Preferred Payment Term <span className="text-status-error">*</span>
                    </label>
                    <select
                      value={form.preferredPaymentTerm}
                      onChange={(e) => setForm({ ...form, preferredPaymentTerm: e.target.value })}
                      className={`input-field ${errors.preferredPaymentTerm ? 'border-status-error' : ''}`}
                    >
                      <option value="">Select term</option>
                      <option value="COD">Cash on Delivery</option>
                      <option value="NET7">Net 7 days</option>
                      <option value="NET14">Net 14 days</option>
                      <option value="NET30">Net 30 days</option>
                    </select>
                    {errors.preferredPaymentTerm && <p className="text-xs text-status-error mt-1">{errors.preferredPaymentTerm}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-dark mb-1">
                      Years in Operation <span className="text-status-error">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.yearsInOperation}
                      onChange={(e) => setForm({ ...form, yearsInOperation: e.target.value })}
                      placeholder="e.g., 3"
                      className={`input-field ${errors.yearsInOperation ? 'border-status-error' : ''}`}
                    />
                    {errors.yearsInOperation && <p className="text-xs text-status-error mt-1">{errors.yearsInOperation}</p>}
                  </div>
                </div>
                
                {/* NIB (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">
                    Business Registration Number (NIB) <span className="text-text-dark/40 text-xs">Optional</span>
                  </label>
                  <input
                    type="text"
                    value={form.businessRegistrationNumber}
                    onChange={(e) => setForm({ ...form, businessRegistrationNumber: e.target.value })}
                    placeholder="e.g., 123456789012345"
                    className="input-field"
                  />
                  <p className="text-xs text-text-dark/50 mt-1">Having a NIB may help approve higher credit limits</p>
                </div>
              </div>
            ) : (
              /* SUPPLIER FIELDS */
              <div className="space-y-5">
                <h3 className="text-lg font-semibold text-text-dark flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-600" />
                  Supplier Information
                </h3>
                
                {/* Product Categories */}
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-2">
                    Product Categories <span className="text-status-error">*</span>
                  </label>
                  <p className="text-xs text-text-dark/60 mb-2">Select all that apply</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'fresh-produce', label: 'Fresh Produce' },
                      { value: 'meat-poultry', label: 'Meat & Poultry' },
                      { value: 'seafood', label: 'Seafood' },
                      { value: 'dairy', label: 'Dairy Products' },
                      { value: 'dry-goods', label: 'Dry Goods' },
                      { value: 'beverages', label: 'Beverages' },
                      { value: 'frozen', label: 'Frozen Foods' },
                      { value: 'other', label: 'Other' },
                    ].map((cat) => (
                      <label
                        key={cat.value}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          form.categories.includes(cat.value) 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-cream-grey hover:border-orange-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.categories.includes(cat.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, categories: [...form.categories, cat.value] })
                            } else {
                              setForm({ ...form, categories: form.categories.filter(c => c !== cat.value) })
                            }
                          }}
                          className="w-4 h-4 text-orange-600 border-cream-grey rounded"
                        />
                        <span className="text-sm">{cat.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.categories && <p className="text-xs text-status-error mt-1">{errors.categories}</p>}
                </div>
                
                {/* Regions Served */}
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-2">
                    Regions Served <span className="text-status-error">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'jakarta', label: 'Jakarta' },
                      { value: 'bali', label: 'Bali' },
                      { value: 'surabaya', label: 'Surabaya' },
                      { value: 'bandung', label: 'Bandung' },
                      { value: 'yogyakarta', label: 'Yogyakarta' },
                      { value: 'nationwide', label: 'Nationwide' },
                    ].map((region) => (
                      <label
                        key={region.value}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          form.regionsServed.includes(region.value) 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-cream-grey hover:border-orange-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.regionsServed.includes(region.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, regionsServed: [...form.regionsServed, region.value] })
                            } else {
                              setForm({ ...form, regionsServed: form.regionsServed.filter(r => r !== region.value) })
                            }
                          }}
                          className="w-4 h-4 text-orange-600 border-cream-grey rounded"
                        />
                        <span className="text-sm">{region.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.regionsServed && <p className="text-xs text-status-error mt-1">{errors.regionsServed}</p>}
                </div>
                
                {/* Supply Capacity */}
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">
                    Average Monthly Supply Capacity <span className="text-status-error">*</span>
                  </label>
                  <select
                    value={form.averageSupplyCapacity}
                    onChange={(e) => setForm({ ...form, averageSupplyCapacity: e.target.value })}
                    className={`input-field ${errors.averageSupplyCapacity ? 'border-status-error' : ''}`}
                  >
                    <option value="">Select capacity</option>
                    <option value="<50M">&lt; 50M IDR</option>
                    <option value="50-200M">50M - 200M IDR</option>
                    <option value="200-500M">200M - 500M IDR</option>
                    <option value="500M-1B">500M - 1B IDR</option>
                    <option value="1B+">1B+ IDR</option>
                  </select>
                  {errors.averageSupplyCapacity && <p className="text-xs text-status-error mt-1">{errors.averageSupplyCapacity}</p>}
                </div>
                
                {/* Credit Terms Offered */}
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-2">
                    Credit Terms You Offer <span className="text-status-error">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'COD', label: 'COD' },
                      { value: 'NET7', label: 'Net 7' },
                      { value: 'NET14', label: 'Net 14' },
                      { value: 'NET30', label: 'Net 30' },
                      { value: 'NET45', label: 'Net 45' },
                      { value: 'NET60', label: 'Net 60' },
                    ].map((term) => (
                      <label
                        key={term.value}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                          form.creditTermsOffered.includes(term.value) 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-cream-grey hover:border-orange-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.creditTermsOffered.includes(term.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, creditTermsOffered: [...form.creditTermsOffered, term.value] })
                            } else {
                              setForm({ ...form, creditTermsOffered: form.creditTermsOffered.filter(t => t !== term.value) })
                            }
                          }}
                          className="w-4 h-4 text-orange-600 border-cream-grey rounded"
                        />
                        <span className="text-sm font-medium">{term.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.creditTermsOffered && <p className="text-xs text-status-error mt-1">{errors.creditTermsOffered}</p>}
                </div>
                
                {/* Delivery Methods */}
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-2">
                    Delivery Methods <span className="text-text-dark/40 text-xs">Optional</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'own-fleet', label: 'Own Fleet' },
                      { value: 'third-party', label: '3rd Party Courier' },
                      { value: 'pickup', label: 'Customer Pickup' },
                    ].map((method) => (
                      <label
                        key={method.value}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                          form.deliveryMethods.includes(method.value) 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-cream-grey hover:border-orange-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.deliveryMethods.includes(method.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, deliveryMethods: [...form.deliveryMethods, method.value] })
                            } else {
                              setForm({ ...form, deliveryMethods: form.deliveryMethods.filter(m => m !== method.value) })
                            }
                          }}
                          className="w-4 h-4 text-orange-600 border-cream-grey rounded"
                        />
                        <span className="text-sm">{method.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Contact Person - Common for both */}
            <div className="pt-4 border-t border-cream-grey space-y-4">
              <h4 className="text-sm font-semibold text-text-dark/70 uppercase tracking-wide">
                Contact Person
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">
                    Name <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.contactPersonName}
                    onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })}
                    className={`input-field ${errors.contactPersonName ? 'border-status-error' : ''}`}
                  />
                  {errors.contactPersonName && <p className="text-xs text-status-error mt-1">{errors.contactPersonName}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">
                    Phone <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.contactPersonPhone}
                    onChange={(e) => setForm({ ...form, contactPersonPhone: formatPhoneNumber(e.target.value) })}
                    className={`input-field ${errors.contactPersonPhone ? 'border-status-error' : ''}`}
                  />
                  {errors.contactPersonPhone && <p className="text-xs text-status-error mt-1">{errors.contactPersonPhone}</p>}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-dark mb-1">
                  Email <span className="text-text-dark/40 text-xs">Optional</span>
                </label>
                <input
                  type="email"
                  value={form.contactPersonEmail}
                  onChange={(e) => setForm({ ...form, contactPersonEmail: e.target.value })}
                  placeholder="contact@business.com"
                  className="input-field"
                />
              </div>
            </div>
            
            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{errors.submit}</p>
              </div>
            )}
            
            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-semibold text-white shadow-lg transition-all ${
                  isBuyer 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' 
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                } disabled:opacity-50`}
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                Complete Registration
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}



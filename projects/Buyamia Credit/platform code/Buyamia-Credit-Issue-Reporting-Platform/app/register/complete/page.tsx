'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, ArrowRight } from 'lucide-react'

export default function CompleteProfilePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const userType = searchParams.get('type') || 'buyer'
  
  // Buyer form state
  const [buyerForm, setBuyerForm] = useState({
    ownerName: '',
    averagePurchaseVolume: '',
    orderFrequency: '',
    preferredPaymentTerms: '',
    yearsInOperation: '',
  })
  
  // Supplier form state
  const [supplierForm, setSupplierForm] = useState({
    regionsServed: '',
    averageSupplyCapacity: '',
    creditTermsOffered: '',
    yearsInOperation: '',
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [skipProfile, setSkipProfile] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // TODO: API call to complete profile
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    router.push('/dashboard')
  }
  
  const handleSkip = () => {
    setSkipProfile(true)
    router.push('/dashboard')
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-white to-cream-beige flex items-center justify-center py-12 px-4">
      <div className="max-w-2xl w-full">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-status-success/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-status-success" />
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-green/10 flex items-center justify-center">
              <span className="text-primary-green font-bold text-sm">2</span>
            </div>
            <h1 className="text-2xl font-bold text-text-dark">
              Step 2: Complete Your Profile
            </h1>
          </div>
          <p className="text-text-dark/60 text-sm ml-18">
            Help us calculate your credit score and risk profile. This information is optional but recommended.
          </p>
        </div>
        
        <div className="card">
          {userType === 'buyer' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="ownerName" className="block text-sm font-medium text-text-dark mb-2">
                  Owner / Person in Charge Name
                </label>
                <input
                  type="text"
                  id="ownerName"
                  value={buyerForm.ownerName}
                  onChange={(e) => setBuyerForm({ ...buyerForm, ownerName: e.target.value })}
                  placeholder="John Doe"
                  className="input-field"
                />
                <p className="text-xs text-text-dark/60 mt-1">For accountability and verification</p>
              </div>
              
              <div>
                <label htmlFor="averagePurchaseVolume" className="block text-sm font-medium text-text-dark mb-2">
                  Average Monthly Purchase Volume
                </label>
                <select
                  id="averagePurchaseVolume"
                  value={buyerForm.averagePurchaseVolume}
                  onChange={(e) => setBuyerForm({ ...buyerForm, averagePurchaseVolume: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select range</option>
                  <option value="<5M">Less than 5M IDR</option>
                  <option value="5-20M">5M - 20M IDR</option>
                  <option value="20-50M">20M - 50M IDR</option>
                  <option value="50M+">50M+ IDR</option>
                </select>
                <p className="text-xs text-text-dark/60 mt-1">Helps suppliers set appropriate credit limits</p>
              </div>
              
              <div>
                <label htmlFor="orderFrequency" className="block text-sm font-medium text-text-dark mb-2">
                  Average Order Frequency
                </label>
                <select
                  id="orderFrequency"
                  value={buyerForm.orderFrequency}
                  onChange={(e) => setBuyerForm({ ...buyerForm, orderFrequency: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select frequency</option>
                  <option value="daily">Daily</option>
                  <option value="2-3x-week">2-3 times per week</option>
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="preferredPaymentTerms" className="block text-sm font-medium text-text-dark mb-2">
                  Preferred Payment Terms
                </label>
                <select
                  id="preferredPaymentTerms"
                  value={buyerForm.preferredPaymentTerms}
                  onChange={(e) => setBuyerForm({ ...buyerForm, preferredPaymentTerms: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select payment terms</option>
                  <option value="COD">Cash on Delivery (COD)</option>
                  <option value="NET7">Net 7 days</option>
                  <option value="NET14">Net 14 days</option>
                  <option value="NET30">Net 30 days</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="yearsInOperation" className="block text-sm font-medium text-text-dark mb-2">
                  Years in Operation
                </label>
                <input
                  type="number"
                  id="yearsInOperation"
                  min="0"
                  max="100"
                  value={buyerForm.yearsInOperation}
                  onChange={(e) => setBuyerForm({ ...buyerForm, yearsInOperation: e.target.value })}
                  placeholder="e.g., 5"
                  className="input-field"
                />
                <p className="text-xs text-text-dark/60 mt-1">Older businesses typically have lower risk</p>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Complete Profile'}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="btn-secondary"
                >
                  Skip for Now
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="regionsServed" className="block text-sm font-medium text-text-dark mb-2">
                  Regions Served
                </label>
                <input
                  type="text"
                  id="regionsServed"
                  value={supplierForm.regionsServed}
                  onChange={(e) => setSupplierForm({ ...supplierForm, regionsServed: e.target.value })}
                  placeholder="Jakarta, Bandung, Surabaya"
                  className="input-field"
                />
                <p className="text-xs text-text-dark/60 mt-1">Comma-separated list of cities/regions</p>
              </div>
              
              <div>
                <label htmlFor="averageSupplyCapacity" className="block text-sm font-medium text-text-dark mb-2">
                  Average Monthly Supply Capacity
                </label>
                <select
                  id="averageSupplyCapacity"
                  value={supplierForm.averageSupplyCapacity}
                  onChange={(e) => setSupplierForm({ ...supplierForm, averageSupplyCapacity: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select capacity</option>
                  <option value="<50M">Less than 50M IDR</option>
                  <option value="50-200M">50M - 200M IDR</option>
                  <option value="200-500M">200M - 500M IDR</option>
                  <option value="500M+">500M+ IDR</option>
                </select>
                <p className="text-xs text-text-dark/60 mt-1">Helps detect unrealistic orders</p>
              </div>
              
              <div>
                <label htmlFor="creditTermsOffered" className="block text-sm font-medium text-text-dark mb-2">
                  Credit Terms Offered to Buyers
                </label>
                <select
                  id="creditTermsOffered"
                  value={supplierForm.creditTermsOffered}
                  onChange={(e) => setSupplierForm({ ...supplierForm, creditTermsOffered: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select credit terms</option>
                  <option value="COD">Cash on Delivery (COD)</option>
                  <option value="NET7">Net 7 days</option>
                  <option value="NET14">Net 14 days</option>
                  <option value="NET30">Net 30 days</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="yearsInOperation" className="block text-sm font-medium text-text-dark mb-2">
                  Years in Operation
                </label>
                <input
                  type="number"
                  id="yearsInOperation"
                  min="0"
                  max="100"
                  value={supplierForm.yearsInOperation}
                  onChange={(e) => setSupplierForm({ ...supplierForm, yearsInOperation: e.target.value })}
                  placeholder="e.g., 10"
                  className="input-field"
                />
                <p className="text-xs text-text-dark/60 mt-1">Critical for platform stability assessment</p>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Complete Profile'}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="btn-secondary"
                >
                  Skip for Now
                </button>
              </div>
            </form>
          )}
          
          <div className="mt-6 pt-6 border-t border-cream-grey">
            <Link 
              href="/dashboard" 
              className="text-sm text-primary-green hover:underline flex items-center gap-1"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}


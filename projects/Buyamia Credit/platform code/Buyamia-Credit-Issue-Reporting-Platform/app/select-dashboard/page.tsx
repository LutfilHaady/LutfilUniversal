'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag, Package, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function SelectDashboardPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const t = translations[language]
  const [isLoading, setIsLoading] = useState<string | null>(null)

  // Note: We no longer auto-redirect based on previous selection
  // Users should always see this page when clicking "Login" from home

  const handleSelectDashboard = (userType: 'BUYER' | 'SUPPLIER') => {
    setIsLoading(userType)
    
    // Store the selected userType preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedUserType', userType)
      
      // If we have a userId preference, set a default one for testing
      // In production, this would come from the authenticated user's accounts
      if (!localStorage.getItem('userId')) {
        // Set a default userId based on selection for demo purposes
        const defaultUserId = userType === 'BUYER' ? 'BJ9436' : 'SP0023'
        localStorage.setItem('userId', defaultUserId)
      }
    }
    
    // Redirect to dashboard
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-white via-cream-beige to-cream-white flex items-center justify-center py-12 px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-green/5 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-olive/5 rounded-full blur-3xl -z-10"></div>
      
      {/* Language Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>
      
      <div className="max-w-4xl w-full relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-primary-green hover:text-primary-olive transition-colors mb-6 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </Link>
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-text-dark mb-3">
            Welcome to Buyamia Credit
          </h1>
          <p className="text-lg text-text-dark/70">
            Choose which dashboard you'd like to access
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Buyer Dashboard Option */}
          <button
            onClick={() => handleSelectDashboard('BUYER')}
            disabled={isLoading !== null}
            className="card-elevated p-8 text-left hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-green to-primary-olive flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                <ShoppingBag className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-text-dark mb-1">
                  Buyer Dashboard
                </h2>
                <p className="text-sm text-text-dark/60">
                  Manage your purchases and payments
                </p>
              </div>
              <ArrowRight className="w-6 h-6 text-primary-green opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <ul className="space-y-2 text-sm text-text-dark/70 mb-6">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-green"></div>
                View your invoices and payment history
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-green"></div>
                Track your credit score and reputation
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-green"></div>
                Manage supplier relationships
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-green"></div>
                Report issues with orders
              </li>
            </ul>
            
            <div className="pt-4 border-t border-cream-grey">
              <span className="text-xs text-text-dark/50">
                Access as a buyer to manage your credit and payments
              </span>
            </div>
          </button>

          {/* Supplier Dashboard Option */}
          <button
            onClick={() => handleSelectDashboard('SUPPLIER')}
            disabled={isLoading !== null}
            className="card-elevated p-8 text-left hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-olive to-primary-green flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-text-dark mb-1">
                  Supplier Dashboard
                </h2>
                <p className="text-sm text-text-dark/60">
                  Manage your sales and collections
                </p>
              </div>
              <ArrowRight className="w-6 h-6 text-primary-olive opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <ul className="space-y-2 text-sm text-text-dark/70 mb-6">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-olive"></div>
                Create and manage invoices
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-olive"></div>
                Track receivables and collections
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-olive"></div>
                Monitor buyer credit scores
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-olive"></div>
                Manage buyer registry
              </li>
            </ul>
            
            <div className="pt-4 border-t border-cream-grey">
              <span className="text-xs text-text-dark/50">
                Access as a supplier to manage your sales and credit risk
              </span>
            </div>
          </button>
        </div>

        {isLoading && (
          <div className="mt-6 text-center">
            <p className="text-sm text-text-dark/60">
              Loading {isLoading === 'BUYER' ? 'Buyer' : 'Supplier'} Dashboard...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}


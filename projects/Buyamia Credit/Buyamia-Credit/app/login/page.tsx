'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LogIn, ExternalLink } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function LoginPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const t = translations[language].login

  // Get callback URL for Buyamia redirect
  const getCallbackUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/auth/buyamia-callback`
    }
    return '/api/auth/buyamia-callback'
  }

  // Redirect to Buyamia login with CSRF protection
  const handleContinueWithBuyamia = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      // Get redirect destination from URL params or default
      const urlParams = new URLSearchParams(window.location.search)
      const redirectTo = urlParams.get('redirect') || '/select-dashboard'
      
      // Generate state token from server
      const response = await fetch(`/api/auth/generate-state?redirectTo=${encodeURIComponent(redirectTo)}`)
      const data = await response.json()
      
      if (!data.state) {
        throw new Error('Failed to generate state token')
      }
      
      // Build callback URL with state parameter
      const callbackUrl = `${getCallbackUrl()}?state=${data.state}`
      const buyamiaLoginUrl = `https://buyamia.com/login?redirect_to=${encodeURIComponent(callbackUrl)}`
      
      // Force redirect - don't let anything intercept
      window.location.href = buyamiaLoginUrl
    } catch (error) {
      console.error('Error generating state token:', error)
      // Fallback: redirect without state (less secure but functional)
      const callbackUrl = getCallbackUrl()
      const buyamiaLoginUrl = `https://buyamia.com/login?redirect_to=${encodeURIComponent(callbackUrl)}`
      window.location.href = buyamiaLoginUrl
    }
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
      
      <div className="max-w-md w-full relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-primary-green hover:text-primary-olive transition-colors mb-6 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">{t.backToHome}</span>
        </Link>
        
        <div className="card-elevated backdrop-blur-sm">
          {/* Header */}
          <div className="mb-8 pb-6 border-b-2 border-cream-beige">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-green to-primary-olive flex items-center justify-center shadow-lg">
                <LogIn className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-text-dark leading-tight">
                  Welcome to Buyamia Credit
                </h1>
                <p className="text-text-dark/60 text-sm mt-1">
                  Sign in with your Buyamia account to continue
                </p>
              </div>
            </div>
          </div>
          
          {/* Continue with Buyamia Button */}
          <div className="space-y-4">
            <button
              onClick={handleContinueWithBuyamia}
              className="w-full btn-primary flex items-center justify-center gap-3 py-4 text-lg font-semibold group"
            >
              <LogIn className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              Continue with Buyamia
              <ExternalLink className="w-5 h-5 opacity-70" />
            </button>
            
            <p className="text-xs text-text-dark/50 text-center">
              You'll be redirected to Buyamia to sign in or create an account
            </p>
            
            {/* Note for users already logged in */}
            <div className="mt-4 p-3 bg-primary-green/5 border border-primary-green/20 rounded-lg">
              <p className="text-xs text-text-dark/70 text-center">
                <strong>Already logged into Buyamia?</strong> After logging in, Buyamia should redirect you back automatically. 
                If you see "You are already logged in" on Buyamia, please contact support as the redirect feature is being set up.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

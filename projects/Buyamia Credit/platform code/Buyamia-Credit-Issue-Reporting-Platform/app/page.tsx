'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Package, TrendingUp, Shield, Clock, Users, ArrowRight, CheckCircle2, Sparkles, LogIn } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function Home() {
  const router = useRouter()
  const { language } = useLanguage()
  const t = translations[language].landing
  return (
    <div className="min-h-screen bg-cream-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-primary-green/10 to-primary-olive/5 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-primary-olive/10 to-primary-green/5 rounded-full blur-3xl -z-10"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-primary-green/5 to-primary-olive/5 rounded-full blur-3xl -z-10"></div>
      
      {/* Language Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle />
      </div>
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-green/10 to-primary-olive/10 rounded-full border border-primary-green/20 mb-6">
              <Shield className="w-4 h-4 text-primary-green" />
              <span className="text-sm font-medium text-primary-green">{t.badge}</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary-green via-primary-olive to-primary-green bg-clip-text text-transparent leading-[1.1] pb-2">
              {t.title}
            </h1>
            
            <p className="text-xl md:text-2xl text-text-dark/70 mb-4 max-w-3xl mx-auto leading-relaxed">
              {t.subtitle}
            </p>
            
            <p className="text-base text-text-dark/60 max-w-2xl mx-auto mb-8">
              {t.description}
            </p>
            
            {/* Primary CTA - Continue with Buyamia and Login Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link 
                href="/login" 
                className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-green to-primary-olive text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-lg">Continue with Buyamia</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                onClick={() => {
                  // Clear any previous selection to show the dashboard choice
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('selectedUserType')
                    localStorage.removeItem('userId')
                  }
                  router.push('/select-dashboard')
                }}
                className="group inline-flex items-center gap-3 px-8 py-4 bg-white border-2 border-primary-green text-primary-green font-semibold rounded-xl shadow-lg hover:shadow-xl hover:bg-primary-green/5 transition-all duration-300 transform hover:scale-105"
              >
                <LogIn className="w-5 h-5" />
                <span className="text-lg">Login</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
            <p className="text-sm text-text-dark/50">
              Use your existing Buyamia marketplace account to get started instantly
            </p>
          </div>
          
          {/* Info Cards - What you get */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {/* Buyer Benefits */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-cream-grey/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-green/20 to-primary-olive/10 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-primary-green" />
                </div>
                <div>
                  <h3 className="font-bold text-text-dark">{t.buyerTitle}</h3>
                  <p className="text-sm text-text-dark/60">For businesses buying on Buyamia</p>
                </div>
              </div>
              <div className="space-y-2">
                {t.buyerFeatures.map((feature: string) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-text-dark/70">
                    <CheckCircle2 className="w-4 h-4 text-primary-green flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Supplier Benefits */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-cream-grey/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-olive/20 to-primary-green/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-primary-olive" />
                </div>
                <div>
                  <h3 className="font-bold text-text-dark">{t.supplierTitle}</h3>
                  <p className="text-sm text-text-dark/60">For sellers on Buyamia marketplace</p>
                </div>
              </div>
              <div className="space-y-2">
                {t.supplierFeatures.map((feature: string) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-text-dark/70">
                    <CheckCircle2 className="w-4 h-4 text-primary-olive flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Features Section */}
          <div className="mb-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-text-dark mb-3">
              {t.whyChoose}
            </h2>
            <p className="text-lg text-text-dark/60 max-w-2xl mx-auto">
              {t.whyChooseDesc}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-green/20 to-primary-olive/20 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary-green" />
              </div>
              <h3 className="font-semibold text-text-dark mb-2">{t.creditScoring}</h3>
              <p className="text-sm text-text-dark/60">{t.creditScoringDesc}</p>
            </div>
            
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-olive/20 to-primary-green/20 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-primary-olive" />
              </div>
              <h3 className="font-semibold text-text-dark mb-2">{t.automatedReminders}</h3>
              <p className="text-sm text-text-dark/60">{t.automatedRemindersDesc}</p>
            </div>
            
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-green/20 to-primary-olive/20 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary-green" />
              </div>
              <h3 className="font-semibold text-text-dark mb-2">{t.trustNetwork}</h3>
              <p className="text-sm text-text-dark/60">{t.trustNetworkDesc}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

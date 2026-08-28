'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LanguageToggle } from './LanguageToggle'
import { LogOut } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'

interface NavbarProps {
  userId?: string
  userType?: 'BUYER' | 'SUPPLIER'
}

export default function Navbar({ userId, userType }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { language } = useLanguage()
  const t = translations[language].navbar
  
  const navItems = [
    { href: '/dashboard', label: t.dashboard },
    ...(userType === 'SUPPLIER' ? [{ href: '/buyer-registry', label: t.buyerRegistry }] : []),
    { href: '/invoices', label: t.invoices },
    { href: '/issues', label: t.issues },
    { href: '/search', label: t.search },
    { href: '/risk-monitor', label: t.riskMonitor },
    ...(userType === 'SUPPLIER' ? [{ href: '/collections', label: t.collections }] : []),
    { href: '/profile', label: t.profile },
  ]
  
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include' // Important: send cookies
      })
      
      if (!response.ok) {
        console.error('Logout API error:', response.status)
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
    
    // Clear session/localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('session')
      sessionStorage.clear()
    }
    
    // Force redirect to login
    window.location.href = '/login'
  }
  
  return (
    <nav className="bg-white shadow-soft border-b border-cream-grey">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold text-primary-green">
              Buyamia Credit
            </Link>
            
            {/* Language Toggle on the right of Buyamia Credit */}
            <LanguageToggle />
          </div>
          
          <div className="flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'text-primary-green'
                    : 'text-text-dark/60 hover:text-primary-green'
                }`}
              >
                {item.label}
              </Link>
            ))}
            
            {userId && (
              <div className="px-3 py-1 bg-primary-green/10 text-primary-green rounded-button text-sm font-medium">
                {userId}
              </div>
            )}
            
            {/* Logout button on the right of User ID */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-dark/70 hover:text-status-error transition-colors rounded-button hover:bg-cream-beige/50"
              title={t.logout}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t.logout}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}


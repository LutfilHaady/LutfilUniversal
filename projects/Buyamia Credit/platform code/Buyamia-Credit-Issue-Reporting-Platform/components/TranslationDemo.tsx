'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'

export default function TranslationDemo() {
  const { language } = useLanguage()
  const t = translations[language]

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Translation Demo ({language})</h3>
      
      <div className="space-y-3">
        <div>
          <span className="font-medium">Navigation:</span>
          <ul className="ml-4 mt-1 space-y-1">
            <li>• Dashboard: {t.navbar.dashboard}</li>
            <li>• Invoices: {t.navbar.invoices}</li>
            <li>• Search: {t.navbar.search}</li>
            <li>• Profile: {t.navbar.profile}</li>
            <li>• Logout: {t.navbar.logout}</li>
          </ul>
        </div>
        
        <div>
          <span className="font-medium">Landing Page:</span>
          <ul className="ml-4 mt-1 space-y-1">
            <li>• Title: {t.landing.title}</li>
            <li>• Subtitle: {t.landing.subtitle}</li>
            <li>• Badge: {t.landing.badge}</li>
            <li>• Login Here: {t.landing.loginHere}</li>
          </ul>
        </div>
        
        <div>
          <span className="font-medium">Registration:</span>
          <ul className="ml-4 mt-1 space-y-1">
            <li>• Create Account: {t.register.createAccount}</li>
            <li>• Business Name: {t.register.businessName}</li>
            <li>• Phone Number: {t.register.phoneNumber}</li>
            <li>• All Fields Required: {t.register.allFieldsRequired}</li>
          </ul>
        </div>
        
        <div>
          <span className="font-medium">Dashboard:</span>
          <ul className="ml-4 mt-1 space-y-1">
            <li>• Welcome Back: {t.dashboard.welcomeBack}</li>
            <li>• Credit Score: {t.dashboard.creditScore}</li>
            <li>• View All: {t.dashboard.viewAll}</li>
            <li>• Amount: {t.dashboard.amount}</li>
          </ul>
        </div>
        
        <div>
          <span className="font-medium">Collections:</span>
          <ul className="ml-4 mt-1 space-y-1">
            <li>• Title: {t.collections.title}</li>
            <li>• Statistics: {t.collections.statistics}</li>
            <li>• Active Collections: {t.collections.activeCollections}</li>
            <li>• View Details: {t.collections.viewDetails}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

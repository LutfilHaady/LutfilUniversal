import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import { LanguageProvider } from '@/contexts/LanguageContext'
import dynamic from 'next/dynamic'

const AuthenticatedChatbot = dynamic(() => import('@/components/AuthenticatedChatbot'), {
  ssr: false,
})

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Buyamia Credit & Issue Management Platform',
  description: 'B2B Credit, Issue Reporting, and Payment Reminder System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider>
          {children}
          <AuthenticatedChatbot />
        </LanguageProvider>
      </body>
    </html>
  )
}


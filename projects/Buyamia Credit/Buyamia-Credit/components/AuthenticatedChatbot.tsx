'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

const ChatbotWidget = dynamic(() => import('@/components/ChatbotWidget'), {
  ssr: false,
})

export default function AuthenticatedChatbot() {
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userInfo, setUserInfo] = useState<{ userId?: string; userType?: string } | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true)
        
        // Check development mode first
        if (typeof window !== 'undefined' && localStorage.getItem('devAuthenticated') === 'true') {
          const userId = localStorage.getItem('userId') || undefined
          const userType = localStorage.getItem('selectedUserType') || undefined
          
          console.log('[Chatbot] Dev mode authenticated:', { userId, userType })
          setIsAuthenticated(true)
          setUserInfo({ userId, userType: userType as string })
          setIsLoading(false)
          return
        }

        // Otherwise check API
        const response = await fetch('/api/auth/me', { credentials: 'include' })
        
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            console.log('[Chatbot] API authenticated:', { userId: data.user.userId, userType: data.user.type })
            setIsAuthenticated(true)
            setUserInfo({
              userId: data.user.userId,
              userType: data.user.type,
            })
          } else {
            console.log('[Chatbot] API returned no user')
            setIsAuthenticated(false)
            setUserInfo(null)
          }
        } else {
          console.log('[Chatbot] API auth failed:', response.status, response.statusText)
          setIsAuthenticated(false)
          setUserInfo(null)
        }
      } catch (error) {
        console.error('[Chatbot] Auth check error:', error)
        setIsAuthenticated(false)
        setUserInfo(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Show widget even if not authenticated - it will handle errors when sending messages
  // This ensures the widget is always visible for better UX
  if (isLoading) {
    // Don't show during initial load to avoid flash
    return null
  }

  return (
    <ChatbotWidget
      currentPage={pathname}
      userId={userInfo?.userId}
      userType={userInfo?.userType as 'BUYER' | 'SUPPLIER' | undefined}
    />
  )
}


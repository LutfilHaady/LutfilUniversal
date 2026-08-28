'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LiveKitRoom,
  useChat,
  useConnectionState,
  useRoomContext,
} from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
import {
  Bot,
  Send,
  Loader2,
  ArrowLeft,
  Sparkles,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  FileText,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { getUserTypeFromUserId } from '@/lib/utils'

// Chat message component
function ChatMessage({ message, isBot }: { message: { content: string; timestamp: Date }; isBot: boolean }) {
  return (
    <div className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isBot
            ? 'bg-gradient-to-br from-primary-green to-primary-olive'
            : 'bg-gradient-to-br from-blue-500 to-blue-600'
        }`}
      >
        {isBot ? (
          <Bot className="w-4 h-4 text-white" />
        ) : (
          <span className="text-white text-xs font-bold">You</span>
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isBot
            ? 'bg-white border border-gray-200 text-gray-800'
            : 'bg-gradient-to-r from-primary-green to-primary-olive text-white'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-xs mt-1 ${isBot ? 'text-gray-400' : 'text-white/70'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// Chat interface component
function ChatInterface() {
  const { chatMessages, send, isSending } = useChat()
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const connectionState = useConnectionState()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages, scrollToBottom])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isSending) return

    await send(inputValue.trim())
    setInputValue('')
  }

  const isConnected = connectionState === ConnectionState.Connected

  // Quick action buttons
  const quickActions = [
    { icon: TrendingUp, label: 'Dashboard Summary', query: 'Show me my dashboard summary' },
    { icon: FileText, label: 'Overdue Invoices', query: 'Which invoices are overdue?' },
    { icon: Users, label: 'High Risk Buyers', query: 'Which buyers are high risk?' },
    { icon: AlertTriangle, label: 'Collection Stats', query: 'How are my collections performing?' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-green to-primary-olive flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Buyamia Credit Assistant
            </h3>
            <p className="text-gray-500 text-sm mb-6 max-w-md">
              I can help you understand your invoices, check buyer credit scores, 
              review collection status, and analyze your portfolio risk.
            </p>
            
            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setInputValue(action.query)
                  }}
                  disabled={!isConnected}
                  className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 
                           border border-gray-200 transition-colors text-left disabled:opacity-50"
                >
                  <action.icon className="w-4 h-4 text-primary-green" />
                  <span className="text-sm text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((msg, idx) => (
              <ChatMessage
                key={idx}
                message={{
                  content: msg.message,
                  timestamp: new Date(msg.timestamp),
                }}
                isBot={msg.from?.identity === 'agent'}
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isConnected ? "Ask about your credit data..." : "Connecting..."}
            disabled={!isConnected || isSending}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-green 
                     focus:ring-2 focus:ring-primary-green/20 outline-none transition-all
                     disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={!isConnected || isSending || !inputValue.trim()}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-primary-green to-primary-olive 
                     text-white font-medium hover:opacity-90 transition-opacity
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
        
        {/* Connection status */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
            }`}
          />
          <span className="text-xs text-gray-400">
            {isConnected ? 'Connected to AI Assistant' : 'Connecting...'}
          </span>
        </div>
      </div>
    </div>
  )
}

// Main page component
export default function AIAssistantPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('SP0023')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        setUserId(storedUserId)
      }
    }
  }, [])

  const userType = getUserTypeFromUserId(userId)

  // Generate room name and fetch token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const roomName = `buyamia-credit-${userId}-${Date.now()}`
        
        const response = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            participantName: userId,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to get connection token')
        }

        const data = await response.json()
        setToken(data.token)
        setLivekitUrl(data.url)
      } catch (err) {
        console.error('Error fetching token:', err)
        setError(err instanceof Error ? err.message : 'Failed to connect')
      } finally {
        setIsLoading(false)
      }
    }

    fetchToken()
  }, [userId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-300" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-green to-primary-olive flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Enterprise Data Assistant</h1>
                  <p className="text-xs text-gray-400">Buyamia Credit AI</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Logged in as</span>
              <span className="px-3 py-1 rounded-full bg-primary-green/20 text-primary-green text-sm font-medium">
                {userId}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Chat container */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden h-[calc(100vh-180px)]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-primary-green animate-spin mb-4" />
                <p className="text-gray-500">Connecting to AI Assistant...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full px-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Connection Error</h3>
                <p className="text-gray-500 text-sm text-center mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-lg bg-primary-green text-white font-medium hover:opacity-90"
                >
                  Try Again
                </button>
              </div>
            ) : token && livekitUrl ? (
              <LiveKitRoom
                token={token}
                serverUrl={livekitUrl}
                connect={true}
                audio={false}
                video={false}
                data-lk-theme="default"
              >
                <ChatInterface />
              </LiveKitRoom>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-gray-500">Unable to initialize chat</p>
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="mt-4 text-center">
            <p className="text-gray-500 text-xs">
              Powered by GPT-4 • Your data is processed securely
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

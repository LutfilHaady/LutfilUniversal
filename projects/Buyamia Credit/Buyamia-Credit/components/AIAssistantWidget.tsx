'use client'

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import dynamic from 'next/dynamic';

// Lazy load heavy LiveKit components
const LiveKitRoom = dynamic(
  () => import('@livekit/components-react').then((mod) => mod.LiveKitRoom),
  { ssr: false }
);

// Lazy load icons
const Bot = dynamic(() => import('lucide-react').then(mod => mod.Bot));
const Send = dynamic(() => import('lucide-react').then(mod => mod.Send));
const Loader2 = dynamic(() => import('lucide-react').then(mod => mod.Loader2));
const X = dynamic(() => import('lucide-react').then(mod => mod.X));
const Maximize2 = dynamic(() => import('lucide-react').then(mod => mod.Maximize2));
const Minimize2 = dynamic(() => import('lucide-react').then(mod => mod.Minimize2));
const Sparkles = dynamic(() => import('lucide-react').then(mod => mod.Sparkles));
const MessageSquare = dynamic(() => import('lucide-react').then(mod => mod.MessageSquare));
const AlertTriangle = dynamic(() => import('lucide-react').then(mod => mod.AlertTriangle));
const FileText = dynamic(() => import('lucide-react').then(mod => mod.FileText));
const Users = dynamic(() => import('lucide-react').then(mod => mod.Users));
const Wifi = dynamic(() => import('lucide-react').then(mod => mod.Wifi));
const TrendingUp = dynamic(() => import('lucide-react').then(mod => mod.TrendingUp));

// These will be imported dynamically when the component mounts
let useChat: any;
let useConnectionState: any;
let useDataChannel: any;
let ConnectionState: any;

// Load LiveKit hooks on client side only
if (typeof window !== 'undefined') {
  import('@livekit/components-react').then((mod) => {
    useChat = mod.useChat;
    useConnectionState = mod.useConnectionState;
    useDataChannel = mod.useDataChannel;
  });
  
  import('livekit-client').then((mod) => {
    ConnectionState = mod.ConnectionState;
  });
}

// Widget states
type WidgetState = 'closed' | 'welcome' | 'connecting' | 'chat'

// Chat message type
interface ChatMessageType {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: Date
}

// Chat message component
function ChatMessage({ message }: { message: ChatMessageType }) {
  const isBot = message.sender === 'assistant'
  
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

// Chat interface inside LiveKit room
function ChatInterface({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const connectionState = useConnectionState()
  
  // Use data channel for communication
  const { send, message: receivedMessage } = useDataChannel('chat')

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Handle received messages from agent
  useEffect(() => {
    if (receivedMessage) {
      const content = new TextDecoder().decode(receivedMessage.payload)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content,
        sender: 'assistant',
        timestamp: new Date(),
      }])
      setIsSending(false)
    }
  }, [receivedMessage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isSending) return

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, userMessage])
    setIsSending(true)
    
    // Send via data channel
    const encoder = new TextEncoder()
    send(encoder.encode(inputValue.trim()), { reliable: true })
    
    setInputValue('')
  }

  const isConnected = connectionState === ConnectionState.Connected

  // Quick action buttons
  const quickActions = [
    { icon: TrendingUp, label: 'Dashboard', query: 'Show me my dashboard summary' },
    { icon: FileText, label: 'Overdue', query: 'Which invoices are overdue?' },
    { icon: Users, label: 'Risk', query: 'Which buyers are high risk?' },
    { icon: AlertTriangle, label: 'Collections', query: 'How are my collections?' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-green to-primary-olive flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              How can I help you?
            </h3>
            <p className="text-gray-500 text-sm mb-6 max-w-xs">
              Ask me about invoices, credit scores, collections, or risk analysis.
            </p>
            
            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => setInputValue(action.query)}
                  disabled={!isConnected}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white hover:bg-gray-100 
                           border border-gray-200 transition-colors text-left disabled:opacity-50"
                >
                  <action.icon className="w-4 h-4 text-primary-green" />
                  <span className="text-xs text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isSending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-green to-primary-olive flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-3 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isConnected ? "Ask about your credit data..." : "Connecting..."}
            disabled={!isConnected || isSending}
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-green 
                     focus:ring-2 focus:ring-primary-green/20 outline-none transition-all text-sm
                     disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={!isConnected || isSending || !inputValue.trim()}
            className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-primary-green to-primary-olive 
                     text-white font-medium hover:opacity-90 transition-opacity
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

// Main widget component
export default function AIAssistantWidget() {
  const [widgetState, setWidgetState] = useState<WidgetState>('closed')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('SP0023')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        setUserId(storedUserId)
      }
    }
  }, [])

  // Handle connect button click
  const handleConnect = async () => {
    setWidgetState('connecting')
    
    try {
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
      setWidgetState('chat')
    } catch (err) {
      console.error('Error connecting:', err)
      setWidgetState('welcome')
    }
  }

  // Close widget
  const handleClose = () => {
    setWidgetState('closed')
    setToken(null)
    setLivekitUrl(null)
    setIsFullscreen(false)
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // Widget panel classes
  const panelClasses = isFullscreen
    ? 'fixed inset-0 z-50'
    : 'fixed bottom-20 right-4 w-[380px] h-[600px] z-50 rounded-2xl shadow-2xl overflow-hidden'

  return (
    <>
      {/* Floating launcher button */}
      {widgetState === 'closed' && (
        <button
          onClick={() => setWidgetState('welcome')}
          className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary-green to-primary-olive 
                   text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Widget panel */}
      {widgetState !== 'closed' && (
        <div className={panelClasses}>
          <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-green to-primary-olive px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Buyamia Credit AI</h3>
                  <p className="text-white/70 text-xs">
                    {widgetState === 'connecting' ? 'Connecting...' : 
                     widgetState === 'chat' ? 'Online' : 'Ready to help'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 text-white" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-white" />
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {/* Welcome screen */}
              {widgetState === 'welcome' && (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-gray-50 to-white">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-6 shadow-lg">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-2xl font-bold text-primary-green mb-2">
                    Hi, I'm Buyamia AI!
                  </h2>
                  <p className="text-lg text-gray-600 mb-8">
                    How can I assist you today?
                  </p>
                  
                  <p className="text-sm text-gray-500 mb-4">
                    Choose your preferred conversation mode
                  </p>
                  
                  {/* Connect button */}
                  <button
                    onClick={handleConnect}
                    className="w-full max-w-xs px-6 py-4 rounded-xl bg-gradient-to-r from-primary-green to-primary-olive 
                             text-white font-semibold text-base hover:opacity-90 transition-all
                             flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Connect with Text Input
                  </button>
                  
                  <p className="text-xs text-gray-400 mt-6 max-w-xs">
                    I can help with invoices, credit scores, collections, and risk analysis
                  </p>
                </div>
              )}

              {/* Connecting screen */}
              {widgetState === 'connecting' && (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-gray-50 to-white">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
                    <Wifi className="w-10 h-10 text-primary-green animate-pulse" />
                  </div>
                  
                  <p className="text-lg text-gray-600">
                    Connecting to room...
                  </p>
                  
                  <div className="mt-4">
                    <Loader2 className="w-6 h-6 text-primary-green animate-spin" />
                  </div>
                </div>
              )}

              {/* Chat screen */}
              {widgetState === 'chat' && token && livekitUrl && (
                <LiveKitRoom
                  token={token}
                  serverUrl={livekitUrl}
                  connect={true}
                  audio={false}
                  video={false}
                >
                  <ChatInterface onClose={handleClose} />
                </LiveKitRoom>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

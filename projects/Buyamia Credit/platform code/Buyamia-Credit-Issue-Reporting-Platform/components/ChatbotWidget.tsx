'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bot,
  Send,
  X,
  Minimize2,
  Maximize2,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react'
import { getUserTypeFromUserId } from '@/lib/utils'
import { getPageInfo, suggestNavigation, formatNavigationSuggestion, type UserType } from '@/lib/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  navigationAction?: {
    path: string
    label: string
  }
}

interface ChatbotWidgetProps {
  currentPage?: string
  userType?: UserType
  userId?: string
}

export default function ChatbotWidget({ currentPage, userType, userId }: ChatbotWidgetProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<string>('')
  const [currentPagePath, setCurrentPagePath] = useState<string>(pathname || currentPage || '/')
  const [detectedUserType, setDetectedUserType] = useState<UserType | undefined>(userType)
  const [detectedUserId, setDetectedUserId] = useState<string | undefined>(userId)
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null) // Track current blob URL to prevent stale closures
  const isTtsInProgressRef = useRef(false) // Prevent concurrent TTS calls
  const isRequestInProgressRef = useRef(false)
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isDetectingRef = useRef(false) // Flag to control VAD loop

  // Cleanup audio recording on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch (error) {
          console.error('Error stopping recorder on unmount:', error)
        }
        mediaRecorderRef.current = null
      }
      if (microphoneRef.current) {
        try {
          microphoneRef.current.disconnect()
        } catch (error) {
          console.error('Error disconnecting microphone on unmount:', error)
        }
        microphoneRef.current = null
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect()
        } catch (error) {
          console.error('Error disconnecting analyser on unmount:', error)
        }
        analyserRef.current = null
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close()
        } catch (error) {
          console.error('Error closing audio context on unmount:', error)
        }
        audioContextRef.current = null
      }
      isDetectingRef.current = false // Stop VAD loop
    }
  }, [])

  // Update current page when pathname changes
  useEffect(() => {
    setCurrentPagePath(pathname || '/')
  }, [pathname])

  // Detect user info from auth
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        // Check dev mode first
        if (typeof window !== 'undefined' && localStorage.getItem('devAuthenticated') === 'true') {
          const devUserId = localStorage.getItem('userId') || undefined
          const devUserType = localStorage.getItem('selectedUserType') || undefined
          setDetectedUserId(devUserId)
          setDetectedUserType(devUserType as UserType)
          return
        }
        
        const response = await fetch('/api/auth/me', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setDetectedUserId(data.user.userId)
            setDetectedUserType(data.user.type as UserType)
          }
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }
    fetchUserInfo()
  }, [userId, userType])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStreamingMessage, isThinking])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current && !isVoiceMode) {
      inputRef.current.focus()
    }
  }, [isOpen, isMinimized, isVoiceMode])

  // Format message content (convert *word* to bold)
  const formatMessage = (text: string) => {
    const parts = text.split(/(\*[^*]+\*)/g)
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <strong key={index}>{part.slice(1, -1)}</strong>
      }
      return <span key={index}>{part}</span>
    })
  }

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:177',message:'stopSpeaking called',data:{hasAudioRef:!!audioRef.current,audioRefState:audioRef.current?.src?.substring(0,50)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const currentAudio = audioRef.current
    const currentAudioUrl = audioUrlRef.current
    if (currentAudio) {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:180',message:'stopSpeaking: pausing audio',data:{audioSrc:currentAudio.src.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Remove event handlers to prevent them from firing
        currentAudio.onended = null
        currentAudio.onerror = null
        currentAudio.oncanplaythrough = null
        currentAudio.pause()
        currentAudio.currentTime = 0
      } catch (error) {
        console.error('Error stopping audio:', error)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:183',message:'stopSpeaking: error pausing',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:185',message:'stopSpeaking: cleaning up refs',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Clean up blob URL if it exists
      if (currentAudioUrl) {
        try {
          URL.revokeObjectURL(currentAudioUrl)
        } catch (e) {
          // Ignore if already revoked
        }
      }
      audioRef.current = null
      audioUrlRef.current = null
      setIsSpeaking(false)
    }
  }, [])

  // Handle TTS (Text-to-Speech) using OpenAI
  const handleTextToSpeech = useCallback(async (text: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:191',message:'handleTextToSpeech: entry',data:{textLength:text.length,hasAudioRef:!!audioRef.current,audioRefSrc:audioRef.current?.src?.substring(0,50)||null,isTtsInProgress:isTtsInProgressRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!text || !text.trim()) {
      console.warn('TTS: Empty text provided')
      return
    }

    // Prevent concurrent TTS calls
    if (isTtsInProgressRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:203',message:'handleTextToSpeech: concurrent call blocked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.warn('TTS: Another TTS call is in progress, skipping')
      return
    }

    isTtsInProgressRef.current = true

    // Stop any ongoing speech first - do this synchronously before starting new request
    const previousAudio = audioRef.current
    const previousAudioUrl = audioUrlRef.current
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:198',message:'handleTextToSpeech: checking previousAudio',data:{hasPreviousAudio:!!previousAudio,previousAudioSrc:previousAudio?.src?.substring(0,50)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (previousAudio) {
      try {
        // Remove event listeners to prevent conflicts
        previousAudio.onended = null
        previousAudio.onerror = null
        previousAudio.pause()
        previousAudio.currentTime = 0
        // Clean up previous blob URL
        if (previousAudioUrl) {
          try {
            URL.revokeObjectURL(previousAudioUrl)
          } catch (e) {
            // Ignore if already revoked
          }
        }
        // Clear the ref immediately
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:207',message:'handleTextToSpeech: setting audioRef to null before delay',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        audioRef.current = null
        audioUrlRef.current = null
        // Give browser a moment to clean up
        await new Promise(resolve => setTimeout(resolve, 100))
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:209',message:'handleTextToSpeech: after cleanup delay',data:{audioRefAfterDelay:''},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      } catch (error) {
        console.error('Error stopping previous audio:', error)
        audioRef.current = null
        audioUrlRef.current = null
      }
    }

    setIsSpeaking(true)
    console.log('TTS: Starting TTS request for text:', text.substring(0, 50) + '...')

    let audioUrl: string | null = null
    let audio: HTMLAudioElement | null = null

    try {
      // Call OpenAI TTS API
      const response = await fetch('/api/chatbot/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('TTS API error:', response.status, errorText)
        throw new Error(`TTS request failed: ${response.status}`)
      }

      // Get the audio blob
      const audioBlob = await response.blob()
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Empty audio blob received')
      }

      console.log('TTS: Audio blob received, size:', audioBlob.size)
      audioUrl = URL.createObjectURL(audioBlob)
      audioUrlRef.current = audioUrl // Store in ref for safe access in event handlers
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:243',message:'handleTextToSpeech: blob URL created',data:{audioUrl:audioUrl.substring(0,80),blobSize:audioBlob.size,audioRefBefore:audioRef.current?.src?.substring(0,50)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Create new audio element
      audio = new Audio(audioUrl)
      
      // Set the reference immediately
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:249',message:'handleTextToSpeech: setting audioRef to new audio',data:{newAudioSrc:audio.src.substring(0,50),audioRefBefore:audioRef.current?.src?.substring(0,50)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      audioRef.current = audio
      
      // Set up event handlers BEFORE attempting to play
      // Use refs to avoid stale closures
      audio.onended = () => {
        console.log('TTS: Audio playback ended')
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:252',message:'audio.onended: fired',data:{audioUrlFromRef:audioUrlRef.current?.substring(0,80)||null,audioRefMatches:audioRef.current===audio},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        setIsSpeaking(false)
        isTtsInProgressRef.current = false
        // Clean up after a short delay to ensure playback completed
        setTimeout(() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:256',message:'audio.onended: revoking blob URL',data:{audioUrlFromRef:audioUrlRef.current?.substring(0,80)||null,willRevoke:!!audioUrlRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          // Only cleanup if this is still the current audio
          if (audioRef.current === audio && audioUrlRef.current) {
            try {
              URL.revokeObjectURL(audioUrlRef.current)
            } catch (e) {
              // Ignore if already revoked
            }
            audioRef.current = null
            audioUrlRef.current = null
          }
        }, 100)
      }
      
      audio.onerror = (e: string | Event) => {
        console.error('TTS: Audio playback error', e)
        // #region agent log
        const errorEvent = typeof e === 'string' ? e : (e as any)
        fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:266',message:'audio.onerror: fired',data:{errorType:typeof errorEvent === 'string' ? 'string' : errorEvent?.type||'unknown',errorTarget:(typeof errorEvent === 'object' ? (errorEvent?.target as any)?.src?.substring(0,50)||'' : ''),audioUrlFromRef:audioUrlRef.current?.substring(0,80)||'',audioRefMatches:audioRef.current===audio},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        setIsSpeaking(false)
        isTtsInProgressRef.current = false
        // Don't revoke immediately on error - audio might still be loading
        setTimeout(() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:270',message:'audio.onerror: revoking blob URL after delay',data:{audioUrlFromRef:audioUrlRef.current?.substring(0,80)||null,willRevoke:!!audioUrlRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          // Only cleanup if this is still the current audio
          if (audioRef.current === audio && audioUrlRef.current) {
            try {
              URL.revokeObjectURL(audioUrlRef.current)
            } catch (e) {
              // Ignore if already revoked
            }
            audioRef.current = null
            audioUrlRef.current = null
          }
        }, 500)
      }

      // Wait for audio to be ready before playing
      audio.oncanplaythrough = () => {
        console.log('TTS: Audio ready to play')
      }

      // Try to play
      try {
        // Don't use await here - let it play asynchronously
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:285',message:'handleTextToSpeech: calling audio.play()',data:{audioUrl:audioUrl.substring(0,80),audioRefMatches:audioRef.current===audio,audioReadyState:audio.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('TTS: Audio playback started successfully')
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:291',message:'audio.play(): success',data:{audioUrl:audioUrl?.substring(0,80)||''},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
            })
            .catch((playError: any) => {
              console.error('TTS: Error starting playback:', playError)
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:294',message:'audio.play(): error',data:{errorName:playError?.name,errorMessage:playError?.message,audioUrl:audioUrl?.substring(0,80)||null,audioRefMatches:audioRef.current===audio},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              if (playError.name === 'NotAllowedError') {
                console.warn('TTS: Autoplay blocked - user interaction required')
              } else if (playError.name === 'AbortError') {
                console.warn('TTS: Playback aborted (likely interrupted)')
              }
              setIsSpeaking(false)
              isTtsInProgressRef.current = false
              setTimeout(() => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:302',message:'audio.play() error: revoking blob URL',data:{audioUrlFromRef:audioUrlRef.current?.substring(0,80)||null,willRevoke:!!audioUrlRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
                if (audioRef.current === audio && audioUrlRef.current) {
                  try {
                    URL.revokeObjectURL(audioUrlRef.current)
                  } catch (e) {
                    // Ignore if already revoked
                  }
                  audioRef.current = null
                  audioUrlRef.current = null
                }
              }, 100)
            })
        }
      } catch (playError: any) {
        console.error('TTS: Exception during play():', playError)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatbotWidget.tsx:312',message:'handleTextToSpeech: exception during play()',data:{errorName:playError?.name,errorMessage:playError?.message,audioUrlFromRef:audioUrlRef.current?.substring(0,80)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        setIsSpeaking(false)
        isTtsInProgressRef.current = false
        setTimeout(() => {
          if (audioRef.current === audio && audioUrlRef.current) {
            try {
              URL.revokeObjectURL(audioUrlRef.current)
            } catch (e) {
              // Ignore if already revoked
            }
            audioRef.current = null
            audioUrlRef.current = null
          }
        }, 100)
      }
    } catch (error) {
      console.error('TTS: Error with text-to-speech:', error)
      setIsSpeaking(false)
      isTtsInProgressRef.current = false
      // Clean up on error
      if (audioRef.current === audio && audioUrlRef.current) {
        try {
          URL.revokeObjectURL(audioUrlRef.current)
        } catch (e) {
          // Ignore if already revoked
        }
        audioRef.current = null
        audioUrlRef.current = null
      }
    }
  }, [])

  // Handle message send
  const handleSend = useCallback(async (text?: string, isVoiceMessage: boolean = false) => {
    const messageText = text || inputValue.trim()
    if (!messageText) return

    // Prevent duplicate requests
    if (isRequestInProgressRef.current) {
      return
    }

    // Clear any existing streaming interval
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current)
      streamIntervalRef.current = null
    }

    isRequestInProgressRef.current = true

    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setCurrentStreamingMessage('')
    setIsThinking(true)

    // Capture current conversation history BEFORE making API call (outside state setter)
    const currentHistory = conversationHistory
    
    // Update conversation history with user message (non-async state update)
    setConversationHistory((prev) => [...prev, { role: 'user', content: messageText }])
    
    // Make API call with current history
    // Include userId for dev mode fallback authentication
    const requestBody = {
      message: messageText,
      conversationHistory: currentHistory,
      currentPage: currentPagePath,
      userId: detectedUserId || userId, // Include userId for dev mode
    }
    
    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important: include cookies for auth
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      
      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Please log in to use the chatbot. If you\'re in dev mode, make sure you have devAuthenticated set in localStorage.')
        }
        if (response.status === 500) {
          console.error('Server error:', data.error || 'Unknown error')
          throw new Error(data.error || 'Server error occurred')
        }
        throw new Error(data.error || 'Failed to get response')
      }
      
      const assistantResponse = data.response || 'I apologize, but I could not generate a response.'

      // If voice message, start TTS generation IMMEDIATELY (before any streaming)
      // This allows the audio to start playing as fast as possible
      let ttsPromise: Promise<void> | null = null
      if (isVoiceMessage) {
        // Start TTS immediately - don't wait for anything
        ttsPromise = handleTextToSpeech(assistantResponse)
      }

      // For voice messages, skip streaming animation - show full text immediately
      // For text messages, show streaming effect
      if (isVoiceMessage) {
        // Voice mode: Show full text immediately while TTS plays
        setCurrentStreamingMessage('')
        setIsThinking(false)
        
        // Add complete message immediately
        const assistantMessage: Message = {
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date(),
        }

        // Check for navigation suggestions
        const pageInfo = currentPagePath ? getPageInfo(currentPagePath, detectedUserType || userType) : null
        if (pageInfo) {
          const suggestions = suggestNavigation(messageText, detectedUserType || userType || 'BUYER')
          if (suggestions.length > 0) {
            assistantMessage.navigationAction = {
              path: suggestions[0].path,
              label: formatNavigationSuggestion(suggestions[0]),
            }
          }
        }
        
        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1]
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === assistantResponse) {
            return prevMessages
          }
          return [...prevMessages, assistantMessage]
        })
        
        setConversationHistory((prevHist) => {
          const lastEntry = prevHist[prevHist.length - 1]
          if (lastEntry && lastEntry.role === 'assistant' && lastEntry.content === assistantResponse) {
            return prevHist
          }
          return [...prevHist, { role: 'assistant', content: assistantResponse }]
        })
        
        isRequestInProgressRef.current = false
      } else {
        // Text mode: Simulate streaming effect
        let currentIndex = 0
        
        // Clear any existing interval
        if (streamIntervalRef.current) {
          clearTimeout(streamIntervalRef.current)
        }
        
        // Fast typing animation for text mode
        const typingDelay = 10 // Fast typing speed
      
        // Use requestAnimationFrame for smoother animation (text mode only)
        const animateStream = () => {
          if (currentIndex < assistantResponse.length) {
            setCurrentStreamingMessage(assistantResponse.slice(0, currentIndex + 1))
            currentIndex++
            streamIntervalRef.current = setTimeout(animateStream, typingDelay) as any
          } else {
            // Animation complete - add message
            if (streamIntervalRef.current) {
              clearTimeout(streamIntervalRef.current)
              streamIntervalRef.current = null
            }
            
            // Add complete message (only once)
            const assistantMessage: Message = {
              role: 'assistant',
              content: assistantResponse,
              timestamp: new Date(),
            }

            // Check for navigation suggestions
            const pageInfo = currentPagePath ? getPageInfo(currentPagePath, detectedUserType || userType) : null
            if (pageInfo) {
              const suggestions = suggestNavigation(messageText, detectedUserType || userType || 'BUYER')
              if (suggestions.length > 0) {
                assistantMessage.navigationAction = {
                  path: suggestions[0].path,
                  label: formatNavigationSuggestion(suggestions[0]),
                }
              }
            }

            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1]
              if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === assistantResponse) {
                return prevMessages
              }
              return [...prevMessages, assistantMessage]
            })
            
            setCurrentStreamingMessage('')
            setIsThinking(false)
            isRequestInProgressRef.current = false

            // Update conversation history with assistant response
            setConversationHistory((prevHist) => {
              const lastEntry = prevHist[prevHist.length - 1]
              if (lastEntry && lastEntry.role === 'assistant' && lastEntry.content === assistantResponse) {
                return prevHist
              }
              return [...prevHist, { role: 'assistant', content: assistantResponse }]
            })
          }
        }
        
        // Start animation immediately (text mode only)
        animateStream()
      }
      
    } catch (error) {
      // Clear streaming interval on error
      if (streamIntervalRef.current) {
        clearTimeout(streamIntervalRef.current)
        streamIntervalRef.current = null
      }
      
      isRequestInProgressRef.current = false
      console.error('Error sending message:', error)
      setIsThinking(false)
      setCurrentStreamingMessage('')
      
      let errorContent = 'I encountered an error processing your message. Please try again.'
      
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
        errorContent = 'Please log in to use the chatbot. Redirecting to login...'
        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      } else if (error instanceof Error && error.message) {
        console.error('Detailed error:', error.message)
      }
      
      const errorMessage: Message = {
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      }
      
      // Check for duplicate error message
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === errorContent) {
          return prev // Don't add duplicate error
        }
        return [...prev, errorMessage]
      })
    }
  }, [inputValue, currentPagePath, detectedUserType, userType, detectedUserId, userId, conversationHistory, handleTextToSpeech])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) {
        clearTimeout(streamIntervalRef.current)
        streamIntervalRef.current = null
      }
    }
  }, [])

  // Handle navigation action
  const handleNavigation = useCallback((path: string) => {
    router.push(path)
    const navMessage: Message = {
      role: 'assistant',
      content: `Taking you to ${path}...`,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, navMessage])
  }, [router])

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Toggle voice mode (STT)
  const toggleVoiceMode = () => {
    setIsVoiceMode(!isVoiceMode)
    if (isVoiceMode) {
      // Stop listening if active
      if (isListening) {
        stopListening()
      }
    }
  }

  // Start listening (using Deepgram via MediaRecorder)
  const startListening = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      })
      
      streamRef.current = stream
      audioChunksRef.current = []

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Send to Deepgram API
        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')
          // Optional: Add language preference (can be enhanced to use user's language setting)
          formData.append('language', 'en') // Default to English, can be changed to 'id' for Indonesian or 'auto' for auto-detect

          const response = await fetch('/api/chatbot/stt', {
            method: 'POST',
            body: formData,
          })

          if (response.ok) {
            const data = await response.json()
            const transcript = data.transcript

            if (transcript && transcript.trim()) {
              setInputValue(transcript)
              // Automatically send the transcribed message
              setTimeout(() => {
                handleSend(transcript, true) // true indicates voice message
              }, 100)
            } else {
              alert('No speech detected. Please try again.')
            }
          } else {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || 'STT request failed')
          }
        } catch (error) {
          console.error('Error transcribing audio:', error)
          alert('Failed to transcribe audio. Please try again.')
        } finally {
          setIsListening(false)
          audioChunksRef.current = []
        }
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error)
        setIsListening(false)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsListening(true)
      
      // Setup voice activity detection to auto-stop on silence
      setupVoiceActivityDetection(stream)
      
      // Auto-stop recording after 30 seconds to prevent infinite recording
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          console.log('Auto-stopping recording after 30 seconds')
          stopListening()
        }
      }, 30000)
    } catch (error: any) {
      console.error('Error starting recording:', error)
      setIsListening(false)
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Microphone permission denied. Please allow microphone access and try again.')
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.')
      } else {
        alert('Failed to access microphone. Please check your browser settings and try again.')
      }
    }
  }

  // Stop listening
  const stopListening = useCallback(() => {
    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch (error) {
        console.error('Error stopping recorder:', error)
      }
    }
    
    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // Clean up audio context and nodes
    if (microphoneRef.current) {
      try {
        microphoneRef.current.disconnect()
      } catch (error) {
        console.error('Error disconnecting microphone:', error)
      }
      microphoneRef.current = null
    }
    
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch (error) {
        console.error('Error disconnecting analyser:', error)
      }
      analyserRef.current = null
    }
    
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch (error) {
        console.error('Error closing audio context:', error)
      }
      audioContextRef.current = null
    }
    
    setIsListening(false)
    isDetectingRef.current = false // Stop VAD loop
  }, [])

  // Voice activity detection setup
  const setupVoiceActivityDetection = useCallback((stream: MediaStream) => {
    // Ensure previous audio context is closed
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch (error) {
        console.error('Error closing previous audio context in VAD setup:', error)
      }
      audioContextRef.current = null
    }

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      
      analyserRef.current.fftSize = 256
      analyserRef.current.smoothingTimeConstant = 0.8
      
      microphoneRef.current.connect(analyserRef.current)
      
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      const SILENCE_THRESHOLD = 30 // Volume threshold (0-255)
      const SILENCE_DURATION = 1500 // 1.5 seconds of silence to stop

      let lastVoiceActivityTime = Date.now()
      isDetectingRef.current = true // Start VAD loop

      const checkVoiceActivity = () => {
        if (!isDetectingRef.current || !analyserRef.current) {
          return // Stop if detection is disabled
        }

        // Check if still recording
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
          isDetectingRef.current = false
          return
        }

        analyserRef.current.getByteFrequencyData(dataArray)
        
        // Calculate average volume
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        
        if (average > SILENCE_THRESHOLD) {
          // Voice detected, reset silence timer
          lastVoiceActivityTime = Date.now()
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current)
            silenceTimeoutRef.current = null
          }
        } else {
          // Silence detected - check if we've been silent long enough
          const silenceDuration = Date.now() - lastVoiceActivityTime
          if (silenceDuration >= SILENCE_DURATION && !silenceTimeoutRef.current) {
            // Stop immediately if we've already been silent long enough
            if (isDetectingRef.current) {
              console.log('Silence detected, stopping recording...')
              stopListening()
              return
            }
          } else if (silenceDuration > 0 && !silenceTimeoutRef.current) {
            // Set a timeout for the remaining silence duration
            const remainingSilence = SILENCE_DURATION - silenceDuration
            silenceTimeoutRef.current = setTimeout(() => {
              if (isDetectingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                console.log('Silence detected, stopping recording...')
                stopListening()
              }
            }, remainingSilence)
          }
        }
        
        // Continue checking
        if (isDetectingRef.current) {
          requestAnimationFrame(checkVoiceActivity)
        }
      }
      
      checkVoiceActivity()
    } catch (error) {
      console.error('Error setting up voice activity detection:', error)
      isDetectingRef.current = false // Stop VAD loop on error
    }
  }, [stopListening])

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 group border border-gray-200"
          aria-label="Open chatbot"
        >
          <Sparkles className="w-6 h-6 text-primary-green group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl z-50 flex flex-col transition-all duration-300 border border-gray-200 ${
            isMinimized
              ? 'w-80 h-16'
              : 'w-[420px] h-[600px] max-h-[calc(100vh-3rem)]'
          }`}
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-semibold text-gray-900 text-sm">Credit Intelligence</h3>
                <span className="text-xs text-gray-500">beta</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label={isMinimized ? 'Maximize' : 'Minimize'}
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4 text-gray-600" />
                ) : (
                  <Minimize2 className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setIsMinimized(false)
                  stopListening()
                  stopSpeaking()
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Messages */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mb-4">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-gray-600 text-sm mb-1">How can we assist you today?</p>
                  </div>
                )}
                
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          message.role === 'assistant'
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-blue-500 text-white ml-auto'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">
                            {formatMessage(message.content)}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        )}
                      </div>
                      {/* TTS button for assistant messages */}
                      {message.role === 'assistant' && (
                        <button
                          onClick={() => handleTextToSpeech(message.content)}
                          className="mt-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          title="Read aloud"
                        >
                          <Volume2 className="w-3 h-3 inline" />
                        </button>
                      )}
                      {/* Navigation action button */}
                      {message.navigationAction && (
                        <button
                          onClick={() => handleNavigation(message.navigationAction!.path)}
                          className="mt-2 px-4 py-2 bg-primary-green text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 text-sm"
                        >
                          <Bot className="w-4 h-4" />
                          {message.navigationAction.label}
                        </button>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-semibold">You</span>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Thinking indicator with animation */}
                {isThinking && !currentStreamingMessage && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="bg-gray-100 rounded-lg px-3 py-2">
                      <div className="flex gap-1 items-center">
                        <span className="text-sm text-gray-600">Thinking</span>
                        <span className="flex gap-1">
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Streaming message with typing animation */}
                {currentStreamingMessage && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="bg-gray-100 rounded-lg px-3 py-2">
                      <div className="text-sm whitespace-pre-wrap text-gray-900">
                        {formatMessage(currentStreamingMessage)}
                        <span className="inline-block w-2 h-4 bg-primary-green animate-pulse ml-1" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Connecting indicator */}
                {isConnecting && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-sm text-gray-600">Connecting...</p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
                <div className="flex items-center gap-2">
                  {/* Voice input button */}
                  <button
                    onClick={() => {
                      if (isVoiceMode && isListening) {
                        stopListening()
                      } else if (isVoiceMode) {
                        startListening()
                      } else {
                        toggleVoiceMode()
                        setTimeout(() => startListening(), 100)
                      }
                    }}
                    className={`p-2.5 rounded-lg transition-colors flex items-center justify-center ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : isVoiceMode
                        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                  >
                    {isListening ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={isVoiceMode ? "Tap mic to speak..." : "Type a message..."}
                    rows={1}
                    className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={isThinking || isListening}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim() || isThinking || isListening}
                    className="p-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {isListening && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Listening...</span>
                  </div>
                )}
                {isSpeaking && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-blue-500">
                    <Volume2 className="w-3 h-3" />
                    <span>Speaking...</span>
                    <button
                      onClick={stopSpeaking}
                      className="ml-auto text-xs underline hover:no-underline"
                    >
                      Stop
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

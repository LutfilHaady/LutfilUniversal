// Twilio client - lazy initialization to ensure env vars are loaded
let twilioClient: any = null
let isTwilioConfigured = false

/**
 * Twilio Health Check - Comprehensive diagnostic
 * Identifies exact cause of authentication/configuration issues
 */
async function twilioHealthCheck(client: any) {
  console.log("🔍 TWILIO HEALTH CHECK START")

  // 1️⃣ ENV sanity
  console.log("ENV VALUES", {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.slice(0, 6),
    authTokenPresent: !!process.env.TWILIO_AUTH_TOKEN,
    authTokenLength: process.env.TWILIO_AUTH_TOKEN?.length,
  })

  // 2️⃣ Account authentication check
  try {
    const account = await client.api
      .accounts(process.env.TWILIO_ACCOUNT_SID!)
      .fetch()

    console.log("✅ AUTH OK")
    console.log("Account Status:", account.status) // active | suspended | closed
    console.log("Account Type:", account.type)     // trial | full
    
    // Check if account is suspended
    if (account.status === 'suspended') {
      console.error("⚠️  ACCOUNT SUSPENDED")
      console.error("   - Account has been suspended (likely due to billing/payment issues)")
      console.error("   - Recharge your account in Twilio Console")
      console.error("   - Account will reactivate automatically after payment (5-10 minutes)")
      return
    }
    
    if (account.status === 'closed') {
      console.error("❌ ACCOUNT CLOSED")
      console.error("   - Account has been permanently closed")
      console.error("   - Contact Twilio Support to reactivate")
      return
    }
  } catch (err: any) {
    console.error("❌ AUTH FAILED")
    console.error("Error Code:", err.code)
    console.error("Error Message:", err.message)
    console.error("HTTP Status:", err.status)
    
    // Check if it's a 20003 authentication error (could be suspended account)
    if (err.code === 20003 || err.status === 401) {
      console.error("")
      console.error("🔍 DIAGNOSIS: Authentication Error (20003)")
      console.error("   Possible causes:")
      console.error("   1. Account SID and Auth Token don't match")
      console.error("   2. Account is SUSPENDED (most likely if recently recharged)")
      console.error("   3. Account is inactive or closed")
      console.error("   4. Credentials are incorrect")
      console.error("")
      console.error("   💡 If you just recharged a suspended account:")
      console.error("      - Wait 5-10 minutes for automatic reactivation")
      console.error("      - Check Twilio Console > Account > Status")
      console.error("      - Status should show 'Active' when ready")
    }
    
    return
  }

  // 3️⃣ WhatsApp sender check
  try {
    const senders = await client.messaging.v1
      .whatsapp
      .senders
      .list({ limit: 20 })

    console.log("📱 WhatsApp Senders Found:", senders.length)
    senders.forEach((s: any) =>
      console.log("Sender:", s.phoneNumber, "Status:", s.status)
    )
  } catch (err: any) {
    console.error("❌ WhatsApp NOT ENABLED or NO ACCESS")
    console.error("Reason:", err.code, err.message)
  }

  console.log("🔍 TWILIO HEALTH CHECK END")
}

function getTwilioClient() {
  if (twilioClient) {
    return twilioClient
  }
  
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
    
    // Debug logging
    console.log('[Twilio] Initializing client...')
    console.log('[Twilio] Account SID present:', !!accountSid, accountSid ? `(${accountSid.length} chars)` : '')
    console.log('[Twilio] Auth Token present:', !!authToken, authToken ? `(${authToken.length} chars)` : '')
    
    if (accountSid && authToken && accountSid.length > 0 && authToken.length > 0) {
    const twilio = require('twilio')
      
      // Verify credentials format
      if (!accountSid.startsWith('AC')) {
        console.error('[Twilio] WARNING: Account SID should start with "AC"')
      }
      if (authToken.length !== 32) {
        console.warn('[Twilio] WARNING: Auth Token length is', authToken.length, '(expected 32)')
      }
      
      // Initialize client with explicit credentials
      console.log('[Twilio] Creating Twilio client with Account SID:', accountSid.substring(0, 4) + '...')
      twilioClient = twilio(accountSid, authToken)
    isTwilioConfigured = true
      
      console.log('[Twilio] Client initialized successfully')
      
      // Run comprehensive health check (async, non-blocking)
      twilioHealthCheck(twilioClient).catch((err) => {
        console.error('[Twilio] Health check error:', err)
      })
      
      return twilioClient
    } else {
      console.warn('[Twilio] Missing or empty credentials. TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set.')
      return null
  }
} catch (error) {
    console.error('[Twilio] Error initializing client:', error)
    return null
  }
}

const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'
const voiceFrom = process.env.TWILIO_VOICE_FROM || '+1234567890'

// WhatsApp Template SIDs (set these after creating templates in Twilio)
const TEMPLATE_REMINDER = process.env.TWILIO_WHATSAPP_TEMPLATE_REMINDER // For FRIENDLY, PROFESSIONAL
const TEMPLATE_OVERDUE = process.env.TWILIO_WHATSAPP_TEMPLATE_OVERDUE // For URGENT, FIRM, ESCALATED

/**
 * Send WhatsApp message via Twilio
 * Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to be configured
 * 
 * For proactive messages (outside 24-hour window), use templateName and templateParams
 * For session messages (within 24-hour window), use message body directly
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  options?: {
    templateName?: string
    templateParams?: string[]
    useTemplate?: boolean
  }
): Promise<string> {
  const client = getTwilioClient()
  if (client) {
    try {
      console.log('[Twilio] ========== SENDING MESSAGE ==========')
      console.log('[Twilio] Preparing to send WhatsApp message...')
      console.log('[Twilio] To:', to)
      console.log('[Twilio] From:', whatsappFrom)
      
      // If template is specified, use ContentSid or template name
      if (options?.useTemplate && options?.templateName) {
        // Use Content API for templates
        // Format contentVariables as object with keys "1", "2", "3", etc.
        const contentVariables: Record<string, string> = {}
        if (options.templateParams) {
          options.templateParams.forEach((param, index) => {
            contentVariables[`${index + 1}`] = param
          })
        }
        
        console.log('[Twilio] Attempting to send template message...')
        console.log('[Twilio] Template SID:', options.templateName)
        console.log('[Twilio] Template Params:', options.templateParams)
        console.log('[Twilio] Content Variables:', contentVariables)
        
        const requestPayload = {
          from: whatsappFrom,
          to: `whatsapp:${to}`,
          contentSid: options.templateName,
          contentVariables: Object.keys(contentVariables).length > 0 ? JSON.stringify(contentVariables) : undefined,
        }
        console.log('[Twilio] Request payload:', JSON.stringify(requestPayload, null, 2))
        console.log('[Twilio] Making API call to Twilio...')
        
        const result = await client.messages.create(requestPayload)
        
        console.log(`[Twilio] WhatsApp template message sent: ${result.sid}`)
        return result.sid
      } else {
        // Try sending as session message first (works if user messaged within 24 hours)
        // If it fails, you'll need to use a template
        console.log('[Twilio] Attempting to send session message...')
        console.log('[Twilio] Message body:', message.substring(0, 100) + (message.length > 100 ? '...' : ''))
        
        const requestPayload = {
          from: whatsappFrom,
          to: `whatsapp:${to}`,
          body: message,
        }
        console.log('[Twilio] Request payload:', JSON.stringify(requestPayload, null, 2))
        console.log('[Twilio] Making API call to Twilio...')
        
        const result = await client.messages.create(requestPayload)
        
        console.log(`[Twilio] WhatsApp message sent: ${result.sid}`)
        return result.sid
      }
    } catch (error: any) {
      // Log comprehensive error information
      console.error('[Twilio] ========== ERROR DETAILS ==========')
      console.error('[Twilio] Error Type:', error.constructor?.name || typeof error)
      console.error('[Twilio] Error Code:', error.code)
      console.error('[Twilio] HTTP Status:', error.status)
      console.error('[Twilio] Error Message:', error.message)
      console.error('[Twilio] More Info URL:', error.moreInfo)
      console.error('[Twilio] Details:', error.details)
      console.error('[Twilio] Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
      
      // Log request details that were sent
      console.error('[Twilio] ========== REQUEST DETAILS ==========')
      console.error('[Twilio] From:', whatsappFrom)
      console.error('[Twilio] To:', `whatsapp:${to}`)
      console.error('[Twilio] Using Template:', options?.useTemplate || false)
      if (options?.useTemplate) {
        console.error('[Twilio] Template SID:', options.templateName)
        console.error('[Twilio] Template Params:', options.templateParams)
      } else {
        console.error('[Twilio] Message Body Length:', message?.length || 0)
      }
      
      // Log credential status
      console.error('[Twilio] ========== CREDENTIAL STATUS ==========')
      const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
      const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
      console.error('[Twilio] Account SID exists:', !!accountSid)
      console.error('[Twilio] Account SID length:', accountSid?.length || 0)
      console.error('[Twilio] Account SID starts with:', accountSid?.substring(0, 2) || 'N/A')
      console.error('[Twilio] Auth Token exists:', !!authToken)
      console.error('[Twilio] Auth Token length:', authToken?.length || 0)
      console.error('[Twilio] Auth Token first 4 chars:', authToken ? `${authToken.substring(0, 4)}...` : 'N/A')
      console.error('[Twilio] Client initialized:', !!client)
      
      // If error is about template requirement, log helpful message
      if (error.code === 21608 || error.message?.includes('template') || error.message?.includes('24-hour')) {
        console.error('[Twilio] ========== TEMPLATE ERROR ==========')
        console.error('[Twilio] Error: WhatsApp requires message template for proactive messages.')
        console.error('[Twilio] Either:')
        console.error('  1. Create a template in Twilio Console > Messaging > Content Template Builder')
        console.error('  2. Or ensure the user has messaged you within 24 hours (session message)')
      } else if (error.code === 20003 || error.status === 401) {
        console.error('[Twilio] ========== AUTHENTICATION ERROR ==========')
        console.error('[Twilio] Possible causes:')
        console.error('  1. Invalid Account SID or Auth Token')
        console.error('  2. Account suspended or inactive')
        console.error('  3. Account has no balance')
        console.error('  4. WhatsApp API not enabled for account')
        console.error('  5. Using subaccount credentials instead of main account')
        console.error('  6. Credentials have extra quotes or whitespace in .env file')
        console.error('[Twilio] Action: Check Twilio Console dashboard for account status')
      }
      
      console.error('[Twilio] ==========================================')
      
      throw error
    }
  }
  
  // No mock fallback - require real Twilio configuration
  throw new Error('Twilio is not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.')
}

/**
 * Initiate voice call with AI agent via Twilio
 * Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to be configured
 */
export async function initiateVoiceCall(
  to: string,
  callScript: string,
  invoiceId: string
): Promise<string> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calls/connect?invoiceId=${invoiceId}`
  
  const client = getTwilioClient()
  if (client) {
    try {
      const call = await client.calls.create({
        from: voiceFrom,
        to: to,
        url: webhookUrl, // TwiML webhook
        record: true, // Record the call
        statusCallback: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calls/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      })
      
      console.log(`[Twilio] Voice call initiated: ${call.sid}`)
      return call.sid
    } catch (error) {
      console.error('[Twilio] Error initiating voice call:', error)
      throw error
    }
  }
  
  // No mock fallback - require real Twilio configuration
  throw new Error('Twilio is not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.')
}

/**
 * Generate TwiML for voice call (Text-to-Speech)
 * This is returned to Twilio when call connects
 */
export function generateTwiML(script: string): string {
  // Escape XML special characters
  const escapedScript = script
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="id-ID">
    ${escapedScript}
  </Say>
  <Gather input="speech" timeout="10" speechTimeout="auto" language="id-ID">
    <Say voice="alice" language="id-ID">
      Terima kasih. Apakah ada pertanyaan?
    </Say>
  </Gather>
  <Say voice="alice" language="id-ID">
    Terima kasih atas waktunya. Sampai jumpa.
  </Say>
</Response>`
}

/**
 * Determine which template to use based on tone level
 * Returns template SID or null if templates not configured
 */
export function getTemplateForTone(toneLevel: string): string | null {
  // Map tone levels to templates
  const toneToTemplate: Record<string, string | null> = {
    'friendly': TEMPLATE_REMINDER || null,
    'professional': TEMPLATE_REMINDER || null,
    'urgent': TEMPLATE_OVERDUE || null,
    'firm': TEMPLATE_OVERDUE || null,
    'escalated': TEMPLATE_OVERDUE || null,
  }
  
  return toneToTemplate[toneLevel.toLowerCase()] || null
}

/**
 * Prepare template parameters for WhatsApp message
 * Returns array of parameter values in order
 */
export function prepareTemplateParams(
  buyerName: string,
  invoiceNumber: string,
  amount: number,
  dueDate: Date | string,
  daysOverdue: number,
  toneLevel: string
): string[] {
  const dueDateStr = typeof dueDate === 'string' 
    ? new Date(dueDate).toLocaleDateString('id-ID')
    : dueDate.toLocaleDateString('id-ID')
  
  const amountStr = amount.toLocaleString('id-ID')
  
  // For reminder template: [buyerName, invoiceNumber, amount, dueDate]
  if (toneLevel.toLowerCase() === 'friendly' || toneLevel.toLowerCase() === 'professional') {
    return [buyerName, invoiceNumber, amountStr, dueDateStr]
  }
  
  // For overdue template: [buyerName, invoiceNumber, amount, daysOverdue]
  return [buyerName, invoiceNumber, amountStr, daysOverdue.toString()]
}

/**
 * Check if Twilio is configured
 */
export function isTwilioReady(): boolean {
  return getTwilioClient() !== null
}


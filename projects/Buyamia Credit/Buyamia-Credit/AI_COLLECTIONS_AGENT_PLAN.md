# 🤖 AI Collections Agent - Comprehensive Integration Plan

**Last Updated:** Current Development Phase  
**Status:** Planning & Design Phase

---

## 📋 Executive Summary

This document outlines the complete integration plan for an **AI-powered Collections Agent** that automates debt collection through:
1. **WhatsApp Notifications** - Automated text messages with payment reminders
2. **Voice Calls** - AI-powered phone calls to buyers (instead of suppliers chasing)
3. **Dynamic Voice Tone** - Escalating tone based on payment status and days overdue
4. **Payment Confirmation** - Track and confirm payments received

**Key Innovation:** The agent proactively calls buyers, eliminating the need for suppliers to manually chase payments. The voice tone intelligently escalates from friendly reminders to more urgent collection calls.

---

## 🎯 Business Goals

1. **Automate AR Collection** - Reduce manual effort for suppliers
2. **Improve Payment Rates** - Proactive outreach increases on-time payments
3. **Professional Communication** - Consistent, respectful tone in Bahasa Indonesia
4. **Payment Tracking** - Real-time confirmation when payments are received
5. **Cost Efficiency** - Reduce operational costs vs. manual collection

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              Buyamia Credit Platform                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │  Invoice Monitor │─────▶│  Collections     │                │
│  │  (Cron Job)      │      │  Scheduler       │                │
│  └──────────────────┘      └──────────────────┘                │
│         │                           │                            │
│         │                           ▼                            │
│         │                  ┌──────────────────┐                 │
│         │                  │  AI Agent        │                 │
│         │                  │  Orchestrator    │                 │
│         │                  └──────────────────┘                 │
│         │                           │                            │
│         │              ┌────────────┴────────────┐              │
│         │              │                         │              │
│         ▼              ▼                         ▼              │
│  ┌──────────────┐ ┌──────────────┐      ┌──────────────┐     │
│  │  WhatsApp    │ │  Voice Call  │      │  OpenAI GPT   │     │
│  │  (Twilio)    │ │  (Twilio)    │      │  (Conversation)│     │
│  └──────────────┘ └──────────────┘      └──────────────┘     │
│         │                 │                         │          │
│         │                 │                         │          │
│         └─────────────────┴─────────────────────────┘          │
│                           │                                     │
│                           ▼                                     │
│                  ┌──────────────────┐                           │
│                  │  Payment         │                           │
│                  │  Confirmation    │                           │
│                  │  System          │                           │
│                  └──────────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 Collection Workflow Timeline

### **T-3 Days (3 Days Before Due Date)**
- **Action:** WhatsApp friendly reminder
- **Tone:** Friendly, informational
- **Message:** "Hi [Buyer], just a friendly reminder that invoice [INV-001] for Rp 5,000,000 is due in 3 days. Thank you!"

### **T-1 Day (1 Day Before Due Date)**
- **Action:** WhatsApp reminder + Voice call (if no response)
- **Tone:** Professional, courteous
- **Message:** "Hi [Buyer], invoice [INV-001] is due tomorrow. Please ensure payment is processed. Thank you!"
- **Call:** Brief, friendly reminder call

### **T+0 (Due Date)**
- **Action:** WhatsApp notification + Voice call
- **Tone:** Professional, firm but respectful
- **Message:** "Hi [Buyer], invoice [INV-001] is due today. Please confirm payment status. Thank you!"
- **Call:** Professional follow-up call

### **T+1 (1 Day Overdue)**
- **Action:** WhatsApp urgent reminder + Voice call
- **Tone:** More urgent, professional
- **Message:** "Hi [Buyer], invoice [INV-001] is now overdue. Please arrange payment immediately to avoid late fees. Thank you!"
- **Call:** Urgent but respectful call

### **T+3 (3 Days Overdue)**
- **Action:** WhatsApp + Voice call (escalated)
- **Tone:** Firm, professional, mentions consequences
- **Message:** "Hi [Buyer], invoice [INV-001] is 3 days overdue. Late fees may apply per contract terms. Please arrange payment today."
- **Call:** Firm but professional call mentioning late fees

### **T+7 (7 Days Overdue)**
- **Action:** WhatsApp final notice + Voice call (final attempt)
- **Tone:** Final notice, mentions credit impact
- **Message:** "Hi [Buyer], invoice [INV-001] is 7 days overdue. This may impact your credit score. Please contact us immediately to arrange payment."
- **Call:** Final notice call, mentions credit score impact

### **T+14+ (14+ Days Overdue)**
- **Action:** WhatsApp + Voice call (escalated to management)
- **Tone:** Escalated, mentions account review
- **Message:** "Hi [Buyer], invoice [INV-001] is 14+ days overdue. Your account is under review. Please contact us urgently."
- **Call:** Escalated call, may involve supervisor/human agent

---

## 🎙️ Voice Tone Escalation System

### **Tone Levels**

| Days Status | Tone Level | Characteristics | Example Phrase |
|------------|------------|----------------|---------------|
| T-3 to T-1 | **Friendly** | Warm, helpful, casual | "Hi! Just a friendly reminder..." |
| T+0 | **Professional** | Courteous, business-like | "Good day, this is regarding..." |
| T+1 to T+3 | **Urgent** | Firm, direct, respectful | "We need to discuss an overdue invoice..." |
| T+7 | **Firm** | Serious, mentions consequences | "This is a final notice regarding..." |
| T+14+ | **Escalated** | Very serious, account review | "Your account requires immediate attention..." |

### **Voice Tone Implementation**

The AI agent will use different:
1. **Greeting styles** (casual → formal)
2. **Language formality** (informal → formal Bahasa Indonesia)
3. **Pacing** (relaxed → urgent)
4. **Content emphasis** (friendly reminder → consequences)

---

## 🔧 Technical Implementation

### **1. Database Schema Updates**

Add new models to `prisma/schema.prisma`:

```prisma
enum CallStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  NO_ANSWER
  BUSY
}

enum CallDirection {
  OUTBOUND
  INBOUND
}

model Call {
  id            String        @id @default(cuid())
  invoiceId    String
  buyerId      String
  supplierId   String
  direction    CallDirection
  status       CallStatus
  toneLevel    String        // "friendly", "professional", "urgent", "firm", "escalated"
  callSid      String?       // Twilio Call SID
  duration     Int?          // Duration in seconds
  recordingUrl String?       // Twilio recording URL
  transcript   String?       // AI transcription of call
  aiResponse   String?       // AI-generated conversation script
  startedAt    DateTime?
  endedAt      DateTime?
  createdAt    DateTime      @default(now())

  // Relations
  invoice Invoice @relation(fields: [invoiceId], references: [id])
  buyer   User    @relation("BuyerCalls", fields: [buyerId], references: [id])
  supplier User   @relation("SupplierCalls", fields: [supplierId], references: [id])

  @@index([invoiceId])
  @@index([buyerId])
  @@index([status])
}

model CollectionAttempt {
  id            String   @id @default(cuid())
  invoiceId    String
  attemptType  String   // "whatsapp", "voice_call", "both"
  toneLevel    String
  status       String   // "sent", "delivered", "read", "failed", "answered", "no_answer"
  messageId    String?  // WhatsApp message ID
  callId       String?  // Call ID
  response     String?  // Buyer response (if any)
  createdAt    DateTime @default(now())

  // Relations
  invoice Invoice @relation(fields: [invoiceId], references: [id])
  call    Call?   @relation(fields: [callId], references: [id])

  @@index([invoiceId])
  @@index([createdAt])
}

// Update Invoice model
model Invoice {
  // ... existing fields ...
  calls            Call[]
  collectionAttempts CollectionAttempt[]
  lastCollectionAttempt DateTime?  // Track last attempt
  collectionStatus String?         // "pending", "in_progress", "paid", "escalated"
}
```

### **2. AI Agent Orchestrator**

Create `lib/ai/collections-orchestrator.ts`:

```typescript
import { OpenAI } from 'openai'
import { prisma } from '@/lib/prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface CollectionContext {
  invoiceId: string
  invoiceNumber: string
  buyerName: string
  buyerPhone: string
  amount: number
  dueDate: Date
  daysOverdue: number
  paymentTerm: string
  previousAttempts: number
  lastAttemptType?: string
  contractTerms?: {
    lateFee?: number
    creditLimit?: number
  }
}

export enum ToneLevel {
  FRIENDLY = 'friendly',
  PROFESSIONAL = 'professional',
  URGENT = 'urgent',
  FIRM = 'firm',
  ESCALATED = 'escalated'
}

/**
 * Determine appropriate tone level based on invoice status
 */
export function determineToneLevel(
  daysUntilDue: number,
  daysOverdue: number,
  previousAttempts: number
): ToneLevel {
  if (daysUntilDue > 0) {
    return ToneLevel.FRIENDLY
  }
  
  if (daysOverdue === 0) {
    return ToneLevel.PROFESSIONAL
  }
  
  if (daysOverdue <= 3) {
    return ToneLevel.URGENT
  }
  
  if (daysOverdue <= 7) {
    return ToneLevel.FIRM
  }
  
  return ToneLevel.ESCALATED
}

/**
 * Generate WhatsApp message with appropriate tone
 */
export async function generateWhatsAppMessage(
  context: CollectionContext,
  toneLevel: ToneLevel
): Promise<string> {
  const systemPrompt = getSystemPromptForTone(toneLevel)
  
  const userPrompt = `Generate a WhatsApp message in Bahasa Indonesia for:
- Invoice: ${context.invoiceNumber}
- Amount: Rp ${context.amount.toLocaleString('id-ID')}
- Buyer: ${context.buyerName}
- Due Date: ${context.dueDate.toLocaleDateString('id-ID')}
- Days Overdue: ${context.daysOverdue}
- Previous Attempts: ${context.previousAttempts}

Keep the message concise (max 200 words), professional, and in Bahasa Indonesia.`

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: toneLevel === ToneLevel.FRIENDLY ? 0.8 : 0.6,
    max_tokens: 200,
  })
  
  return response.choices[0].message.content || ''
}

/**
 * Generate voice call script with appropriate tone
 */
export async function generateVoiceCallScript(
  context: CollectionContext,
  toneLevel: ToneLevel
): Promise<string> {
  const systemPrompt = getVoiceCallSystemPrompt(toneLevel)
  
  const userPrompt = `Generate a voice call script in Bahasa Indonesia for:
- Invoice: ${context.invoiceNumber}
- Amount: Rp ${context.amount.toLocaleString('id-ID')}
- Buyer: ${context.buyerName}
- Days Overdue: ${context.daysOverdue}
- Payment Term: ${context.paymentTerm}

The script should be:
- Natural and conversational
- Appropriate for phone conversation
- Include greeting, main message, and call-to-action
- Keep it under 60 seconds when spoken
- In Bahasa Indonesia`

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: toneLevel === ToneLevel.FRIENDLY ? 0.8 : 0.6,
    max_tokens: 300,
  })
  
  return response.choices[0].message.content || ''
}

/**
 * Get system prompt based on tone level
 */
function getSystemPromptForTone(toneLevel: ToneLevel): string {
  const basePrompt = `You are a professional collections agent for Buyamia Credit Platform, a B2B credit management system in Indonesia.
  
Communication Guidelines:
- Always use Bahasa Indonesia
- Be respectful and professional
- Never use threatening or aggressive language
- Provide clear payment instructions
- Maintain brand reputation`

  const toneSpecificPrompts = {
    [ToneLevel.FRIENDLY]: `${basePrompt}

Tone: Friendly and helpful
Style: Warm, casual, reminder-style
Purpose: Gentle reminder before due date
Example: "Hi! Just a friendly reminder that..."`,

    [ToneLevel.PROFESSIONAL]: `${basePrompt}

Tone: Professional and courteous
Style: Business-like, formal but friendly
Purpose: Reminder on due date
Example: "Good day, this is regarding..."`,

    [ToneLevel.URGENT]: `${basePrompt}

Tone: Urgent but respectful
Style: Direct, firm, business-like
Purpose: Immediate payment needed
Example: "We need to discuss an overdue invoice..."`,

    [ToneLevel.FIRM]: `${basePrompt}

Tone: Firm and serious
Style: Direct, mentions consequences
Purpose: Final notice before escalation
Example: "This is a final notice regarding..."`,

    [ToneLevel.ESCALATED]: `${basePrompt}

Tone: Very serious, escalated
Style: Formal, mentions account review
Purpose: Account under review
Example: "Your account requires immediate attention..."`,
  }

  return toneSpecificPrompts[toneLevel]
}

/**
 * Get voice call system prompt
 */
function getVoiceCallSystemPrompt(toneLevel: ToneLevel): string {
  return `${getSystemPromptForTone(toneLevel)}

Additional Guidelines for Voice Calls:
- Speak naturally and conversationally
- Pause appropriately for responses
- Be prepared to answer questions
- Keep the call brief (under 60 seconds)
- End with clear next steps
- Use appropriate greeting based on time of day`
}
```

### **3. Twilio Integration**

Create `lib/integrations/twilio.ts`:

```typescript
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM // e.g., whatsapp:+14155238886
const voiceFrom = process.env.TWILIO_VOICE_FROM // e.g., +1234567890

const client = twilio(accountSid, authToken)

/**
 * Send WhatsApp message
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<string> {
  const result = await client.messages.create({
    from: whatsappFrom,
    to: `whatsapp:${to}`,
    body: message,
  })
  
  return result.sid
}

/**
 * Initiate voice call with AI agent
 */
export async function initiateVoiceCall(
  to: string,
  callScript: string,
  invoiceId: string
): Promise<string> {
  // Twilio will call the webhook URL when call connects
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/connect?invoiceId=${invoiceId}`
  
  const call = await client.calls.create({
    from: voiceFrom,
    to: to,
    url: webhookUrl, // TwiML webhook
    record: true, // Record the call
    statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/calls/status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
  })
  
  return call.sid
}

/**
 * Generate TwiML for voice call (TTS or AI conversation)
 */
export function generateTwiML(script: string): string {
  // Option 1: Text-to-Speech
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="id-ID">
    ${script}
  </Say>
  <Gather input="speech" timeout="10" speechTimeout="auto">
    <Say voice="alice" language="id-ID">
      Terima kasih. Apakah ada pertanyaan?
    </Say>
  </Gather>
  <Say voice="alice" language="id-ID">
    Terima kasih atas waktunya. Sampai jumpa.
  </Say>
</Response>`
  
  // Option 2: Use Twilio Voice AI (if available)
  // This would integrate with OpenAI's voice API for real-time conversation
}
```

### **4. API Routes**

Create `app/api/collections/trigger/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  determineToneLevel, 
  generateWhatsAppMessage, 
  generateVoiceCallScript 
} from '@/lib/ai/collections-orchestrator'
import { sendWhatsAppMessage, initiateVoiceCall } from '@/lib/integrations/twilio'

/**
 * POST /api/collections/trigger
 * Trigger collection attempt for an invoice
 */
export async function POST(request: NextRequest) {
  try {
    const { invoiceId, attemptType = 'both' } = await request.json()
    
    // Get invoice details
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        buyer: true,
        supplier: true,
      },
    })
    
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    
    // Calculate days overdue
    const now = new Date()
    const dueDate = new Date(invoice.dueDate)
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    const daysUntilDue = -daysOverdue
    
    // Get previous attempts
    const previousAttempts = await prisma.collectionAttempt.count({
      where: { invoiceId },
    })
    
    // Determine tone level
    const toneLevel = determineToneLevel(daysUntilDue, daysOverdue, previousAttempts)
    
    // Create collection context
    const context = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      buyerName: invoice.buyer.businessName,
      buyerPhone: invoice.buyer.phoneNumber,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      daysOverdue,
      paymentTerm: 'Net 30', // Get from contract
      previousAttempts,
    }
    
    const results = []
    
    // Send WhatsApp message
    if (attemptType === 'whatsapp' || attemptType === 'both') {
      const message = await generateWhatsAppMessage(context, toneLevel)
      const messageId = await sendWhatsAppMessage(context.buyerPhone, message)
      
      // Log attempt
      await prisma.collectionAttempt.create({
        data: {
          invoiceId: invoice.id,
          attemptType: 'whatsapp',
          toneLevel,
          status: 'sent',
          messageId,
        },
      })
      
      results.push({ type: 'whatsapp', messageId, status: 'sent' })
    }
    
    // Initiate voice call
    if (attemptType === 'voice_call' || attemptType === 'both') {
      const callScript = await generateVoiceCallScript(context, toneLevel)
      const callSid = await initiateVoiceCall(context.buyerPhone, callScript, invoice.id)
      
      // Create call record
      const call = await prisma.call.create({
        data: {
          invoiceId: invoice.id,
          buyerId: invoice.buyerId,
          supplierId: invoice.supplierId,
          direction: 'OUTBOUND',
          status: 'PENDING',
          toneLevel,
          callSid,
          aiResponse: callScript,
        },
      })
      
      // Log attempt
      await prisma.collectionAttempt.create({
        data: {
          invoiceId: invoice.id,
          attemptType: 'voice_call',
          toneLevel,
          status: 'pending',
          callId: call.id,
        },
      })
      
      results.push({ type: 'voice_call', callSid, status: 'initiated' })
    }
    
    // Update invoice
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        lastCollectionAttempt: now,
        collectionStatus: 'in_progress',
      },
    })
    
    return NextResponse.json({ 
      success: true, 
      results,
      toneLevel,
    })
    
  } catch (error) {
    console.error('Collection trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger collection' },
      { status: 500 }
    )
  }
}
```

Create `app/api/calls/connect/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTwiML } from '@/lib/integrations/twilio'

/**
 * GET /api/calls/connect
 * Twilio webhook when call connects - returns TwiML
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const invoiceId = searchParams.get('invoiceId')
  
  if (!invoiceId) {
    return new NextResponse('Missing invoiceId', { status: 400 })
  }
  
  // Get call record
  const call = await prisma.call.findFirst({
    where: { invoiceId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })
  
  if (!call || !call.aiResponse) {
    return new NextResponse('Call not found', { status: 404 })
  }
  
  // Update call status
  await prisma.call.update({
    where: { id: call.id },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  })
  
  // Generate TwiML with AI script
  const twiml = generateTwiML(call.aiResponse)
  
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}
```

Create `app/api/calls/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/calls/status
 * Twilio webhook for call status updates
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const callSid = formData.get('CallSid') as string
  const callStatus = formData.get('CallStatus') as string
  const duration = formData.get('CallDuration') as string
  const recordingUrl = formData.get('RecordingUrl') as string
  
  // Find call by SID
  const call = await prisma.call.findUnique({
    where: { callSid },
  })
  
  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }
  
  // Map Twilio status to our status
  const statusMap: Record<string, string> = {
    'queued': 'PENDING',
    'ringing': 'IN_PROGRESS',
    'in-progress': 'IN_PROGRESS',
    'completed': 'COMPLETED',
    'busy': 'BUSY',
    'no-answer': 'NO_ANSWER',
    'failed': 'FAILED',
    'canceled': 'FAILED',
  }
  
  const updateData: any = {
    status: statusMap[callStatus] || 'FAILED',
  }
  
  if (callStatus === 'completed') {
    updateData.endedAt = new Date()
    updateData.duration = duration ? parseInt(duration) : null
    updateData.recordingUrl = recordingUrl || null
  }
  
  await prisma.call.update({
    where: { id: call.id },
    data: updateData,
  })
  
  // Update collection attempt
  await prisma.collectionAttempt.updateMany({
    where: { callId: call.id },
    data: {
      status: callStatus === 'completed' ? 'answered' : 
              callStatus === 'no-answer' ? 'no_answer' :
              callStatus === 'busy' ? 'busy' : 'failed',
    },
  })
  
  return NextResponse.json({ success: true })
}
```

### **5. Scheduled Collection Job**

Create `lib/jobs/collections-scheduler.ts`:

```typescript
import { prisma } from '@/lib/prisma'

/**
 * Check invoices and trigger collection attempts
 * This should run as a cron job (e.g., every hour)
 */
export async function processCollectionQueue() {
  const now = new Date()
  
  // Find invoices that need collection
  const invoices = await prisma.invoice.findMany({
    where: {
      status: {
        in: ['PENDING', 'DUE_SOON', 'OVERDUE_3', 'OVERDUE_7'],
      },
      // Only process if last attempt was > 24 hours ago
      OR: [
        { lastCollectionAttempt: null },
        { lastCollectionAttempt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      ],
    },
    include: {
      buyer: true,
      collectionAttempts: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  
  for (const invoice of invoices) {
    const dueDate = new Date(invoice.dueDate)
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    const daysUntilDue = -daysOverdue
    
    // Determine attempt type based on timeline
    let attemptType: 'whatsapp' | 'voice_call' | 'both' = 'whatsapp'
    
    if (daysUntilDue === 1 || daysOverdue >= 1) {
      attemptType = 'both' // Send WhatsApp + make call
    } else if (daysOverdue >= 7) {
      attemptType = 'voice_call' // Prioritize calls for severely overdue
    }
    
    // Trigger collection attempt
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/collections/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          attemptType,
        }),
      })
      
      if (!response.ok) {
        console.error(`Failed to trigger collection for invoice ${invoice.invoiceNumber}`)
      }
    } catch (error) {
      console.error(`Error triggering collection for invoice ${invoice.invoiceNumber}:`, error)
    }
  }
  
  return { processed: invoices.length }
}
```

---

## 📊 Payment Confirmation Flow

### **1. Payment Confirmation via WhatsApp**

Buyers can confirm payment via WhatsApp:

```
Buyer: "Sudah transfer untuk invoice INV-001"
Agent: "Terima kasih! Kami akan verifikasi pembayaran Anda. Apakah Anda memiliki bukti transfer?"
Buyer: [sends image]
Agent: "Terima kasih! Pembayaran Anda sedang diverifikasi dan akan diproses dalam 1-2 hari kerja."
```

### **2. Payment Confirmation via Voice Call**

During voice call:
- Agent asks: "Apakah Anda sudah melakukan pembayaran?"
- If yes: "Silakan kirim bukti transfer via WhatsApp"
- Agent confirms and updates invoice status

### **3. Automatic Payment Detection**

Integrate with payment gateway webhooks to automatically mark invoices as paid.

---

## 🔐 Security & Privacy

1. **API Key Management**
   - Store Twilio and OpenAI keys in environment variables
   - Never expose in client-side code
   - Rotate keys regularly

2. **Call Recording**
   - Record all calls for quality assurance
   - Store recordings securely
   - Comply with Indonesian data protection laws
   - Allow opt-out if required by law

3. **Rate Limiting**
   - Limit collection attempts per invoice (max 1 per day)
   - Prevent spam/abuse
   - Monitor API usage

4. **Data Privacy**
   - Encrypt call recordings
   - Secure storage of conversation logs
   - GDPR/Indonesian data protection compliance

---

## 💰 Cost Estimation

### **Monthly Costs (1000 active invoices/month)**

**WhatsApp (Twilio):**
- Outbound messages: ~5,000 messages/month
- Cost: $0.005 per message = **$25/month**

**Voice Calls (Twilio):**
- Outbound calls: ~2,000 calls/month
- Average duration: 2 minutes
- Cost: $0.013 per minute = **$52/month**

**OpenAI GPT-3.5-turbo:**
- Messages: ~5,000 messages/month
- Average: 200 tokens/message = 1M tokens
- Cost: 1M × $0.002 = **$2/month**

**Call Recordings (Twilio):**
- Storage: ~2,000 recordings/month
- Cost: ~**$5/month**

**Total: ~$84/month** for 1000 invoices

**Scaling to 10,000 invoices: ~$840/month**

---

## 📅 Implementation Timeline

### **Week 1: Foundation**
- [ ] Update Prisma schema with Call and CollectionAttempt models
- [ ] Set up Twilio account and get API credentials
- [ ] Set up OpenAI API account
- [ ] Create basic Twilio integration functions

### **Week 2: Core Agent Logic**
- [ ] Implement tone level determination logic
- [ ] Create AI prompt templates for each tone level
- [ ] Build WhatsApp message generation
- [ ] Build voice call script generation
- [ ] Test AI responses for each tone level

### **Week 3: Integration**
- [ ] Implement WhatsApp sending
- [ ] Implement voice call initiation
- [ ] Create Twilio webhook handlers
- [ ] Build collection trigger API
- [ ] Create collection scheduler/cron job

### **Week 4: Payment & Polish**
- [ ] Implement payment confirmation flow
- [ ] Add call recording and transcription
- [ ] Build admin dashboard for collection monitoring
- [ ] Add error handling and retry logic
- [ ] Performance testing and optimization

---

## 🎯 Success Metrics

1. **Collection Rate** - % of invoices collected on time
2. **Response Rate** - % of calls answered
3. **Payment Confirmation Rate** - % of payments confirmed
4. **Cost per Collection** - Average cost per successful collection
5. **Time to Payment** - Average days from due date to payment

---

## 🚀 Next Steps

1. **Review and approve this plan**
2. **Set up Twilio and OpenAI accounts**
3. **Update database schema**
4. **Start with WhatsApp integration (simpler)**
5. **Add voice calls after WhatsApp is stable**
6. **Iterate on tone levels based on real-world feedback**

---

## 📝 Notes

- Start with GPT-3.5-turbo for cost efficiency
- Consider upgrading to GPT-4 for complex escalations
- Monitor AI responses for quality and appropriateness
- Adjust tone levels based on buyer feedback
- Consider A/B testing different message styles
- Build admin dashboard to monitor collection performance
- Add human escalation path for T+14+ cases

---

**Questions or Updates?** Update this document as the AI Collections Agent evolves.


import { ToneLevel } from '@/lib/types/collections'

// OpenAI client - requires API key to be configured
let openaiClient: any = null

try {
  if (process.env.OPENAI_API_KEY) {
    const { OpenAI } = require('openai')
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
} catch (error) {
  console.error('OpenAI SDK not installed. Please run: npm install openai')
}

export interface CollectionContext {
  invoiceId: string
  invoiceNumber: string
  buyerName: string
  buyerPhone: string
  amount: number
  dueDate: Date | string
  daysOverdue: number
  paymentTerm: string
  previousAttempts: number
  lastAttemptType?: string
  contractTerms?: {
    lateFee?: number
    creditLimit?: number
  }
}

export { ToneLevel }

/**
 * Determine appropriate tone level based on invoice status
 */
export function determineToneLevel(
  daysUntilDue: number,
  daysOverdue: number,
  previousAttempts: number
): ToneLevel {
  // If invoice is not yet due
  if (daysUntilDue > 0) {
    if (daysUntilDue >= 3) {
      return ToneLevel.FRIENDLY
    }
    // T-1 or T-2: Still friendly but more direct
    return ToneLevel.FRIENDLY
  }
  
  // Due today
  if (daysOverdue === 0) {
    return ToneLevel.PROFESSIONAL
  }
  
  // 1-3 days overdue
  if (daysOverdue <= 3) {
    return ToneLevel.URGENT
  }
  
  // 4-7 days overdue
  if (daysOverdue <= 7) {
    return ToneLevel.FIRM
  }
  
  // 8+ days overdue
  return ToneLevel.ESCALATED
}

/**
 * Generate WhatsApp message with appropriate tone using OpenAI
 * Requires OPENAI_API_KEY to be configured
 */
export async function generateWhatsAppMessage(
  context: CollectionContext,
  toneLevel: ToneLevel
): Promise<string> {
  const systemPrompt = getSystemPromptForTone(toneLevel)
  
  const dueDate = typeof context.dueDate === 'string' 
    ? new Date(context.dueDate).toLocaleDateString('en-US')
    : context.dueDate.toLocaleDateString('en-US')
  
  const userPrompt = `Generate a WhatsApp message in English for:
- Invoice: ${context.invoiceNumber}
- Amount: Rp ${context.amount.toLocaleString('id-ID')}
- Buyer: ${context.buyerName}
- Due Date: ${dueDate}
- Days Overdue: ${context.daysOverdue}
- Previous Attempts: ${context.previousAttempts}
${context.contractTerms?.lateFee ? `- Late Fee: Rp ${context.contractTerms.lateFee.toLocaleString('id-ID')}` : ''}

Keep the message concise (max 200 words), professional, and in English.`

  // Use real OpenAI if available
  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: toneLevel === ToneLevel.FRIENDLY ? 0.8 : 0.6,
        max_tokens: 200,
      })
      
      const content = response.choices[0].message.content
      if (!content) {
        throw new Error('OpenAI returned empty response')
      }
      return content
    } catch (error) {
      console.error('OpenAI API error:', error)
      throw new Error(`Failed to generate WhatsApp message: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // No mock fallback - require real OpenAI configuration
  throw new Error('OpenAI is not configured. Please set OPENAI_API_KEY in environment variables.')
}

/**
 * Generate voice call script with appropriate tone using OpenAI
 * Requires OPENAI_API_KEY to be configured
 */
export async function generateVoiceCallScript(
  context: CollectionContext,
  toneLevel: ToneLevel
): Promise<string> {
  const systemPrompt = getVoiceCallSystemPrompt(toneLevel)
  
  const userPrompt = `Generate a voice call script in English for:
- Invoice: ${context.invoiceNumber}
- Amount: Rp ${context.amount.toLocaleString('id-ID')}
- Buyer: ${context.buyerName}
- Days Overdue: ${context.daysOverdue}
- Payment Term: ${context.paymentTerm}
${context.contractTerms?.lateFee ? `- Late Fee: Rp ${context.contractTerms.lateFee.toLocaleString('id-ID')}` : ''}

The script should be:
- Natural and conversational
- Appropriate for phone conversation
- Include greeting, main message, and call-to-action
- Keep it under 60 seconds when spoken
- In English`

  // Use real OpenAI if available
  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: toneLevel === ToneLevel.FRIENDLY ? 0.8 : 0.6,
        max_tokens: 300,
      })
      
      const content = response.choices[0].message.content
      if (!content) {
        throw new Error('OpenAI returned empty response')
      }
      return content
    } catch (error) {
      console.error('OpenAI API error:', error)
      throw new Error(`Failed to generate voice call script: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // No mock fallback - require real OpenAI configuration
  throw new Error('OpenAI is not configured. Please set OPENAI_API_KEY in environment variables.')
}

/**
 * Get system prompt based on tone level
 */
function getSystemPromptForTone(toneLevel: ToneLevel): string {
  const basePrompt = `You are a professional collections agent for Buyamia Credit Platform, a B2B credit management system in Indonesia.

Communication Guidelines:
- Always use English
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

/**
 * Get time-appropriate greeting
 */
function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'pagi'
  if (hour < 15) return 'siang'
  if (hour < 19) return 'sore'
  return 'malam'
}


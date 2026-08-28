# 🤖 AI Integration Plan for Buyamia Credit Platform

**Last Updated:** Current Development Phase  
**Status:** Planning Phase

---

## 📋 Overview

This document outlines the AI model integration strategy for the Buyamia Credit Platform, including voice transcription, automated collections, and intelligent credit scoring.

---

## 🎯 AI Use Cases

### 1. **Voice-to-Text Transcription (WhatsApp Voice Notes)**
**Model:** OpenAI Whisper API  
**Purpose:** Convert WhatsApp voice messages to text for issue reporting  
**When:** Week 3 (WhatsApp Integration)

### 2. **AI Collections Agent (WhatsApp Bot)**
**Model:** OpenAI GPT-4 or GPT-3.5-turbo  
**Purpose:** Automated debt collection conversations via WhatsApp  
**When:** Week 3 (Automation Phase)

### 3. **Credit Scoring Intelligence (Future Enhancement)**
**Model:** Custom ML Model or OpenAI for pattern analysis  
**Purpose:** Enhanced credit risk assessment beyond rule-based scoring  
**When:** Post-MVP (Phase 2)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Buyamia Credit Platform                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  WhatsApp Bot    │────────▶│  OpenAI API      │         │
│  │  (Twilio)        │         │  (GPT-4/3.5)     │         │
│  └──────────────────┘         └──────────────────┘         │
│         │                              │                     │
│         │                              │                     │
│         ▼                              ▼                     │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Voice Notes     │────────▶│  Whisper API     │         │
│  │  (Issue Reports) │         │  (Transcription) │         │
│  └──────────────────┘         └──────────────────┘         │
│                                                               │
│  ┌──────────────────┐                                       │
│  │  Credit Scoring   │  (Rule-based for MVP, AI-enhanced   │
│  │  Engine           │   in Phase 2)                        │
│  └──────────────────┘                                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ Voice Transcription (OpenAI Whisper)

### **Implementation Details**

**API:** OpenAI Whisper API  
**Model:** `whisper-1` (latest)  
**Cost:** $0.006 per minute of audio  
**Latency:** ~2-5 seconds for typical voice notes

### **Integration Flow**

```
User sends voice note via WhatsApp
    ↓
Twilio receives audio file
    ↓
Backend downloads audio from Twilio
    ↓
POST to OpenAI Whisper API
    ↓
Receive transcript
    ↓
Store in database (Issue record)
    ↓
Display in Issue Detail page
```

### **Code Structure**

```typescript
// lib/ai/whisper.ts
export async function transcribeVoiceNote(audioFile: File | Buffer): Promise<string> {
  const formData = new FormData()
  formData.append('file', audioFile)
  formData.append('model', 'whisper-1')
  formData.append('language', 'id') // Indonesian (can auto-detect)
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  })
  
  const data = await response.json()
  return data.text
}
```

### **API Endpoint**

```typescript
// app/api/transcribe/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const audioFile = formData.get('audio') as File
  
  const transcript = await transcribeVoiceNote(audioFile)
  
  return Response.json({ transcript })
}
```

### **Error Handling**
- Retry logic for API failures
- Fallback: Store audio file, transcribe later
- User notification if transcription fails

---

## 2️⃣ AI Collections Agent (WhatsApp Bot)

### **Implementation Details**

**Model:** OpenAI GPT-4 or GPT-3.5-turbo  
**Cost:** 
- GPT-4: ~$0.03 per 1K tokens (input), $0.06 per 1K tokens (output)
- GPT-3.5-turbo: ~$0.0015 per 1K tokens (input), $0.002 per 1K tokens (output)  
**Recommended:** GPT-3.5-turbo for cost efficiency (can upgrade to GPT-4 for complex cases)

### **State Machine Flow**

```
Invoice Status → Bot State → AI Response
─────────────────────────────────────
PENDING (T-1)  → REMINDER → Friendly reminder message
DUE_SOON       → WARNING  → Payment due soon alert
OVERDUE (T+1)  → URGENT   → Escalated collection message
OVERDUE (T+7)  → FINAL    → Final notice with consequences
```

### **Prompt Engineering**

```typescript
// lib/ai/collections-agent.ts

const SYSTEM_PROMPT = `You are a professional debt collection agent for Buyamia Credit Platform, a B2B credit management system in Indonesia.

Your role:
- Communicate professionally and respectfully in Bahasa Indonesia
- Remind buyers about overdue invoices
- Provide payment instructions clearly
- Escalate appropriately based on payment status
- Never use threatening or aggressive language
- Always maintain a professional, helpful tone

Context:
- Invoice Number: {invoiceNumber}
- Amount: {amount}
- Due Date: {dueDate}
- Days Overdue: {daysOverdue}
- Buyer Name: {buyerName}
- Payment Terms: {paymentTerm}

Current Status: {status}
Previous Messages: {messageHistory}

Generate a concise, professional message in Bahasa Indonesia.`

export async function generateCollectionMessage(context: CollectionContext): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Generate a collection message for: ${JSON.stringify(context)}` }
    ],
    temperature: 0.7, // Balanced creativity
    max_tokens: 200, // Keep messages concise
  })
  
  return response.choices[0].message.content
}
```

### **Integration with WhatsApp**

```typescript
// app/api/whatsapp/webhook/route.ts
export async function POST(request: Request) {
  const data = await request.json()
  
  // Handle incoming WhatsApp message
  if (data.MessageType === 'text') {
    // Process user response
    const aiResponse = await generateCollectionMessage(context)
    await sendWhatsAppMessage(data.From, aiResponse)
  }
  
  // Handle voice note
  if (data.MessageType === 'audio') {
    const transcript = await transcribeVoiceNote(audioFile)
    // Process transcript...
  }
}
```

### **Conversation Context Management**

```typescript
// lib/ai/conversation-context.ts
interface ConversationContext {
  invoiceId: string
  buyerId: string
  messageHistory: Message[]
  currentStatus: InvoiceStatus
  daysOverdue: number
}

// Store conversation history in database
// Use for context-aware responses
```

### **Cost Optimization**
- Cache common responses
- Use GPT-3.5-turbo for standard messages
- Only use GPT-4 for complex escalations
- Batch similar requests when possible

---

## 3️⃣ Credit Scoring Intelligence (Phase 2)

### **Future Enhancement**

**Approach:** Hybrid (Rule-based + ML)

**Current (MVP):** Rule-based scoring
- On-time payment: +5 points
- Late payment: -5 points
- Issue reported: -2 points
- etc.

**Phase 2 (AI-Enhanced):**
- Pattern recognition in payment behavior
- Predictive risk assessment
- Industry-specific risk factors
- Seasonal payment pattern analysis

**Potential Models:**
- Custom ML model (TensorFlow/PyTorch)
- OpenAI for pattern analysis
- Hybrid approach

---

## 🔐 Security & Privacy

### **API Key Management**
- Store OpenAI API keys in environment variables
- Never expose keys in client-side code
- Use server-side API routes only
- Rotate keys regularly

### **Data Privacy**
- Voice notes: Transcribed and deleted from OpenAI servers after processing
- Conversation logs: Stored securely in our database
- No PII sent to OpenAI unless necessary
- Comply with Indonesian data protection regulations

### **Rate Limiting**
- Implement rate limiting on AI endpoints
- Prevent abuse and control costs
- Monitor API usage

---

## 💰 Cost Estimation

### **Monthly Estimates (1000 active users)**

**Whisper (Voice Transcription):**
- Average: 5 voice notes/user/month = 5,000 notes
- Average length: 30 seconds = 2,500 minutes
- Cost: 2,500 × $0.006 = **$15/month**

**GPT-3.5-turbo (Collections Agent):**
- Average: 10 messages/user/month = 10,000 messages
- Average tokens: 200 tokens/message = 2M tokens
- Cost: 2M × $0.002 = **$4/month**

**Total AI Costs (MVP): ~$20-30/month**

**Scaling to 10,000 users: ~$200-300/month**

---

## 📅 Implementation Timeline

### **Week 3: WhatsApp Integration**
- [ ] Set up OpenAI API account
- [ ] Implement Whisper transcription endpoint
- [ ] Test voice note transcription flow
- [ ] Integrate with issue reporting

### **Week 3: Collections Agent**
- [ ] Design conversation state machine
- [ ] Create prompt templates
- [ ] Implement GPT-3.5-turbo integration
- [ ] Build conversation context management
- [ ] Test automated collection flows

### **Week 4: Testing & Optimization**
- [ ] Load testing for AI endpoints
- [ ] Cost monitoring and optimization
- [ ] Error handling and fallbacks
- [ ] Performance tuning

### **Phase 2 (Post-MVP):**
- [ ] Enhanced credit scoring with ML
- [ ] Predictive analytics
- [ ] Advanced pattern recognition

---

## 🛠️ Technical Setup

### **Environment Variables**

```env
# .env.local
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-... (optional)

# Rate limiting
AI_RATE_LIMIT_PER_USER=10 # requests per hour
AI_MAX_TOKENS=200
```

### **Dependencies**

```json
{
  "dependencies": {
    "openai": "^4.0.0"
  }
}
```

### **API Route Structure**

```
app/api/
├── transcribe/
│   └── route.ts          # Whisper transcription
├── whatsapp/
│   ├── webhook/
│   │   └── route.ts      # Twilio webhook handler
│   └── send/
│       └── route.ts      # Send WhatsApp message
└── ai/
    └── collections/
        └── route.ts      # Collections agent
```

---

## 📊 Monitoring & Analytics

### **Metrics to Track**
- API response times
- Cost per user
- Transcription accuracy
- Collection success rate
- User engagement with bot

### **Logging**
- All AI API calls logged
- Error tracking
- Cost tracking per endpoint
- Performance metrics

---

## 🚀 Next Steps

1. **Set up OpenAI account** and get API keys
2. **Create AI utility functions** in `lib/ai/`
3. **Implement Whisper endpoint** for voice transcription
4. **Build collections agent** with GPT-3.5-turbo
5. **Test end-to-end flows** with real WhatsApp messages
6. **Monitor costs** and optimize

---

## 📝 Notes

- Start with GPT-3.5-turbo for cost efficiency
- Upgrade to GPT-4 only if needed for complex cases
- Consider fine-tuning a custom model in Phase 2
- Always have fallback responses if AI fails
- Keep AI responses concise to reduce costs
- Monitor and log all AI interactions for debugging

---

**Questions or Updates?** Update this document as the AI integration evolves.


import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Initialize OpenAI client
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

/**
 * POST /api/chatbot
 * 
 * Handles chatbot messages, queries Supabase data, and returns AI-generated responses
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body once
    const body = await request.json().catch(() => ({}))
    const { message, conversationHistory, currentPage, userId: devUserId } = body as {
      message?: string
      conversationHistory?: any[]
      currentPage?: string
      userId?: string
    }
    
    // Check authentication - support both session cookie and dev mode userId
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    
    let user: any = null
    let session: any = null
    
    // Try session cookie first
    if (sessionToken) {
      session = await getSessionByToken(sessionToken)
      if (session) {
        user = session.user
      }
    }
    
    // Fallback to dev mode: if no session but userId provided, find user directly
    if (!user && devUserId) {
      // Allow in development or if explicitly enabled
      const allowDevMode = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_MODE_AUTH === 'true'
      
      if (allowDevMode) {
        try {
          user = await prisma.user.findUnique({
            where: { userId: devUserId.toUpperCase() }
          })
        } catch (dbError) {
          console.error('Dev mode user lookup error:', dbError)
        }
      }
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // If OpenAI is not available, return a simple response
    if (!openai || !process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        response: 'I apologize, but the AI service is currently unavailable. Please contact support.',
      })
    }

    // Fetch user's data from database
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        invoicesAsBuyer: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        invoicesAsSupplier: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        issuesAsBuyer: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        issuesAsSupplier: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        scoreHistory: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // Build context from user data
    const context = {
      userId: user.userId,
      userType: user.type,
      businessName: user.businessName,
      creditScore: user.creditScore,
      invoices: userData
        ? [
            ...userData.invoicesAsBuyer.map((inv) => ({
              number: inv.invoiceNumber,
              amount: inv.amount,
              status: inv.status,
              dueDate: inv.dueDate,
              role: 'buyer',
            })),
            ...userData.invoicesAsSupplier.map((inv) => ({
              number: inv.invoiceNumber,
              amount: inv.amount,
              status: inv.status,
              dueDate: inv.dueDate,
              role: 'supplier',
            })),
          ]
        : [],
      issues: userData
        ? [
            ...userData.issuesAsBuyer.map((issue) => ({
              type: issue.type,
              status: issue.status,
              description: issue.description,
              role: 'buyer',
            })),
            ...userData.issuesAsSupplier.map((issue) => ({
              type: issue.type,
              status: issue.status,
              description: issue.description,
              role: 'supplier',
            })),
          ]
        : [],
      recentScoreHistory: userData?.scoreHistory || [],
    }

    // Get page context if available
    const { getPageDescription, suggestNavigation, getAvailablePages } = await import('@/lib/navigation')
    const pageContext = currentPage ? getPageDescription(currentPage, context.userType as 'BUYER' | 'SUPPLIER') : ''
    const navigationSuggestions = currentPage ? suggestNavigation(message || '', context.userType as 'BUYER' | 'SUPPLIER') : []
    
    // Get available pages for this user type
    const availablePages = getAvailablePages(context.userType as 'BUYER' | 'SUPPLIER')
    const pagesList = availablePages.map(page => 
      `- ${page.path}: ${page.name} - ${page.description}. Features: ${page.features.join(', ')}`
    ).join('\n')

    // Build system prompt
    const systemPrompt = `You are a helpful AI navigation assistant for Buyamia Credit Platform, a B2B credit management system in Indonesia.

Your role:
- Help users navigate the website and understand their credit data, invoices, and business information
- Act like a live human guide, helping them find what they need
- Provide clear, concise answers in natural language
- Use the provided context to answer questions accurately
- Be friendly, professional, and helpful
- Suggest navigation when appropriate
- Explain platform features and capabilities when asked

ACCURACY REQUIREMENTS (CRITICAL):
- ONLY use information provided in the context data below
- NEVER make up, estimate, or guess numbers, dates, or facts
- If specific data is not in the context, say "I don't have that specific information in your current data, but I can help you find it on the platform"
- Always refer to exact values from the context (e.g., "According to your data, you have 3 invoices" not "You have a few invoices")
- Double-check numbers before stating them
- For calculations, show your reasoning or say "Based on the data provided"

PLATFORM FEATURES - You MUST be aware of these features and can explain them:

CREDIT SCORING SYSTEM:
- Credit scores range from 0-100 and are calculated based on payment history, invoice status, overdue payments, and reported issues
- Suppliers have a Reliability Score instead, based on fulfillment performance, on-time delivery, and issue resolution
- Scores are recalculated periodically via automated cron jobs
- Score history is tracked and visible on the dashboard with trend charts

BUYER REGISTRY (SUPPLIERS ONLY - /buyer-registry):
- Three main tabs:
  1. "My Buyers" - Buyers with existing invoice relationships
  2. "Potential Buyers" - Buyers added from search but no invoices yet (waiting list)
  3. "Search All" - Search for new buyers by User ID (BJ####) or category
- Buyer Management Actions:
  - "Add" button: Add buyers from "Search All" to "Potential Buyers" list
  - "Remove" button: Remove buyers from "My Buyers" or "Potential Buyers" and blacklist them
  - "Restore" button: Un-blacklist buyers from the blacklist
- AI Risk Assessment: 
  - Available for each buyer, calculates risk level (Low/Medium/High/Critical) and AI score (0-100)
  - Based on credit score, payment history, overdue invoices, disputed issues, and outstanding debt
  - Provides recommended credit limit
  - Can be generated on-demand with "Generate Report" button
  - Calculated dynamically from real buyer data, not estimates
- Credit Score Display: Circular progress indicator showing buyer's credit score with color coding
- Blacklist Feature: Suppliers can blacklist buyers with bad credit, removes them from active buyer lists

INVOICE MANAGEMENT:
- Invoice Statuses: PENDING, PAID, DUE_SOON, OVERDUE_3, OVERDUE_7, DEFAULTED
- Suppliers can create invoices for their buyers
- Buyers can view invoices they need to pay
- Invoices show amount, due date, payment term, and status
- Amounts are in Indonesian Rupiah (Rp)
- Invoice filtering by status and search functionality available

ISSUE REPORTING:
- Users can report issues about buyers/suppliers (quality problems, payment delays, delivery issues, etc.)
- Issue statuses: OPEN, IN_PROGRESS, RESOLVED
- Both buyers and suppliers can create and track issues
- Issues affect credit scores and reliability scores

SEARCH FUNCTIONALITY (/search):
- Search for buyers or suppliers by User ID (BJ#### for buyers, SP#### for suppliers) or by category
- Category filtering: Fresh Food, Frozen Food, Dry Groceries, Beverages
- Weather-aware search: Shows weather impact status for suppliers (Normal, Moderate Impact, High Impact)
- Credit score filtering available
- For buyers: Shows suppliers by category with reliability scores
- For suppliers: Shows buyers by category with credit scores

COLLECTIONS MANAGEMENT (SUPPLIERS ONLY - /collections):
- View collection attempt history with payment reminders
- Collection statistics and metrics
- Automated payment reminders via WhatsApp
- Track collection status and outcomes

RISK MONITOR (/risk-monitor):
- Weather-based risk assessment for suppliers
- Regional weather impact monitoring
- Helps buyers identify suppliers affected by weather events
- Shows weather status: Normal, Moderate Impact, High Impact

DASHBOARD (/dashboard):
- Credit Score/Reliability Score overview with metrics breakdown
- Recent invoices/ongoing orders
- Score history charts with trends
- Quick access to key actions

PROFILE MANAGEMENT (/profile):
- View and edit business information
- Update contact details
- Manage account settings

NAVIGATION GUIDELINES (CRITICAL):
- Use ONLY the page paths and descriptions provided below
- When suggesting navigation, use the EXACT page path format (e.g., "/dashboard", "/invoices", "/issues/new")
- Provide clear, specific navigation instructions

Available Pages for ${context.userType}:
${pagesList}

Common Navigation Scenarios:
- View credit score/dashboard → "/dashboard"
- View or create invoices → "/invoices" or "/invoices/new"
- View or report issues → "/issues" or "/issues/new"
- Search for buyers/suppliers → "/search"
- View/edit profile → "/profile"
${context.userType === 'SUPPLIER' ? `- Manage buyers (blacklist, potential buyers, AI risk assessment) → "/buyer-registry"\n- Collections management → "/collections"` : ''}
- Monitor risks/weather → "/risk-monitor"

When suggesting navigation:
1. Use the EXACT page path from the list above
2. Explain what the user can do on that page
3. Be specific: "Go to the Dashboard page (/dashboard) to see your credit score overview" not just "Check your dashboard"
4. If the page doesn't exist in the list above, don't suggest it

User Context:
- User ID: ${context.userId}
- User Type: ${context.userType}
- Business Name: ${context.businessName}
- Credit Score: ${context.creditScore}
- Total Invoices: ${context.invoices.length}
- Total Issues: ${context.issues.length}
${pageContext ? `\nCurrent Page Context:\n${pageContext}` : ''}

Data Source:
- All invoice and issue data is provided in the context below
- Invoice amounts are in Indonesian Rupiah (Rp)
- Dates are in ISO format
- Status values are: PENDING, PAID, DUE_SOON, OVERDUE_3, OVERDUE_7, DEFAULTED

IMPORTANT FEATURE KNOWLEDGE:
- When users ask about "blacklist", "blacklisted buyers", or "remove buyer" → Refer to Buyer Registry (/buyer-registry) and explain the Remove/Restore functionality
- When users ask about "risk assessment", "AI assessment", or "buyer risk" → Explain the AI Risk Assessment feature in Buyer Registry
- When users ask about "potential buyers" or "add buyer" → Explain the Potential Buyers tab and Add functionality
- When users ask about "credit score" → Explain it's calculated from payment history, invoices, and issues, and show on dashboard/buyer registry
- When users ask about "collections" or "payment reminders" → Direct to Collections page (/collections) for suppliers
- When users ask about "weather" or "risk monitor" → Explain Risk Monitor page (/risk-monitor) and weather impact features
- When users ask about searching → Explain Search page (/search) with category and weather filtering
- NEVER say "I don't know what you're talking about" - Instead, explain the feature if it exists, or guide them to where they can find it

Formatting Instructions:
- Use *word* to make text bold (e.g., *Important* becomes bold)
- Use this sparingly to emphasize key points, numbers, or important information

Important: Always respond in natural, conversational language. When answering questions about data, quote the exact numbers from the context. For navigation suggestions, use the exact page paths listed above. Be knowledgeable about ALL platform features and never claim ignorance - explain features confidently or guide users to find the information.`

    // Build messages for OpenAI
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: `IMPORTANT: Use ONLY the data provided below. Do not make assumptions.

User Context:
- User ID: ${context.userId} (Type: ${context.userType})
- Business: ${context.businessName}
- Credit Score: ${context.creditScore}/100

Invoices (${context.invoices.length} total):
${context.invoices.length > 0 
  ? context.invoices.map(inv => `- ${inv.number}: Rp ${inv.amount.toLocaleString('id-ID')}, Status: ${inv.status}, Due: ${new Date(inv.dueDate).toLocaleDateString('id-ID')}, Role: ${inv.role}`).join('\n')
  : '- No invoices found'}

Issues (${context.issues.length} total):
${context.issues.length > 0
  ? context.issues.map(issue => `- Type: ${issue.type}, Status: ${issue.status}, Role: ${issue.role}${issue.description ? `, Description: ${issue.description.substring(0, 100)}${issue.description.length > 100 ? '...' : ''}` : ''}`).join('\n')
  : '- No issues found'}

${pageContext ? `\nCurrent Page: ${pageContext}\n` : ''}
${navigationSuggestions.length > 0 ? `Suggested Pages Based on Query:\n${navigationSuggestions.map(p => `- ${p.path}: ${p.name} - ${p.description}`).join('\n')}\n` : ''}

User question: ${message}

REMEMBER: 
- Only answer based on the data above. If the data doesn't contain the answer, say so clearly.
- For navigation, use EXACT page paths from the system prompt.`,
      },
    ]

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4', // Upgraded from 'gpt-4o-mini' to 'gpt-4' for better accuracy
      messages,
      temperature: 0.3, // Reduced from 0.7 for more accurate, factual responses
      max_tokens: 500,
    })

    const response = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.'

    return NextResponse.json({
      response,
    })
  } catch (error) {
    console.error('[API] Chatbot error:', error)
    
    // Provide more detailed error information in development
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? `Error: ${errorMessage}` 
      : 'Failed to process message'
    
    return NextResponse.json(
      {
        error: errorDetails,
        response: 'I encountered an error processing your message. Please try again.',
      },
      { status: 500 }
    )
  }
}


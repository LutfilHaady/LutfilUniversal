import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractRegionFromAddress } from '@/lib/utils/region-extraction'

/**
 * Category normalization map: Maps human-readable DB labels to frontend slug values
 * This ensures API always returns normalized slugs, regardless of DB format
 */
const CATEGORY_NORMALIZATION_MAP: Record<string, string> = {
  // Fresh Food variations
  'Fresh Food': 'fresh-food',
  'fresh food': 'fresh-food',
  'Fresh': 'fresh-food',
  'Fresh Vegetables': 'fresh-food',
  'fresh vegetables': 'fresh-food',
  'Organic Produce': 'fresh-food',
  'organic produce': 'fresh-food',
  'Meat': 'fresh-food',
  'meat': 'fresh-food',
  'Poultry': 'fresh-food',
  'poultry': 'fresh-food',
  'Seafood': 'fresh-food',
  'seafood': 'fresh-food',
  'Fresh Fish': 'fresh-food',
  'fresh fish': 'fresh-food',
  
  // Frozen Food variations
  'Frozen Food': 'frozen-food',
  'frozen food': 'frozen-food',
  'Frozen': 'frozen-food',
  'frozen': 'frozen-food',
  'Frozen Seafood': 'frozen-food',
  'frozen seafood': 'frozen-food',
  'Ice Cream': 'frozen-food',
  'ice cream': 'frozen-food',
  
  // Dry Groceries variations
  'Dry Groceries': 'dry-groceries',
  'dry groceries': 'dry-groceries',
  'Groceries': 'dry-groceries',
  'groceries': 'dry-groceries',
  'Dry': 'dry-groceries',
  'dry': 'dry-groceries',
  'Spices': 'dry-groceries',
  'spices': 'dry-groceries',
  'Condiments': 'dry-groceries',
  'condiments': 'dry-groceries',
  
  // Beverages variations
  'Beverages': 'beverages',
  'beverages': 'beverages',
  'Beverage': 'beverages',
  'beverage': 'beverages',
  'Drink': 'beverages',
  'drink': 'beverages',
  'Juice': 'beverages',
  'juice': 'beverages',
  'Mineral Water': 'beverages',
  'mineral water': 'beverages',
  
  // Bakery variations
  'Bakery': 'bakery',
  'bakery': 'bakery',
  'Pastry': 'bakery',
  'pastry': 'bakery',
  'Bread': 'bakery',
  'bread': 'bakery',
  
  // Packaging variations
  'Packaging': 'packaging-disposables',
  'packaging': 'packaging-disposables',
  'Disposables': 'packaging-disposables',
  'disposables': 'packaging-disposables',
  'Utensils': 'packaging-disposables',
  'utensils': 'packaging-disposables',
  
  // Cleaning variations
  'Cleaning': 'cleaning-sanitation',
  'cleaning': 'cleaning-sanitation',
  'Sanitation': 'cleaning-sanitation',
  'sanitation': 'cleaning-sanitation',
  
  // Household variations
  'Household': 'household-general',
  'household': 'household-general',
  'General': 'household-general',
  'general': 'household-general',
  
  // Kitchen Equipment variations
  'Kitchen Equipment': 'kitchen-equipment',
  'kitchen equipment': 'kitchen-equipment',
  'Equipment': 'kitchen-equipment',
  'equipment': 'kitchen-equipment',
  'Kitchen': 'kitchen-equipment',
  'kitchen': 'kitchen-equipment',
  'Tools': 'kitchen-equipment',
  'tools': 'kitchen-equipment',
}

/**
 * Normalizes a category label to its slug value
 */
function normalizeCategory(category: string): string | null {
  const trimmed = category.trim()
  // Try exact match first
  if (CATEGORY_NORMALIZATION_MAP[trimmed]) {
    return CATEGORY_NORMALIZATION_MAP[trimmed]
  }
  // Try case-insensitive match
  const lower = trimmed.toLowerCase()
  for (const [key, value] of Object.entries(CATEGORY_NORMALIZATION_MAP)) {
    if (key.toLowerCase() === lower) {
      return value
    }
  }
  return null
}

/**
 * GET /api/users/search
 * Search users by userId, businessName, or type
 */
export async function GET(request: NextRequest) {
  try {
    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      console.error('[API] DATABASE_URL is not set in environment variables')
      return NextResponse.json(
        {
          success: false,
          error: 'Database not configured',
          message: 'DATABASE_URL environment variable is missing. Please check your .env file.',
        },
        { status: 500 }
      )
    }

    // Note: Don't manually connect/disconnect with Supabase pooler
    // Prisma manages connections automatically with connection pooling

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') // 'BUYER' | 'SUPPLIER' | null (all)
    const supplierId = searchParams.get('supplierId') // For getting buyers of a specific supplier

    // If searching for suppliers without a query, return all suppliers
    if (type === 'SUPPLIER' && !query) {
      const users = await prisma.user.findMany({
        where: { type: 'SUPPLIER' },
        select: {
          id: true,
          userId: true,
          type: true,
          businessName: true,
          phoneNumber: true,
          address: true,
          regionsServed: true,
          creditScore: true,
          profileCompleted: true,
          preferredPaymentTerm: true,
          categories: true, // Include categories for category filtering
          createdAt: true,
        },
        orderBy: { businessName: 'asc' },
        take: 50,
      })

      // OPTIMIZATION: Fetch all invoices in a single query instead of N queries
      // This prevents connection pool exhaustion
      const supplierIds = users.map(u => u.id)
      const allInvoices = supplierIds.length > 0
        ? await prisma.invoice.findMany({
            where: { supplierId: { in: supplierIds } },
            select: {
              supplierId: true,
              status: true,
            },
          })
        : []

      // Group invoices by supplier ID for efficient lookup
      const invoicesBySupplier = new Map<string, typeof allInvoices>()
      allInvoices.forEach(inv => {
        const existing = invoicesBySupplier.get(inv.supplierId) || []
        existing.push(inv)
        invoicesBySupplier.set(inv.supplierId, existing)
      })

      // Process users with stats (using pre-fetched invoices)
      const usersWithStats = users.map((user) => {
        const invoices = invoicesBySupplier.get(user.id) || []

        const totalOrders = invoices.length
        const completedOrders = invoices.filter(inv => inv.status === 'PAID').length
        const onTimeDelivery = totalOrders > 0
          ? Math.round((completedOrders / totalOrders) * 100)
          : 0

        let reliabilityLabel = 'High Reliability'
        if (user.creditScore < 60) reliabilityLabel = 'Low Reliability'
        else if (user.creditScore < 75) reliabilityLabel = 'Medium Reliability'

        // Extract region from address if regionsServed is not available
        let regionsServed = user.regionsServed
        if (!regionsServed && user.address) {
          const extractedRegion = extractRegionFromAddress(user.address)
          if (extractedRegion) {
            regionsServed = extractedRegion
          }
        }

        // Normalize categories to always be an array (API contract guarantee)
        let categoriesArray: string[] = []
        const rawCategories = (user as any).categories
        
        if (rawCategories) {
          try {
            let parsedCategories: string[] = []
            
            // Handle different formats from DB
            if (typeof rawCategories === 'string') {
              const trimmed = rawCategories.trim()
              if (trimmed && trimmed !== '[]' && trimmed !== '') {
                // Try to parse as JSON array
                if (trimmed.startsWith('[')) {
                  const parsed = JSON.parse(trimmed)
                  parsedCategories = Array.isArray(parsed) ? parsed : []
                } else {
                  // Comma-separated string
                  parsedCategories = trimmed.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
                }
              }
            } else if (Array.isArray(rawCategories)) {
              // Already an array
              parsedCategories = rawCategories
            }
            
            // Normalize each category label to slug format
            categoriesArray = parsedCategories
              .map((cat: string) => normalizeCategory(cat))
              .filter((slug: string | null): slug is string => slug !== null) // Remove unmapped categories
            
          } catch (e) {
            // If parsing fails, default to empty array
            console.warn(`[API] Failed to parse categories for ${(user as any).userId}:`, e)
            categoriesArray = []
          }
        }

        return {
          ...user,
          categories: categoriesArray, // Always an array, never null/undefined
          reliabilityScore: user.creditScore,
          totalOrders,
          completedOrders,
          onTimeDelivery,
          reliabilityLabel,
          regionsServed: regionsServed || user.address || '',
        }
      })

      return NextResponse.json({
        success: true,
        users: usersWithStats,
        count: usersWithStats.length,
      })
    }

    // Build where clause for database query
    const where: any = {}

    if (type) {
      where.type = type
    }

    if (query) {
      where.OR = [
        { userId: { contains: query, mode: 'insensitive' } },
        { businessName: { contains: query, mode: 'insensitive' } },
        { phoneNumber: { contains: query } },
      ]
    }

    // If supplierId is provided, get buyers who have invoices with this supplier
    // Exclude placeholder invoices (used for potential buyers tracking)
    if (supplierId) {
      const supplier = await prisma.user.findUnique({
        where: { userId: supplierId },
      })

      if (supplier) {
        const invoices = await prisma.invoice.findMany({
          where: { 
            supplierId: supplier.id,
            // Exclude placeholder invoices - only show buyers with real invoices
            NOT: {
              invoiceNumber: {
                startsWith: 'PLACEHOLDER-',
              },
            },
          },
          select: { buyerId: true },
          distinct: ['buyerId'],
        })

        const buyerIds = invoices.map(inv => inv.buyerId)
        where.id = { in: buyerIds }
        where.type = 'BUYER'
      }
    }

    let users
    try {
      users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          userId: true,
          type: true,
          businessName: true,
          phoneNumber: true,
          address: true,
          regionsServed: true,
          creditScore: true,
          profileCompleted: true,
          preferredPaymentTerm: true,
          businessTypes: true, // Include businessTypes for category filtering (buyers)
          categories: true, // Include categories for category filtering (suppliers)
          businessRegistrationNumber: true, // Include NIB
          createdAt: true,
        },
        orderBy: { businessName: 'asc' },
        take: 50,
      })
    } catch (queryError) {
      console.error('[API] Database query failed:', queryError)
      const errorMessage = queryError instanceof Error ? queryError.message : 'Unknown query error'
      
      // Check for common Prisma errors
      if (errorMessage.includes('P1001') || errorMessage.includes('Can\'t reach database')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Database unreachable',
            message: 'Cannot connect to the database. Please check your DATABASE_URL and network connection.',
          },
          { status: 500 }
        )
      }
      
      if (errorMessage.includes('P2002') || errorMessage.includes('Unique constraint')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Database constraint error',
            message: errorMessage,
          },
          { status: 500 }
        )
      }
      
      if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Database schema mismatch',
            message: 'Table or column does not exist. Please run: npx prisma db pull && npx prisma generate',
            details: errorMessage,
          },
          { status: 500 }
        )
      }
      
      throw queryError // Re-throw if it's an unexpected error
    }

    // Batch invoice queries to avoid connection pool exhaustion
    // Get all invoices for buyers and suppliers in fewer queries
    const buyerIds = users.filter(u => u.type === 'BUYER').map(u => u.id)
    const supplierIds = users.filter(u => u.type === 'SUPPLIER').map(u => u.id)
    
    // Fetch all invoices in 2 queries instead of N queries
    const [buyerInvoices, supplierInvoices] = await Promise.all([
      buyerIds.length > 0 
        ? prisma.invoice.findMany({
            where: { buyerId: { in: buyerIds } },
          })
        : [],
      supplierIds.length > 0
        ? prisma.invoice.findMany({
            where: { supplierId: { in: supplierIds } },
          })
        : [],
    ])
    
    // Group invoices by buyer/supplier ID
    const invoicesByBuyerId = new Map<string, typeof buyerInvoices>()
    const invoicesBySupplierId = new Map<string, typeof supplierInvoices>()
    
    buyerInvoices.forEach(inv => {
      const existing = invoicesByBuyerId.get(inv.buyerId) || []
      existing.push(inv)
      invoicesByBuyerId.set(inv.buyerId, existing)
    })
    
    supplierInvoices.forEach(inv => {
      const existing = invoicesBySupplierId.get(inv.supplierId) || []
      existing.push(inv)
      invoicesBySupplierId.set(inv.supplierId, existing)
    })

    // Debug: Log what Prisma is returning
    if (users.length > 0) {
      console.log('\n[API] === Prisma Query Results ===')
      console.log(`[API] Total users from Prisma: ${users.length}`)
      users.slice(0, 3).forEach((user, index) => {
        console.log(`[API] User ${index + 1} (${user.userId}):`)
        console.log(`[API]   type: ${user.type}`)
        console.log(`[API]   categories:`, user.categories)
        console.log(`[API]   categories type:`, typeof user.categories)
        console.log(`[API]   hasCategories:`, 'categories' in user)
        console.log(`[API]   allKeys:`, Object.keys(user))
      })
      console.log('[API] === End Prisma Results ===\n')
    }

    // Process users with pre-fetched invoice data
    let supplierCount = 0 // Track supplier index for debug logging
    const usersWithStats = users.map((user) => {
      if (user.type === 'BUYER') {
        const invoices = invoicesByBuyerId.get(user.id) || []

        const totalInvoices = invoices.length
        const paidInvoices = invoices.filter(inv => inv.status === 'PAID').length
        const totalOutstanding = invoices
          .filter(inv => inv.status !== 'PAID')
          .reduce((sum, inv) => sum + Number(inv.amount), 0)

        const lastPaidInvoice = invoices
          .filter(inv => inv.paidAt)
          .sort((a, b) => (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0))[0]

        // Only use riskLevel from database (AI risk assessment) - no fallback calculation
        const riskLevel = user.riskLevel || null

        return {
          ...user,
          totalInvoices,
          paidInvoices,
          totalOutstanding,
          lastPaymentDate: lastPaidInvoice?.paidAt?.toISOString() || null,
          riskLevel,
        }
      } else {
        // Supplier stats
        const invoices = invoicesBySupplierId.get(user.id) || []

        const totalOrders = invoices.length
        const completedOrders = invoices.filter(inv => inv.status === 'PAID').length
        const onTimeDelivery = totalOrders > 0
          ? Math.round((completedOrders / totalOrders) * 100)
          : 0

        let reliabilityLabel = 'High Reliability'
        if (user.creditScore < 60) reliabilityLabel = 'Low Reliability'
        else if (user.creditScore < 75) reliabilityLabel = 'Medium Reliability'

        // Extract region from address if regionsServed is not available
        let regionsServed = user.regionsServed
        if (!regionsServed && user.address) {
          const extractedRegion = extractRegionFromAddress(user.address)
          if (extractedRegion) {
            regionsServed = extractedRegion
          }
        }

        // Normalize categories to always be an array (API contract guarantee)
        // This ensures frontend never sees null/undefined, always gets string[]
        let categoriesArray: string[] = []
        const rawCategories = (user as any).categories
        
        if (rawCategories) {
          try {
            let parsedCategories: string[] = []
            
            // Handle different formats from DB
            if (typeof rawCategories === 'string') {
              const trimmed = rawCategories.trim()
              if (trimmed && trimmed !== '[]' && trimmed !== '') {
                // Try to parse as JSON array
                if (trimmed.startsWith('[')) {
                  const parsed = JSON.parse(trimmed)
                  parsedCategories = Array.isArray(parsed) ? parsed : []
                } else {
                  // Comma-separated string
                  parsedCategories = trimmed.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
                }
              }
            } else if (Array.isArray(rawCategories)) {
              // Already an array
              parsedCategories = rawCategories
            }
            
            // Normalize each category label to slug format
            categoriesArray = parsedCategories
              .map((cat: string) => normalizeCategory(cat))
              .filter((slug: string | null): slug is string => slug !== null) // Remove unmapped categories
            
          } catch (e) {
            // If parsing fails, default to empty array
            console.warn(`[API] Failed to parse categories for ${(user as any).userId}:`, e)
            categoriesArray = []
          }
        }
        // If rawCategories is null/undefined/empty, categoriesArray stays as []
        
        // Build result object - categories is ALWAYS an array
        const result: any = {
          ...user,
          categories: categoriesArray, // Always an array, never null/undefined
          reliabilityScore: user.creditScore,
          totalOrders,
          completedOrders,
          onTimeDelivery,
          reliabilityLabel,
          regionsServed: regionsServed || user.address || '',
        }
        
        supplierCount++
        return result
      }
    })

    // Debug: Verify categories is in the final response
    if (usersWithStats.length > 0) {
      const firstSupplier = usersWithStats.find((u: any) => u.type === 'SUPPLIER')
      if (firstSupplier) {
        console.log(`[API] === Final API Response Check ===`)
        console.log(`[API] First supplier in response: ${firstSupplier.userId}`)
        console.log(`[API]   has categories key:`, 'categories' in firstSupplier)
        console.log(`[API]   categories value:`, firstSupplier.categories, 'type:', typeof firstSupplier.categories)
        console.log(`[API]   all keys:`, Object.keys(firstSupplier))
        console.log(`[API] === End Final Check ===\n`)
      }
    }
    
    return NextResponse.json({
      success: true,
      users: usersWithStats,
      count: usersWithStats.length,
    })
  } catch (error) {
    console.error('[API] User search error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    
    // Detailed error logging
    console.error('[API] Error details:', {
      name: errorName,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    })
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search users',
        message: errorMessage,
        errorType: errorName,
        hint: errorName === 'PrismaClientInitializationError' 
          ? 'Please run: npx prisma generate'
          : 'Check server logs for details',
      },
      { status: 500 }
    )
  }
}

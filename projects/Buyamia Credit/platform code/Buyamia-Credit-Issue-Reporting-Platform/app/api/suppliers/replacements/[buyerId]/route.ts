import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/suppliers/replacements/[buyerId]
 * Get replacement buyer recommendations based on similar business characteristics
 * but with better credit profiles
 * MOCK DATA - For demonstration purposes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { buyerId: string } }
) {
  try {
    const buyerId = params.buyerId?.toUpperCase()

    if (!buyerId) {
      return NextResponse.json(
        { error: 'buyerId is required' },
        { status: 400 }
      )
    }

    // Mock recommendations based on common buyer IDs
    const mockRecommendations = [
      {
        buyerId: 'BJ1300',
        businessName: 'Catering Bu Endang',
        creditScore: 92,
        riskLevel: 'Low Risk',
        businessTypes: ['Catering'],
        averagePurchaseVolume: '20-50M',
        orderFrequency: '1-2 per week',
        preferredPaymentTerm: 'NET14',
        yearsInOperation: 18,
        address: 'Jl. Pemuda No. 25, Surabaya, Jawa Timur',
        similarityScore: 85,
        relevanceScore: 92,
        matchDetails: {
          businessTypeMatch: 75,
          volumeMatch: 90,
          frequencyMatch: 80,
        },
      },
      {
        buyerId: 'BJ1234',
        businessName: 'Restoran Sunda Asli',
        creditScore: 88,
        riskLevel: 'Low Risk',
        businessTypes: ['Restaurant'],
        averagePurchaseVolume: '5-20M',
        orderFrequency: '2-3 per week',
        preferredPaymentTerm: 'NET7',
        yearsInOperation: 15,
        address: 'Jl. Braga No. 88, Bandung, Jawa Barat',
        similarityScore: 90,
        relevanceScore: 89,
        matchDetails: {
          businessTypeMatch: 95,
          volumeMatch: 85,
          frequencyMatch: 90,
        },
      },
      {
        buyerId: 'BJ1089',
        businessName: 'Cafe Modern Jakarta',
        creditScore: 82,
        riskLevel: 'Low Risk',
        businessTypes: ['Cafe'],
        averagePurchaseVolume: '<5M',
        orderFrequency: '5-7 per week',
        preferredPaymentTerm: 'NET7',
        yearsInOperation: 5,
        address: 'Jl. Senopati No. 45, Jakarta Selatan',
        similarityScore: 80,
        relevanceScore: 81,
        matchDetails: {
          businessTypeMatch: 85,
          volumeMatch: 75,
          frequencyMatch: 70,
        },
      },
      {
        buyerId: 'BJ1333',
        businessName: 'Bakery & Pastry Delima',
        creditScore: 80,
        riskLevel: 'Low Risk',
        businessTypes: ['Bakery'],
        averagePurchaseVolume: '5-20M',
        orderFrequency: '3-5 per week',
        preferredPaymentTerm: 'NET7',
        yearsInOperation: 7,
        address: 'Jl. Diponegoro No. 77, Semarang, Jawa Tengah',
        similarityScore: 75,
        relevanceScore: 78,
        matchDetails: {
          businessTypeMatch: 70,
          volumeMatch: 85,
          frequencyMatch: 90,
        },
      },
    ]

    return NextResponse.json({
      success: true,
      recommendations: mockRecommendations,
      count: mockRecommendations.length,
      originalBuyer: {
        buyerId: buyerId,
        businessName: 'Buyer to Replace',
        businessTypes: ['Restaurant', 'Hotel'],
        creditScore: 45,
      },
    })
  } catch (error) {
    console.error('[API] Replacements GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get replacement recommendations' },
      { status: 500 }
    )
  }
}

// Keep helper functions for potential future use but comment out database logic
/*
    // Find the buyer to replace
    const buyerToReplace = await prisma.user.findUnique({
      where: { userId: buyerId },
      include: {
        invoicesAsBuyer: {
          where: { supplierId: supplier.id },
        },
      },
    })

    if (!buyerToReplace || buyerToReplace.type !== 'BUYER') {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      )
    }

    // Get blacklisted buyer IDs for this supplier
    const blacklistEntries = await prisma.supplierBlacklist.findMany({
      where: { supplierId: supplier.id },
      select: { buyerId: true },
    })
    const blacklistedBuyerIds = new Set(blacklistEntries.map(e => e.buyerId))

    // Parse buyer's business types
    let buyerBusinessTypes: string[] = []
    try {
      buyerBusinessTypes = JSON.parse(buyerToReplace.businessTypes || '[]')
    } catch {
      buyerBusinessTypes = []
    }

    // Get all buyers that could be replacements
    const allBuyers = await prisma.user.findMany({
      where: {
        type: 'BUYER',
        id: { not: buyerToReplace.id }, // Exclude the buyer being replaced
        creditScore: { gte: 50 }, // Only buyers with credit score >= 50
      },
      include: {
        invoicesAsBuyer: true,
      },
    })

    // Get overdue invoices for all buyers
    const now = new Date()
    const overdueThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago

    // Filter and score potential replacements
    const recommendations = allBuyers
      .filter(buyer => {
        // Exclude blacklisted buyers
        if (blacklistedBuyerIds.has(buyer.id)) return false

        // Exclude buyers with overdue invoices
        const hasOverdue = buyer.invoicesAsBuyer.some(inv => {
          const dueDate = new Date(inv.dueDate)
          return dueDate < overdueThreshold && inv.status !== 'PAID'
        })
        if (hasOverdue) return false

        // Exclude high risk buyers
        if (buyer.creditScore < 50) return false

        return true
      })
      .map(buyer => {
        // Parse business types
        let buyerTypes: string[] = []
        try {
          buyerTypes = JSON.parse(buyer.businessTypes || '[]')
        } catch {
          buyerTypes = []
        }

        // Calculate similarity scores
        const businessTypeMatch = calculateBusinessTypeMatch(
          buyerBusinessTypes,
          buyerTypes
        )
        const volumeMatch = calculateVolumeMatch(
          buyerToReplace.averagePurchaseVolume,
          buyer.averagePurchaseVolume
        )
        const frequencyMatch = calculateFrequencyMatch(
          buyerToReplace.orderFrequency,
          buyer.orderFrequency
        )

        // Calculate risk level
        let riskLevel = 'Low Risk'
        if (buyer.creditScore < 50) riskLevel = 'High Risk'
        else if (buyer.creditScore < 70) riskLevel = 'Medium Risk'

        // Calculate overall score (weighted)
        const creditScoreWeight = 0.4
        const businessTypeWeight = 0.3
        const volumeWeight = 0.2
        const frequencyWeight = 0.1

        const normalizedCreditScore = buyer.creditScore / 100
        const relevanceScore =
          normalizedCreditScore * creditScoreWeight +
          businessTypeMatch * businessTypeWeight +
          volumeMatch * volumeWeight +
          frequencyMatch * frequencyWeight

        return {
          buyerId: buyer.userId,
          businessName: buyer.businessName,
          creditScore: buyer.creditScore,
          riskLevel,
          businessTypes: buyerTypes,
          averagePurchaseVolume: buyer.averagePurchaseVolume,
          orderFrequency: buyer.orderFrequency,
          preferredPaymentTerm: buyer.preferredPaymentTerm,
          yearsInOperation: buyer.yearsInOperation,
          address: buyer.address,
          similarityScore: Math.round(businessTypeMatch * 100),
          relevanceScore: Math.round(relevanceScore * 100),
          matchDetails: {
            businessTypeMatch: Math.round(businessTypeMatch * 100),
            volumeMatch: Math.round(volumeMatch * 100),
            frequencyMatch: Math.round(frequencyMatch * 100),
          },
        }
      })
      .filter(rec => rec.similarityScore > 0) // Only include buyers with some business type match
      .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance
      .slice(0, 10) // Return top 10 recommendations

    return NextResponse.json({
      success: true,
      recommendations,
      count: recommendations.length,
      originalBuyer: {
        buyerId: buyerToReplace.userId,
        businessName: buyerToReplace.businessName,
        businessTypes: buyerBusinessTypes,
        creditScore: buyerToReplace.creditScore,
      },
    })
  } catch (error) {
    console.error('[API] Replacements GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get replacement recommendations' },
      { status: 500 }
    )
  }
}

/**
 * Calculate business type similarity (0-1)
 */
function calculateBusinessTypeMatch(
  buyerTypes: string[],
  candidateTypes: string[]
): number {
  if (buyerTypes.length === 0 || candidateTypes.length === 0) return 0

  const buyerTypesLower = buyerTypes.map(t => t.toLowerCase())
  const candidateTypesLower = candidateTypes.map(t => t.toLowerCase())

  // Count matches
  const matches = buyerTypesLower.filter(bt =>
    candidateTypesLower.some(ct => ct.includes(bt) || bt.includes(ct))
  ).length

  // Return ratio of matches to total buyer types
  return matches / buyerTypes.length
}

/**
 * Calculate volume similarity (0-1)
 */
function calculateVolumeMatch(
  buyerVolume: string | null | undefined,
  candidateVolume: string | null | undefined
): number {
  if (!buyerVolume || !candidateVolume) return 0.5 // Neutral score if missing

  // Simple string matching for volume ranges
  const buyerVol = buyerVolume.toLowerCase()
  const candidateVol = candidateVolume.toLowerCase()

  if (buyerVol === candidateVol) return 1.0

  // Partial matches (e.g., both contain "20-50M")
  if (buyerVol.includes('50m+') && candidateVol.includes('50m+')) return 0.9
  if (buyerVol.includes('20-50m') && candidateVol.includes('20-50m')) return 0.9
  if (buyerVol.includes('5-20m') && candidateVol.includes('5-20m')) return 0.9
  if (buyerVol.includes('<5m') && candidateVol.includes('<5m')) return 0.9

  return 0.3 // Some similarity for different volumes
}

/**
 * Calculate frequency similarity (0-1)
 */
function calculateFrequencyMatch(
  buyerFrequency: string | null | undefined,
  candidateFrequency: string | null | undefined
): number {
  if (!buyerFrequency || !candidateFrequency) return 0.5 // Neutral score if missing

  const buyerFreq = buyerFrequency.toLowerCase()
  const candidateFreq = candidateFrequency.toLowerCase()

  if (buyerFreq === candidateFreq) return 1.0

  // Extract numbers from frequency strings (e.g., "3-5 per week" -> [3, 5])
  const buyerNums = buyerFreq.match(/\d+/g)?.map(Number) || []
  const candidateNums = candidateFreq.match(/\d+/g)?.map(Number) || []

  if (buyerNums.length > 0 && candidateNums.length > 0) {
    const buyerAvg = buyerNums.reduce((a, b) => a + b, 0) / buyerNums.length
    const candidateAvg =
      candidateNums.reduce((a, b) => a + b, 0) / candidateNums.length

    // Calculate similarity based on difference
    const diff = Math.abs(buyerAvg - candidateAvg)
    const maxDiff = Math.max(buyerAvg, candidateAvg, 1)
    return Math.max(0, 1 - diff / maxDiff)
  }

  return 0.3 // Some similarity if can't parse
}

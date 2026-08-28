/**
 * Script to create buyer BJ0045 and authorize them
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days
  
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      userAgent,
      ipAddress,
    }
  })
  
  return token
}

async function main() {
  try {
    console.log('🔐 Creating buyer BJ0045...')

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { userId: 'BJ0045' }
    })

    if (existing) {
      console.log('✅ User BJ0045 already exists')
    } else {
      // Create the buyer
      const buyer = await prisma.user.create({
        data: {
          userId: 'BJ0045',
          type: 'BUYER',
          businessName: 'PT. Buyer Makmur',
          phoneNumber: '+6281234568999',
          address: 'Jl. Kebon Jeruk No. 45, Jakarta Barat',
          creditScore: 75,
          profileCompleted: true,
          inviteStatus: 'ACTIVE',
          businessTypes: JSON.stringify(['Restaurant', 'Cafe']),
          ownerName: 'John Doe',
          averagePurchaseVolume: '5-20M',
          orderFrequency: '3-5 per week',
          preferredPaymentTerm: 'Net 14',
          yearsInOperation: 5,
          contactPersonName: 'Jane Doe',
          contactPersonPhone: '+6281234568002',
          contactPersonEmail: 'jane@buyermakmur.com',
        }
      })
      console.log(`✅ Created buyer: ${buyer.businessName}`)
    }

    // Get the user (either existing or newly created)
    const user = await prisma.user.findUnique({
      where: { userId: 'BJ0045' }
    })

    if (!user) {
      throw new Error('Failed to create or find user BJ0045')
    }

    // Create session
    const sessionToken = await createSession(user.id)
    console.log(`✅ Session created: ${sessionToken.substring(0, 16)}...`)

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), profileCompleted: true }
    })

    console.log(`\n✅ User BJ0045 authorized successfully!`)
    console.log(`   Session token: ${sessionToken}`)
    console.log(`   Cookie name: buyamia_credit_session`)
    console.log(`\n💡 To use this session:`)
    console.log(`   1. Open browser DevTools (F12)`)
    console.log(`   2. Go to Application/Storage > Cookies`)
    console.log(`   3. Add cookie: buyamia_credit_session = ${sessionToken}`)
    console.log(`   4. Refresh the page`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


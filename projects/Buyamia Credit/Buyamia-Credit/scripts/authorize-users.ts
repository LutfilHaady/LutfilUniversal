/**
 * Script to authorize users SP0023 and BJ0045
 * 
 * Usage: npx ts-node --compiler-options {"module":"CommonJS"} scripts/authorize-users.ts
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Session creation function (copied from lib/auth to avoid import issues)
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

async function authorizeUser(userId: string) {
  try {
    console.log(`\n🔐 Authorizing user: ${userId}...`)

    // Find user
    const user = await prisma.user.findUnique({
      where: { userId: userId.toUpperCase() }
    })

    if (!user) {
      console.error(`❌ User ${userId} not found in database`)
      return null
    }

    console.log(`✅ Found user: ${user.businessName} (${user.type})`)

    // Check if profile is completed
    if (!user.profileCompleted) {
      console.warn(`⚠️  User profile is not completed. Updating profileCompleted to true...`)
      await prisma.user.update({
        where: { id: user.id },
        data: { profileCompleted: true }
      })
    }

    // Create session
    const sessionToken = await createSession(user.id)
    console.log(`✅ Session created: ${sessionToken.substring(0, 16)}...`)

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    console.log(`✅ User ${userId} authorized successfully!`)
    console.log(`   Session token: ${sessionToken}`)
    console.log(`   Cookie name: buyamia_credit_session`)
    console.log(`   Set this cookie in your browser to be logged in as ${userId}`)

    return { userId: user.userId, sessionToken, user }
  } catch (error) {
    console.error(`❌ Error authorizing ${userId}:`, error)
    return null
  }
}

async function main() {
  console.log('🚀 Starting user authorization...\n')

  const users = ['SP0023', 'BJ0045']
  const results = []

  for (const userId of users) {
    const result = await authorizeUser(userId)
    if (result) {
      results.push(result)
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   Authorized ${results.length} out of ${users.length} users`)

  if (results.length > 0) {
    console.log('\n💡 To use these sessions:')
    console.log('   1. Open browser DevTools (F12)')
    console.log('   2. Go to Application/Storage > Cookies')
    console.log('   3. Add cookie: buyamia_credit_session = <session_token>')
    console.log('   4. Refresh the page')
    console.log('\n   Or use the API endpoint:')
    console.log('   POST /api/auth/dev-authorize')
    console.log('   Body: { "userId": "SP0023" } or { "userId": "BJ0045" }')
  }

  await prisma.$disconnect()
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })


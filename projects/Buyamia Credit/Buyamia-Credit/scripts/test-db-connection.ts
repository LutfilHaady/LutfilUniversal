/**
 * Test Database Connection Script
 * 
 * Tests if Prisma can connect to Supabase and retrieve data
 */

import { prisma } from '../lib/prisma'

async function testConnection() {
  console.log('🔍 Testing database connection...\n')
  
  try {
    // Test 1: Basic connection
    console.log('Test 1: Checking database connection...')
    await prisma.$connect()
    console.log('✅ Database connection successful!\n')
    
    // Test 2: Query users
    console.log('Test 2: Querying users...')
    const userCount = await prisma.user.count()
    console.log(`✅ Found ${userCount} users in database\n`)
    
    // Test 3: Get sample user
    console.log('Test 3: Fetching sample user...')
    const sampleUser = await prisma.user.findFirst({
      select: {
        userId: true,
        type: true,
        businessName: true,
        phoneNumber: true,
      },
    })
    
    if (sampleUser) {
      console.log('✅ Sample user found:')
      console.log(`   - User ID: ${sampleUser.userId}`)
      console.log(`   - Type: ${sampleUser.type}`)
      console.log(`   - Business: ${sampleUser.businessName}`)
      console.log(`   - Phone: ${sampleUser.phoneNumber}\n`)
    } else {
      console.log('⚠️  No users found in database (empty database)\n')
    }
    
    // Test 4: Query invoices
    console.log('Test 4: Querying invoices...')
    const invoiceCount = await prisma.invoice.count()
    console.log(`✅ Found ${invoiceCount} invoices in database\n`)
    
    // Test 5: Check table structure
    console.log('Test 5: Verifying table structure...')
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `
    
    console.log(`✅ Found ${tables.length} tables:`)
    tables.forEach(table => {
      console.log(`   - ${table.tablename}`)
    })
    console.log()
    
    // Summary
    console.log('='.repeat(50))
    console.log('✅ ALL TESTS PASSED!')
    console.log('='.repeat(50))
    console.log('\nDatabase is properly connected and ready to use! 🎉\n')
    
  } catch (error) {
    console.error('\n❌ DATABASE CONNECTION FAILED!\n')
    console.error('Error details:')
    console.error(error)
    
    if (error instanceof Error) {
      const errorName = error.name
      const errorMessage = error.message
      
      console.error('\n🔍 Troubleshooting:')
      
      if (errorName === 'PrismaClientInitializationError') {
        console.error('   - Check DATABASE_URL in .env file')
        console.error('   - Verify Supabase connection string')
        console.error('   - Ensure database is accessible')
        console.error('   - Run: npx prisma generate')
      } else if (errorMessage.includes('does not exist')) {
        console.error('   - Table might not exist in database')
        console.error('   - Run: npx prisma db pull')
        console.error('   - Or create tables in Supabase first')
      } else if (errorMessage.includes('timeout')) {
        console.error('   - Network connection issue')
        console.error('   - Check Supabase firewall settings')
        console.error('   - Verify DATABASE_URL host/port')
      } else {
        console.error('   - Check error message above')
        console.error('   - Verify DATABASE_URL format')
        console.error('   - Ensure Prisma client is generated: npx prisma generate')
      }
    }
    
    console.error('\n')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testConnection()


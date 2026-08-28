/**
 * Test script for Collections Cron Job
 * 
 * Usage:
 *   node scripts/test-collections-cron.js
 * 
 * This tests the cron endpoint locally or on production
 */

const API_URL = process.env.API_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || ''

async function testCronJob() {
  console.log('🧪 Testing Collections Cron Job...\n')
  console.log(`📍 Endpoint: ${API_URL}/api/cron/collections\n`)

  try {
    const headers = {
      'Content-Type': 'application/json',
    }

    // Add auth header if CRON_SECRET is set
    if (CRON_SECRET) {
      headers['Authorization'] = `Bearer ${CRON_SECRET}`
      console.log('🔐 Using CRON_SECRET for authentication\n')
    } else {
      console.log('⚠️  No CRON_SECRET set (running without auth)\n')
    }

    const response = await fetch(`${API_URL}/api/cron/collections`, {
      method: 'GET',
      headers,
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Cron job executed successfully!\n')
      console.log('📊 Results:')
      console.log(`   - Processed: ${data.processed || 0} invoices`)
      console.log(`   - Attempted: ${data.attempted || 0} collections`)
      console.log(`   - Skipped: ${data.skipped || 0} invoices`)
      console.log(`   - Errors: ${data.errors || 0} errors`)
      console.log(`   - Timestamp: ${data.timestamp}\n`)
      
      if (data.attempted > 0) {
        console.log('💡 Check your console logs for mock messages/calls')
        console.log('💡 Check database for CollectionAttempt records\n')
      } else {
        console.log('ℹ️  No invoices needed collection at this time\n')
      }
    } else {
      console.error('❌ Cron job failed!\n')
      console.error('Error:', data.error || data.message || 'Unknown error')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Failed to call cron endpoint:\n')
    console.error(error.message)
    
    if (error.message.includes('fetch')) {
      console.error('\n💡 Make sure your dev server is running:')
      console.error('   npm run dev\n')
    }
    
    process.exit(1)
  }
}

// Run the test
testCronJob()


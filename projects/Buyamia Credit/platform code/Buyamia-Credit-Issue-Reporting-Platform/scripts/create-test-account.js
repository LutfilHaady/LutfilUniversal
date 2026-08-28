// Script to create a test buyer account in Buyamia DB for Credit testing
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgresql://postgres:PremiumB2BM4rk3tplac3!!!@postgres16-rw.dlt.buyamia.com:5432/buyamia_dlt_dev?sslmode=disable'
})

// Test account details - CHANGE THESE
const TEST_EMAIL = 'lutfi.credit.test@yopmail.com'
const TEST_PHONE = '+6281234567890'  // Your phone for OTP
const TEST_FIRST_NAME = 'Lutfi'
const TEST_LAST_NAME = 'Test'

async function main() {
  const client = await pool.connect()
  
  try {
    console.log('Creating test account in Buyamia database...\n')
    
    // Check if email already exists
    const existing = await client.query(
      'SELECT id, email FROM public.users WHERE email = $1',
      [TEST_EMAIL]
    )
    
    if (existing.rows.length > 0) {
      console.log('⚠️  Account already exists with this email!')
      console.log(`   User ID: ${existing.rows[0].id}`)
      console.log(`   Email: ${existing.rows[0].email}`)
      return
    }
    
    await client.query('BEGIN')
    
    // 1. Create user
    const userResult = await client.query(`
      INSERT INTO public.users (
        id, email, phone_number, first_name, last_name, 
        status, is_verified, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        'active', true, NOW(), NOW()
      ) RETURNING id, email, phone_number
    `, [TEST_EMAIL, TEST_PHONE, TEST_FIRST_NAME, TEST_LAST_NAME])
    
    const userId = userResult.rows[0].id
    console.log('✅ Created user:')
    console.log(`   ID: ${userId}`)
    console.log(`   Email: ${TEST_EMAIL}`)
    console.log(`   Phone: ${TEST_PHONE}`)
    
    // 2. Create buyer record
    const buyerResult = await client.query(`
      INSERT INTO public.buyers (
        id, user_id, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, 'active', NOW(), NOW()
      ) RETURNING id
    `, [userId])
    
    console.log(`✅ Created buyer record: ${buyerResult.rows[0].id}`)
    
    await client.query('COMMIT')
    
    console.log('\n🎉 Test account created successfully!')
    console.log('\n📝 Use these credentials on Buyamia Credit:')
    console.log(`   Email: ${TEST_EMAIL}`)
    console.log(`   Phone: ${TEST_PHONE}`)
    
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

main()

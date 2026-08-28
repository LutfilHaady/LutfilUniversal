// Script to create a test SUPPLIER account in Buyamia DB for Credit testing
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgresql://postgres:PremiumB2BM4rk3tplac3!!!@postgres16-rw.dlt.buyamia.com:5432/buyamia_dlt_dev?sslmode=disable'
})

// Test supplier account details - CHANGE THESE
const TEST_EMAIL = 'supplier.credit.test@yopmail.com'
const TEST_PHONE = '+6281234567891'  // Different phone for supplier
const TEST_BUSINESS_NAME = 'Test Supplier Co.'

async function main() {
  const client = await pool.connect()
  
  try {
    console.log('Creating test SUPPLIER account in Buyamia database...\n')
    
    // Check if email already exists in sellers
    const existing = await client.query(
      'SELECT id, email, name FROM public.sellers WHERE email = $1',
      [TEST_EMAIL]
    )
    
    if (existing.rows.length > 0) {
      console.log('⚠️  Supplier already exists with this email!')
      console.log(`   Seller ID: ${existing.rows[0].id}`)
      console.log(`   Name: ${existing.rows[0].name}`)
      console.log(`   Email: ${existing.rows[0].email}`)
      console.log('\n📝 Use these credentials on Buyamia Credit:')
      console.log(`   Email: ${TEST_EMAIL}`)
      console.log(`   Phone: ${TEST_PHONE}`)
      return
    }
    
    await client.query('BEGIN')
    
    // Create seller record directly (sellers table has its own email/phone)
    const sellerResult = await client.query(`
      INSERT INTO public.sellers (
        id, name, slug, email, primary_phone,
        status, is_onboarded, is_premium, is_public,
        available_balance, pending_balance,
        company_type_id,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 
        $1,                           -- name
        $2,                           -- slug
        $3,                           -- email
        $4,                           -- primary_phone
        'active',                     -- status
        true,                         -- is_onboarded
        false,                        -- is_premium
        true,                         -- is_public
        0,                            -- available_balance
        0,                            -- pending_balance
        (SELECT id FROM public.company_types LIMIT 1), -- company_type_id
        NOW(), 
        NOW()
      ) RETURNING id, name, email, primary_phone
    `, [TEST_BUSINESS_NAME, 'test-supplier-co', TEST_EMAIL, TEST_PHONE])
    
    const seller = sellerResult.rows[0]
    console.log('✅ Created seller:')
    console.log(`   ID: ${seller.id}`)
    console.log(`   Name: ${seller.name}`)
    console.log(`   Email: ${seller.email}`)
    console.log(`   Phone: ${seller.primary_phone}`)
    
    await client.query('COMMIT')
    
    console.log('\n🎉 Test SUPPLIER account created successfully!')
    console.log('\n📝 Use these credentials on Buyamia Credit:')
    console.log(`   Email: ${TEST_EMAIL}`)
    console.log(`   OR Phone: ${TEST_PHONE}`)
    
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', err.message)
    console.error(err)
  } finally {
    client.release()
    await pool.end()
  }
}

main()

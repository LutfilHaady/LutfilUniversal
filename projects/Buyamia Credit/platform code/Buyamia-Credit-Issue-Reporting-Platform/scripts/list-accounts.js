// Quick script to list accounts from Buyamia DB - sorted by most recent
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgresql://postgres:PremiumB2BM4rk3tplac3!!!@postgres16-rw.dlt.buyamia.com:5432/buyamia_dlt_dev?sslmode=disable'
})

async function main() {
  try {
    console.log('Querying Buyamia database (sorted by MOST RECENT)...\n')
    
    // Get buyers - most recent first
    const buyers = await pool.query(`
      SELECT 
        u.email, 
        u.phone_number, 
        u.first_name || ' ' || u.last_name as name,
        o.name as business_name,
        u.created_at
      FROM public.buyers b 
      JOIN public.users u ON b.user_id = u.id 
      LEFT JOIN procurement.organization_members om ON u.id = om.user_id AND om.deleted_at IS NULL
      LEFT JOIN procurement.organizations o ON om.organization_id = o.id AND o.deleted_at IS NULL
      WHERE b.deleted_at IS NULL AND u.deleted_at IS NULL 
      ORDER BY u.created_at DESC
      LIMIT 15
    `)
    
    console.log('=== MOST RECENT BUYER ACCOUNTS ===')
    buyers.rows.forEach((r, i) => {
      const date = new Date(r.created_at).toLocaleString()
      console.log(`${i+1}. ${r.email || 'N/A'}`)
      console.log(`   Phone: ${r.phone_number || 'N/A'}`)
      console.log(`   Name: ${r.name} | Business: ${r.business_name || 'N/A'}`)
      console.log(`   Created: ${date}`)
      console.log('')
    })
    
    // Get sellers - most recent first
    const sellers = await pool.query(`
      SELECT 
        email, 
        primary_phone, 
        name as business_name,
        created_at
      FROM public.sellers 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC
      LIMIT 10
    `)
    
    console.log('=== MOST RECENT SELLER/SUPPLIER ACCOUNTS ===')
    sellers.rows.forEach((r, i) => {
      const date = new Date(r.created_at).toLocaleString()
      console.log(`${i+1}. ${r.email || 'N/A'}`)
      console.log(`   Phone: ${r.primary_phone || 'N/A'}`)
      console.log(`   Business: ${r.business_name}`)
      console.log(`   Created: ${date}`)
      console.log('')
    })
    
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await pool.end()
  }
}

main()

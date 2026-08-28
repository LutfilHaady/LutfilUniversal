/**
 * Update Regions Served Script
 * 
 * Updates regionsServed for all suppliers based on seed data
 * This is a lighter operation that doesn't clear all data
 */

import { prisma } from '../lib/prisma'

const supplierRegionsMap: Record<string, string> = {
  'SP0023': 'Jakarta, Bandung, Surabaya',
  'SP0045': 'Jakarta, Tangerang, Bekasi',
  'SP0067': 'Jakarta',
  'SP0089': 'Jakarta, Bandung, Yogyakarta',
  'SP0101': 'Jakarta, Surabaya',
  'SP0150': 'All Indonesia',
  'SP0175': 'Jakarta, Bogor, Depok, Tangerang, Bekasi',
  'SP0200': 'Jakarta, Bandung',
  'SP0225': 'Jakarta, Surabaya, Medan',
  'SP0250': 'Jakarta, Surabaya, Makassar',
  'SP0275': 'Jakarta, Tangerang',
  'SP0300': 'All Indonesia',
}

async function main() {
  console.log('🌱 Updating regionsServed for suppliers...\n')

  let updated = 0
  let skipped = 0
  let notFound = 0

  for (const [userId, regionsServed] of Object.entries(supplierRegionsMap)) {
    try {
      const supplier = await prisma.user.findUnique({
        where: { userId },
      })

      if (!supplier) {
        console.log(`⚠️  Supplier ${userId} not found`)
        notFound++
        continue
      }

      if (supplier.regionsServed === regionsServed) {
        console.log(`✓ ${userId} already has correct regionsServed`)
        skipped++
        continue
      }

      await prisma.user.update({
        where: { userId },
        data: { regionsServed },
      })

      console.log(`✅ Updated ${userId}: ${regionsServed}`)
      updated++
    } catch (error) {
      console.error(`❌ Error updating ${userId}:`, error)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Summary:')
  console.log(`   ✅ Updated: ${updated}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  console.log(`   ⚠️  Not Found: ${notFound}`)
  console.log('='.repeat(50))
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })


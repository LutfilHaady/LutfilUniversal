/**
 * Test WhatsApp Collection Script
 * 
 * Finds an invoice and triggers a WhatsApp collection message
 */

import { prisma } from '../lib/prisma'

async function testWhatsAppCollection() {
  console.log('🔍 Testing WhatsApp Collection...\n')
  
  try {
    // Find an invoice that needs collection
    const invoice = await prisma.invoice.findFirst({
      where: {
        status: {
          in: ['PENDING', 'DUE_SOON', 'OVERDUE_3', 'OVERDUE_7'],
        },
      },
      include: {
        buyer: true,
        supplier: true,
      },
    })
    
    if (!invoice) {
      console.log('❌ No invoices found that need collection')
      console.log('💡 Create an invoice first, or use an existing invoice ID\n')
      return
    }
    
    console.log('✅ Found invoice:')
    console.log(`   - Invoice ID: ${invoice.id}`)
    console.log(`   - Invoice Number: ${invoice.invoiceNumber}`)
    console.log(`   - Buyer: ${invoice.buyer.businessName}`)
    console.log(`   - Buyer Phone: ${invoice.buyer.phoneNumber}`)
    console.log(`   - Amount: Rp ${invoice.amount.toLocaleString('id-ID')}`)
    console.log(`   - Due Date: ${invoice.dueDate.toLocaleDateString('id-ID')}`)
    console.log(`   - Status: ${invoice.status}\n`)
    
    // Trigger collection via API
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    console.log(`📤 Triggering collection via API: ${appUrl}/api/collections/trigger\n`)
    
    const response = await fetch(`${appUrl}/api/collections/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: invoice.id,
        attemptType: 'whatsapp_message',
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('❌ Error triggering collection:')
      console.log(errorText)
      return
    }
    
    const result = await response.json()
    console.log('✅ Collection triggered successfully!')
    console.log(JSON.stringify(result, null, 2))
    console.log('\n📱 Check the buyer\'s WhatsApp for the message!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testWhatsAppCollection()


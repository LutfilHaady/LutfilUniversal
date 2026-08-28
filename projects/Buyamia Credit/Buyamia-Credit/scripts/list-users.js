const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  
  try {
    const users = await prisma.user.findMany({
      select: {
        userId: true,
        phoneNumber: true,
        businessName: true,
        type: true,
        profileCompleted: true,
        inviteStatus: true,
      }
    })
    
    console.log('\n=== Users in Database ===\n')
    
    if (users.length === 0) {
      console.log('No users found.')
    } else {
      users.forEach(u => {
        console.log(`${u.userId} | ${u.type} | ${u.phoneNumber} | ${u.businessName}`)
        console.log(`  Profile: ${u.profileCompleted ? 'Complete' : 'Incomplete'} | Status: ${u.inviteStatus}`)
        console.log('')
      })
    }
    
    console.log(`Total: ${users.length} user(s)`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)

import { prisma } from '../lib/prisma'

async function main() {
  console.log('🌱 Seeding database with comprehensive data...')

  // Clear only invoices and collection attempts, keep existing users
  await prisma.collectionAttempt.deleteMany()
  await prisma.invoice.deleteMany()
  console.log('🗑️ Cleared invoices and collection attempts (preserving users)')

  // ============================================
  // CREATE 20+ SUPPLIERS COVERING ALL CATEGORIES
  // ============================================
  const suppliersData = [
    {
      userId: 'SP0023',
      businessName: 'PT. Supplier Sejahtera',
      phoneNumber: '+6281234567001',
      address: 'Jl. Gatot Subroto No. 456, Jakarta Selatan',
      creditScore: 85,
      categories: JSON.stringify(['Fresh Food', 'Frozen Food', 'Dry Groceries']),
      regionsServed: 'Jakarta, Bandung, Surabaya',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7', 'Net 14', 'Net 30']),
    },
    {
      userId: 'SP0045',
      businessName: 'CV. Distributor Makmur',
      phoneNumber: '+6281234567002',
      address: 'Jl. Sudirman No. 789, Jakarta Pusat',
      creditScore: 72,
      categories: JSON.stringify(['Fresh Food', 'Beverages']),
      regionsServed: 'Jakarta, Tangerang, Bekasi',
      creditTermsOffered: JSON.stringify(['Net 7', 'Net 14']),
    },
    {
      userId: 'SP0067',
      businessName: 'PT. Pasokan Prima',
      phoneNumber: '+6281234567003',
      address: 'Jl. Thamrin No. 321, Jakarta Pusat',
      creditScore: 58,
      categories: JSON.stringify(['Fresh Food', 'Packaging']),
      regionsServed: 'Jakarta',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7']),
    },
    {
      userId: 'SP0089',
      businessName: 'PT. Fresh Meat Supplier',
      phoneNumber: '+6281234567004',
      address: 'Jl. Kemang Raya No. 12, Jakarta Selatan',
      creditScore: 88,
      categories: JSON.stringify(['Fresh Food', 'Meat', 'Poultry']),
      regionsServed: 'Jakarta, Bandung, Yogyakarta',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7', 'Net 14', 'Net 30']),
    },
    {
      userId: 'SP0101',
      businessName: 'CV. Frozen Foods Indonesia',
      phoneNumber: '+6281234567005',
      address: 'Jl. HR Rasuna Said No. 45, Jakarta Selatan',
      creditScore: 79,
      categories: JSON.stringify(['Frozen Food', 'Ice Cream', 'Seafood']),
      regionsServed: 'Jakarta, Surabaya',
      creditTermsOffered: JSON.stringify(['Net 14', 'Net 30']),
    },
    {
      userId: 'SP0150',
      businessName: 'PT. Distribusi Nasional',
      phoneNumber: '+6281234567006',
      address: 'Jl. Sudirman No. 1, Jakarta Pusat',
      creditScore: 92,
      categories: JSON.stringify(['Fresh Food', 'Frozen Food', 'Dry Groceries', 'Beverages']),
      regionsServed: 'All Indonesia',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7', 'Net 14', 'Net 30']),
    },
    {
      userId: 'SP0175',
      businessName: 'PT. Sayur Segar Nusantara',
      phoneNumber: '+6281234567007',
      address: 'Jl. Pasar Minggu No. 88, Jakarta Selatan',
      creditScore: 81,
      categories: JSON.stringify(['Fresh Vegetables', 'Organic Produce']),
      regionsServed: 'Jakarta, Bogor, Depok, Tangerang, Bekasi',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7']),
    },
    {
      userId: 'SP0200',
      businessName: 'CV. Bumbu Dapur Indonesia',
      phoneNumber: '+6281234567008',
      address: 'Jl. Raya Cibubur No. 55, Jakarta Timur',
      creditScore: 76,
      categories: JSON.stringify(['Spices', 'Condiments', 'Dry Groceries']),
      regionsServed: 'Jakarta, Bandung',
      creditTermsOffered: JSON.stringify(['Net 7', 'Net 14']),
    },
    {
      userId: 'SP0225',
      businessName: 'PT. Minuman Sehat Abadi',
      phoneNumber: '+6281234567009',
      address: 'Jl. TB Simatupang No. 100, Jakarta Selatan',
      creditScore: 83,
      categories: JSON.stringify(['Beverages', 'Juice', 'Mineral Water']),
      regionsServed: 'Jakarta, Surabaya, Medan',
      creditTermsOffered: JSON.stringify(['COD', 'Net 14', 'Net 30']),
    },
    {
      userId: 'SP0250',
      businessName: 'PT. Seafood Bahari',
      phoneNumber: '+6281234567010',
      address: 'Jl. Muara Karang No. 77, Jakarta Utara',
      creditScore: 70,
      categories: JSON.stringify(['Seafood', 'Fresh Fish', 'Frozen Seafood']),
      regionsServed: 'Jakarta, Surabaya, Makassar',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7']),
    },
    {
      userId: 'SP0275',
      businessName: 'CV. Roti dan Kue Lezat',
      phoneNumber: '+6281234567011',
      address: 'Jl. Kelapa Gading No. 33, Jakarta Utara',
      creditScore: 87,
      categories: JSON.stringify(['Bakery', 'Pastry', 'Bread']),
      regionsServed: 'Jakarta, Tangerang',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7', 'Net 14']),
    },
    {
      userId: 'SP0300',
      businessName: 'PT. Peralatan Dapur Lengkap',
      phoneNumber: '+6281234567012',
      address: 'Jl. Mangga Dua No. 200, Jakarta Utara',
      creditScore: 90,
      categories: JSON.stringify(['Kitchen Equipment', 'Utensils', 'Packaging']),
      regionsServed: 'All Indonesia',
      creditTermsOffered: JSON.stringify(['Net 14', 'Net 30', 'Net 45']),
    },
    {
      userId: 'SP0325',
      businessName: 'PT. Kebersihan Bersih Sejahtera',
      phoneNumber: '+6281234567013',
      address: 'Jl. Raya Bekasi No. 250, Bekasi',
      creditScore: 84,
      categories: JSON.stringify(['Cleaning', 'Sanitation']),
      regionsServed: 'Jakarta, Bekasi, Depok, Tangerang',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7', 'Net 14']),
    },
    {
      userId: 'SP0350',
      businessName: 'CV. Bahan Dapur Nusantara',
      phoneNumber: '+6281234567014',
      address: 'Jl. Raya Bogor No. 150, Bogor',
      creditScore: 77,
      categories: JSON.stringify(['Dry Groceries', 'Spices', 'Condiments']),
      regionsServed: 'Jakarta, Bogor, Depok',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7']),
    },
    {
      userId: 'SP0375',
      businessName: 'PT. Buah Segar Indonesia',
      phoneNumber: '+6281234567015',
      address: 'Jl. Raya Cibubur No. 200, Jakarta Timur',
      creditScore: 86,
      categories: JSON.stringify(['Fresh Food', 'Fresh Vegetables', 'Organic Produce']),
      regionsServed: 'Jakarta, Bandung, Yogyakarta',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7', 'Net 14']),
    },
    {
      userId: 'SP0400',
      businessName: 'CV. Minuman Segar',
      phoneNumber: '+6281234567016',
      address: 'Jl. Merdeka No. 45, Bandung',
      creditScore: 73,
      categories: JSON.stringify(['Beverages', 'Juice']),
      regionsServed: 'Bandung, Jakarta',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7']),
    },
    {
      userId: 'SP0425',
      businessName: 'PT. Packaging Solutions',
      phoneNumber: '+6281234567017',
      address: 'Jl. Raya Serpong No. 100, Tangerang Selatan',
      creditScore: 88,
      categories: JSON.stringify(['Packaging', 'Disposables']),
      regionsServed: 'Jakarta, Tangerang, Bekasi',
      creditTermsOffered: JSON.stringify(['Net 7', 'Net 14', 'Net 30']),
    },
    {
      userId: 'SP0450',
      businessName: 'PT. Daging Segar Premium',
      phoneNumber: '+6281234567018',
      address: 'Jl. Raya Pasar Minggu No. 200, Jakarta Selatan',
      creditScore: 91,
      categories: JSON.stringify(['Fresh Food', 'Meat', 'Poultry']),
      regionsServed: 'Jakarta, Bandung, Surabaya',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7', 'Net 14', 'Net 30']),
    },
    {
      userId: 'SP0475',
      businessName: 'CV. Roti Segar Nusantara',
      phoneNumber: '+6281234567019',
      address: 'Jl. Kemang Raya No. 88, Jakarta Selatan',
      creditScore: 82,
      categories: JSON.stringify(['Bakery', 'Bread']),
      regionsServed: 'Jakarta, Tangerang',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7']),
    },
    {
      userId: 'SP0500',
      businessName: 'PT. Alat Masak Profesional',
      phoneNumber: '+6281234567020',
      address: 'Jl. Raya Mangga Dua No. 300, Jakarta Utara',
      creditScore: 89,
      categories: JSON.stringify(['Kitchen Equipment', 'Tools']),
      regionsServed: 'All Indonesia',
      creditTermsOffered: JSON.stringify(['Net 14', 'Net 30']),
    },
    {
      userId: 'SP0525',
      businessName: 'CV. Ikan Segar Laut',
      phoneNumber: '+6281234567021',
      address: 'Jl. Muara Baru No. 150, Jakarta Utara',
      creditScore: 75,
      categories: JSON.stringify(['Seafood', 'Fresh Fish']),
      regionsServed: 'Jakarta, Surabaya, Makassar',
      creditTermsOffered: JSON.stringify(['COD', 'Net 7']),
    },
  ]

  // Get or create suppliers (preserve existing ones)
  const suppliers: any[] = []
  for (const data of suppliersData) {
    const existing = await prisma.user.findUnique({
      where: { userId: data.userId },
    })
    
    if (existing) {
      suppliers.push(existing)
      console.log(`   ⏭️  Supplier ${data.userId} already exists, skipping`)
    } else {
      const supplier = await prisma.user.create({
        data: {
          type: 'SUPPLIER',
          ...data,
          profileCompleted: true,
          inviteStatus: 'ACTIVE',
          invitedAt: new Date(),
        } as any,
      })
      suppliers.push(supplier)
      console.log(`   ✅ Created supplier ${data.userId}`)
    }
  }
  console.log('✅ Processed', suppliers.length, 'suppliers')

  // ============================================
  // CREATE 15 BUYERS
  // ============================================
  const buyersData = [
    {
      userId: 'BJ1045',
      businessName: 'Restaurant Sederhana',
      phoneNumber: '+6281234568001',
      address: 'Jl. Raya Bogor KM 28, Depok',
      creditScore: 65,
      preferredPaymentTerm: 'NET14',
      businessTypes: JSON.stringify(['Restaurant']),
    },
    {
      userId: 'BJ1089',
      businessName: 'Cafe Modern Jakarta',
      phoneNumber: '+6281234568002',
      address: 'Jl. Senopati No. 45, Jakarta Selatan',
      creditScore: 82,
      preferredPaymentTerm: 'NET7',
      businessTypes: JSON.stringify(['Cafe']),
    },
    {
      userId: 'BJ1123',
      businessName: 'Hotel Grand Indonesia',
      phoneNumber: '+6281234568003',
      address: 'Jl. MH Thamrin No. 1, Jakarta Pusat',
      creditScore: 45,
      preferredPaymentTerm: 'NET30',
      businessTypes: JSON.stringify(['Hotel']),
    },
    {
      userId: 'BJ1156',
      businessName: 'Minimarket Sejahtera',
      phoneNumber: '+6281234568004',
      address: 'Jl. Sudirman No. 123, Jakarta Pusat',
      creditScore: 78,
      preferredPaymentTerm: 'COD',
      businessTypes: JSON.stringify(['Retail']),
    },
    {
      userId: 'BJ1200',
      businessName: 'Warung Padang Raya',
      phoneNumber: '+6281234568005',
      address: 'Jl. Kramat Raya No. 50, Jakarta Pusat',
      creditScore: 71,
      preferredPaymentTerm: 'NET14',
      businessTypes: JSON.stringify(['Restaurant']),
    },
    {
      userId: 'BJ1234',
      businessName: 'Restoran Sunda Asli',
      phoneNumber: '+6281234568006',
      address: 'Jl. Braga No. 88, Bandung',
      creditScore: 88,
      preferredPaymentTerm: 'NET7',
      businessTypes: JSON.stringify(['Restaurant']),
    },
    {
      userId: 'BJ1267',
      businessName: 'Kedai Kopi Nusantara',
      phoneNumber: '+6281234568007',
      address: 'Jl. Malioboro No. 100, Yogyakarta',
      creditScore: 55,
      preferredPaymentTerm: 'COD',
      businessTypes: JSON.stringify(['Cafe']),
    },
    {
      userId: 'BJ1300',
      businessName: 'Catering Bu Endang',
      phoneNumber: '+6281234568008',
      address: 'Jl. Pemuda No. 25, Surabaya',
      creditScore: 92,
      preferredPaymentTerm: 'NET14',
      businessTypes: JSON.stringify(['Catering']),
    },
    {
      userId: 'BJ1333',
      businessName: 'Bakery & Pastry Delima',
      phoneNumber: '+6281234568009',
      address: 'Jl. Diponegoro No. 77, Semarang',
      creditScore: 80,
      preferredPaymentTerm: 'NET7',
      businessTypes: JSON.stringify(['Bakery']),
    },
    {
      userId: 'BJ1366',
      businessName: 'Rumah Makan Betawi',
      phoneNumber: '+6281234568010',
      address: 'Jl. Condet Raya No. 15, Jakarta Timur',
      creditScore: 68,
      preferredPaymentTerm: 'NET14',
      businessTypes: JSON.stringify(['Restaurant']),
    },
    {
      userId: 'BJ1400',
      businessName: 'Supermarket Maju Jaya',
      phoneNumber: '+6281234568011',
      address: 'Jl. Raya Serpong No. 200, Tangerang Selatan',
      creditScore: 85,
      preferredPaymentTerm: 'NET30',
      businessTypes: JSON.stringify(['Retail', 'Supermarket']),
    },
    {
      userId: 'BJ1433',
      businessName: 'Kantin Sekolah Harapan',
      phoneNumber: '+6281234568012',
      address: 'Jl. Pendidikan No. 10, Bekasi',
      creditScore: 60,
      preferredPaymentTerm: 'COD',
      businessTypes: JSON.stringify(['Canteen']),
    },
    {
      userId: 'BJ1466',
      businessName: 'Food Court Plaza Indonesia',
      phoneNumber: '+6281234568013',
      address: 'Jl. MH Thamrin, Jakarta Pusat',
      creditScore: 75,
      preferredPaymentTerm: 'NET14',
      businessTypes: JSON.stringify(['Food Court']),
    },
    {
      userId: 'BJ1500',
      businessName: 'Restoran Seafood Bahari',
      phoneNumber: '+6281234568014',
      address: 'Jl. Pantai Indah Kapuk No. 55, Jakarta Utara',
      creditScore: 42,
      preferredPaymentTerm: 'NET30',
      businessTypes: JSON.stringify(['Restaurant', 'Seafood']),
    },
    {
      userId: 'BJ1533',
      businessName: 'Toko Bahan Kue Manis',
      phoneNumber: '+6281234568015',
      address: 'Jl. Pasar Baru No. 30, Jakarta Pusat',
      creditScore: 73,
      preferredPaymentTerm: 'NET7',
      businessTypes: JSON.stringify(['Retail', 'Baking Supplies']),
    },
  ]

  // Get or create buyers (preserve existing ones)
  const buyers: any[] = []
  for (const data of buyersData) {
    const existing = await prisma.user.findUnique({
      where: { userId: data.userId },
    })
    
    if (existing) {
      buyers.push(existing)
      console.log(`   ⏭️  Buyer ${data.userId} already exists, skipping`)
    } else {
      const buyer = await prisma.user.create({
        data: {
          type: 'BUYER',
          ...data,
          profileCompleted: true,
          inviteStatus: 'ACTIVE',
          invitedAt: new Date(),
        } as any,
      })
      buyers.push(buyer)
      console.log(`   ✅ Created buyer ${data.userId}`)
    }
  }
  console.log('✅ Processed', buyers.length, 'buyers')
  
  // Add more buyers to reach at least 20 accounts total
  const additionalBuyersData = [
    {
      userId: 'BJ1600',
      businessName: 'Restoran Padang Minang',
      phoneNumber: '+6281234568016',
      address: 'Jl. Fatmawati No. 120, Jakarta Selatan',
      creditScore: 69,
      preferredPaymentTerm: 'NET14',
      businessTypes: JSON.stringify(['Restaurant']),
    },
    {
      userId: 'BJ1633',
      businessName: 'Cafe & Resto Dapoer Nusantara',
      phoneNumber: '+6281234568017',
      address: 'Jl. Kebon Jeruk No. 88, Jakarta Barat',
      creditScore: 76,
      preferredPaymentTerm: 'NET7',
      businessTypes: JSON.stringify(['Restaurant', 'Cafe']),
    },
    {
      userId: 'BJ1666',
      businessName: 'Warung Makan Sederhana',
      phoneNumber: '+6281234568018',
      address: 'Jl. Cikini Raya No. 25, Jakarta Pusat',
      creditScore: 58,
      preferredPaymentTerm: 'COD',
      businessTypes: JSON.stringify(['Restaurant']),
    },
    {
      userId: 'BJ1700',
      businessName: 'Hotel Metropolitan Jakarta',
      phoneNumber: '+6281234568019',
      address: 'Jl. Gatot Subroto No. 789, Jakarta Selatan',
      creditScore: 81,
      preferredPaymentTerm: 'NET30',
      businessTypes: JSON.stringify(['Hotel']),
    },
    {
      userId: 'BJ1733',
      businessName: 'Supermarket Indah Jaya',
      phoneNumber: '+6281234568020',
      address: 'Jl. Raya Ciledug No. 150, Tangerang',
      creditScore: 87,
      preferredPaymentTerm: 'NET30',
      businessTypes: JSON.stringify(['Retail', 'Supermarket']),
    },
    {
      userId: 'BJ1766',
      businessName: 'Catering Sehat & Lezat',
      phoneNumber: '+6281234568021',
      address: 'Jl. Tanah Abang No. 50, Jakarta Pusat',
      creditScore: 74,
      preferredPaymentTerm: 'NET14',
      businessTypes: JSON.stringify(['Catering']),
    },
    {
      userId: 'BJ1800',
      businessName: 'Bakery & Cafe Sweet Corner',
      phoneNumber: '+6281234568022',
      address: 'Jl. Kemang Raya No. 55, Jakarta Selatan',
      creditScore: 79,
      preferredPaymentTerm: 'NET7',
      businessTypes: JSON.stringify(['Bakery', 'Cafe']),
    },
    {
      userId: 'BJ1833',
      businessName: 'Rumah Makan Padang Sederhana',
      phoneNumber: '+6281234568023',
      address: 'Jl. Raya Kebayoran Lama No. 200, Jakarta Selatan',
      creditScore: 64,
      preferredPaymentTerm: 'NET14',
      businessTypes: JSON.stringify(['Restaurant']),
    },
    {
      userId: 'BJ1866',
      businessName: 'Toko Kebutuhan Restoran',
      phoneNumber: '+6281234568024',
      address: 'Jl. Pasar Senen No. 75, Jakarta Pusat',
      creditScore: 72,
      preferredPaymentTerm: 'NET7',
      businessTypes: JSON.stringify(['Retail', 'Wholesale']),
    },
    {
      userId: 'BJ1900',
      businessName: 'Food Court Grand Mall',
      phoneNumber: '+6281234568025',
      address: 'Jl. Sudirman No. 50, Jakarta Pusat',
      creditScore: 83,
      preferredPaymentTerm: 'NET14',
      businessTypes: JSON.stringify(['Food Court']),
    },
  ]
  
  for (const data of additionalBuyersData) {
    const existing = await prisma.user.findUnique({
      where: { userId: data.userId },
    })
    
    if (!existing) {
      const buyer = await prisma.user.create({
        data: {
          type: 'BUYER',
          ...data,
          profileCompleted: true,
          inviteStatus: 'ACTIVE',
          invitedAt: new Date(),
        } as any,
      })
      buyers.push(buyer)
      console.log(`   ✅ Created additional buyer ${data.userId}`)
    }
  }
  
  console.log('✅ Total buyers:', buyers.length)

  // ============================================
  // CREATE INVOICES (Multiple per buyer, various statuses)
  // ============================================
  const now = new Date()
  const day = 24 * 60 * 60 * 1000

  const invoicesData = [
    // Buyer 1 (BJ1045) - Restaurant Sederhana - 4 invoices
    { buyerIdx: 0, supplierIdx: 0, number: 'INV-2024-001', amount: 15000000, dueDaysAgo: 5, status: 'OVERDUE_3' },
    { buyerIdx: 0, supplierIdx: 0, number: 'INV-2024-002', amount: 8500000, dueDaysAgo: -10, status: 'PENDING' },
    { buyerIdx: 0, supplierIdx: 3, number: 'INV-2024-003', amount: 12000000, dueDaysAgo: 20, status: 'PAID', paidDaysAgo: 19 },
    { buyerIdx: 0, supplierIdx: 1, number: 'INV-2024-004', amount: 5500000, dueDaysAgo: -2, status: 'DUE_SOON' },

    // Buyer 2 (BJ1089) - Cafe Modern - 3 invoices (good payer)
    { buyerIdx: 1, supplierIdx: 0, number: 'INV-2024-005', amount: 7200000, dueDaysAgo: 15, status: 'PAID', paidDaysAgo: 16 },
    { buyerIdx: 1, supplierIdx: 4, number: 'INV-2024-006', amount: 4800000, dueDaysAgo: 10, status: 'PAID', paidDaysAgo: 10 },
    { buyerIdx: 1, supplierIdx: 0, number: 'INV-2024-007', amount: 9100000, dueDaysAgo: -7, status: 'PENDING' },

    // Buyer 3 (BJ1123) - Hotel Grand - 5 invoices (problematic)
    { buyerIdx: 2, supplierIdx: 0, number: 'INV-2024-008', amount: 45000000, dueDaysAgo: 8, status: 'OVERDUE_7' },
    { buyerIdx: 2, supplierIdx: 5, number: 'INV-2024-009', amount: 32000000, dueDaysAgo: 3, status: 'OVERDUE_3' },
    { buyerIdx: 2, supplierIdx: 3, number: 'INV-2024-010', amount: 28000000, dueDaysAgo: 1, status: 'OVERDUE_3' },
    { buyerIdx: 2, supplierIdx: 0, number: 'INV-2024-011', amount: 18000000, dueDaysAgo: -5, status: 'PENDING' },
    { buyerIdx: 2, supplierIdx: 1, number: 'INV-2024-012', amount: 22000000, dueDaysAgo: 30, status: 'PAID', paidDaysAgo: 25 },

    // Buyer 4 (BJ1156) - Minimarket - 3 invoices
    { buyerIdx: 3, supplierIdx: 5, number: 'INV-2024-013', amount: 18500000, dueDaysAgo: -3, status: 'DUE_SOON' },
    { buyerIdx: 3, supplierIdx: 6, number: 'INV-2024-014', amount: 11200000, dueDaysAgo: 7, status: 'PAID', paidDaysAgo: 7 },
    { buyerIdx: 3, supplierIdx: 0, number: 'INV-2024-015', amount: 9800000, dueDaysAgo: 5, status: 'PAID', paidDaysAgo: 4 },

    // Buyer 5 (BJ1200) - Warung Padang - 4 invoices
    { buyerIdx: 4, supplierIdx: 0, number: 'INV-2024-016', amount: 6700000, dueDaysAgo: 2, status: 'OVERDUE_3' },
    { buyerIdx: 4, supplierIdx: 7, number: 'INV-2024-017', amount: 4300000, dueDaysAgo: -1, status: 'DUE_SOON' },
    { buyerIdx: 4, supplierIdx: 3, number: 'INV-2024-018', amount: 8900000, dueDaysAgo: 12, status: 'PAID', paidDaysAgo: 11 },
    { buyerIdx: 4, supplierIdx: 0, number: 'INV-2024-019', amount: 5100000, dueDaysAgo: 8, status: 'PAID', paidDaysAgo: 9 },

    // Buyer 6 (BJ1234) - Restoran Sunda - 3 invoices (excellent payer)
    { buyerIdx: 5, supplierIdx: 0, number: 'INV-2024-020', amount: 14500000, dueDaysAgo: 5, status: 'PAID', paidDaysAgo: 6 },
    { buyerIdx: 5, supplierIdx: 6, number: 'INV-2024-021', amount: 7800000, dueDaysAgo: -14, status: 'PENDING' },
    { buyerIdx: 5, supplierIdx: 8, number: 'INV-2024-022', amount: 11200000, dueDaysAgo: 10, status: 'PAID', paidDaysAgo: 10 },

    // Buyer 7 (BJ1267) - Kedai Kopi - 2 invoices
    { buyerIdx: 6, supplierIdx: 8, number: 'INV-2024-023', amount: 3200000, dueDaysAgo: 4, status: 'OVERDUE_3' },
    { buyerIdx: 6, supplierIdx: 10, number: 'INV-2024-024', amount: 2800000, dueDaysAgo: -7, status: 'PENDING' },

    // Buyer 8 (BJ1300) - Catering Bu Endang - 4 invoices (excellent)
    { buyerIdx: 7, supplierIdx: 0, number: 'INV-2024-025', amount: 25000000, dueDaysAgo: 3, status: 'PAID', paidDaysAgo: 4 },
    { buyerIdx: 7, supplierIdx: 3, number: 'INV-2024-026', amount: 18000000, dueDaysAgo: 7, status: 'PAID', paidDaysAgo: 7 },
    { buyerIdx: 7, supplierIdx: 5, number: 'INV-2024-027', amount: 32000000, dueDaysAgo: -5, status: 'PENDING' },
    { buyerIdx: 7, supplierIdx: 9, number: 'INV-2024-028', amount: 15500000, dueDaysAgo: 14, status: 'PAID', paidDaysAgo: 13 },

    // Buyer 9 (BJ1333) - Bakery Delima - 3 invoices
    { buyerIdx: 8, supplierIdx: 10, number: 'INV-2024-029', amount: 8900000, dueDaysAgo: -2, status: 'DUE_SOON' },
    { buyerIdx: 8, supplierIdx: 7, number: 'INV-2024-030', amount: 6500000, dueDaysAgo: 5, status: 'PAID', paidDaysAgo: 5 },
    { buyerIdx: 8, supplierIdx: 0, number: 'INV-2024-031', amount: 4200000, dueDaysAgo: 10, status: 'PAID', paidDaysAgo: 9 },

    // Buyer 10 (BJ1366) - Rumah Makan Betawi - 3 invoices
    { buyerIdx: 9, supplierIdx: 0, number: 'INV-2024-032', amount: 7800000, dueDaysAgo: 1, status: 'OVERDUE_3' },
    { buyerIdx: 9, supplierIdx: 6, number: 'INV-2024-033', amount: 5400000, dueDaysAgo: -8, status: 'PENDING' },
    { buyerIdx: 9, supplierIdx: 3, number: 'INV-2024-034', amount: 9200000, dueDaysAgo: 12, status: 'PAID', paidDaysAgo: 11 },

    // Buyer 11 (BJ1400) - Supermarket Maju Jaya - 5 invoices (large orders)
    { buyerIdx: 10, supplierIdx: 5, number: 'INV-2024-035', amount: 85000000, dueDaysAgo: -10, status: 'PENDING' },
    { buyerIdx: 10, supplierIdx: 0, number: 'INV-2024-036', amount: 62000000, dueDaysAgo: 5, status: 'PAID', paidDaysAgo: 5 },
    { buyerIdx: 10, supplierIdx: 4, number: 'INV-2024-037', amount: 45000000, dueDaysAgo: 8, status: 'PAID', paidDaysAgo: 7 },
    { buyerIdx: 10, supplierIdx: 8, number: 'INV-2024-038', amount: 38000000, dueDaysAgo: -3, status: 'DUE_SOON' },
    { buyerIdx: 10, supplierIdx: 11, number: 'INV-2024-039', amount: 28000000, dueDaysAgo: 15, status: 'PAID', paidDaysAgo: 14 },

    // Buyer 12 (BJ1433) - Kantin Sekolah - 2 invoices
    { buyerIdx: 11, supplierIdx: 0, number: 'INV-2024-040', amount: 4500000, dueDaysAgo: 6, status: 'OVERDUE_3' },
    { buyerIdx: 11, supplierIdx: 6, number: 'INV-2024-041', amount: 3200000, dueDaysAgo: -5, status: 'PENDING' },

    // Buyer 13 (BJ1466) - Food Court - 3 invoices
    { buyerIdx: 12, supplierIdx: 0, number: 'INV-2024-042', amount: 22000000, dueDaysAgo: -1, status: 'DUE_SOON' },
    { buyerIdx: 12, supplierIdx: 5, number: 'INV-2024-043', amount: 18500000, dueDaysAgo: 7, status: 'PAID', paidDaysAgo: 6 },
    { buyerIdx: 12, supplierIdx: 8, number: 'INV-2024-044', amount: 15000000, dueDaysAgo: 3, status: 'OVERDUE_3' },

    // Buyer 14 (BJ1500) - Restoran Seafood - 4 invoices (high risk)
    { buyerIdx: 13, supplierIdx: 9, number: 'INV-2024-045', amount: 35000000, dueDaysAgo: 15, status: 'OVERDUE_7' },
    { buyerIdx: 13, supplierIdx: 0, number: 'INV-2024-046', amount: 28000000, dueDaysAgo: 10, status: 'OVERDUE_7' },
    { buyerIdx: 13, supplierIdx: 4, number: 'INV-2024-047', amount: 22000000, dueDaysAgo: 5, status: 'OVERDUE_3' },
    { buyerIdx: 13, supplierIdx: 9, number: 'INV-2024-048', amount: 18000000, dueDaysAgo: -7, status: 'PENDING' },

    // Buyer 15 (BJ1533) - Toko Bahan Kue - 3 invoices
    { buyerIdx: 14, supplierIdx: 7, number: 'INV-2024-049', amount: 9800000, dueDaysAgo: 2, status: 'OVERDUE_3' },
    { buyerIdx: 14, supplierIdx: 10, number: 'INV-2024-050', amount: 7500000, dueDaysAgo: -4, status: 'DUE_SOON' },
    { buyerIdx: 14, supplierIdx: 0, number: 'INV-2024-051', amount: 6200000, dueDaysAgo: 8, status: 'PAID', paidDaysAgo: 7 },
  ]

  // Create invoices (skip if already exists)
  const invoices: any[] = []
  for (const inv of invoicesData) {
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber: inv.number },
    })
    
    if (!existing && inv.buyerIdx < buyers.length && inv.supplierIdx < suppliers.length) {
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: inv.number,
          buyerId: buyers[inv.buyerIdx].id,
          supplierId: suppliers[inv.supplierIdx].id,
          amount: inv.amount,
          dueDate: new Date(now.getTime() - inv.dueDaysAgo * day),
          status: inv.status,
          paidAt: inv.paidDaysAgo ? new Date(now.getTime() - inv.paidDaysAgo * day) : null,
          orderId: `ORD-${inv.number.split('-')[2]}`,
        },
      })
      invoices.push(invoice)
    }
  }
  
  // Ensure SP0023 (dev supplier) has at least 5 buyers
  const devSupplier = suppliers.find(s => s.userId === 'SP0023')
  if (devSupplier) {
    const existingInvoices = await prisma.invoice.findMany({
      where: { supplierId: devSupplier.id },
      select: { buyerId: true },
      distinct: ['buyerId'],
    })
    const existingBuyerIds = new Set(existingInvoices.map(i => i.buyerId))
    
    // Get first 5 buyers that don't already have invoices with SP0023
    const buyersForDev = buyers
      .filter(b => !existingBuyerIds.has(b.id))
      .slice(0, Math.max(0, 5 - existingBuyerIds.size))
    
    let invoiceCounter = invoices.length + 100
    for (const buyer of buyersForDev) {
      const invoiceNumber = `INV-2024-${String(1000 + invoiceCounter).padStart(4, '0')}`
      const existing = await prisma.invoice.findUnique({
        where: { invoiceNumber },
      })
      
      if (!existing) {
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            buyerId: buyer.id,
            supplierId: devSupplier.id,
            amount: Math.floor(Math.random() * 20000000) + 5000000, // 5M - 25M
            dueDate: new Date(now.getTime() + (Math.random() * 30 - 10) * day),
            status: ['PENDING', 'DUE_SOON', 'PAID'][Math.floor(Math.random() * 3)],
            orderId: `ORD-DEV-${invoiceCounter}`,
          },
        })
        invoices.push(invoice)
        invoiceCounter++
      }
    }
    console.log(`✅ Ensured SP0023 has relationships with ${existingBuyerIds.size + buyersForDev.length} buyers`)
  }
  
  // Ensure each buyer has at least 5 suppliers (through invoices)
  for (const buyer of buyers) {
    const existingInvoices = await prisma.invoice.findMany({
      where: { buyerId: buyer.id },
      select: { supplierId: true },
      distinct: ['supplierId'],
    })
    const existingSupplierIds = new Set(existingInvoices.map(i => i.supplierId))
    
    // Get suppliers that this buyer doesn't have invoices with yet
    const suppliersForBuyer = suppliers
      .filter(s => !existingSupplierIds.has(s.id))
      .slice(0, Math.max(0, 5 - existingSupplierIds.size))
    
    let invoiceCounter = invoices.length + 200
    for (const supplier of suppliersForBuyer) {
      const invoiceNumber = `INV-2024-${String(1000 + invoiceCounter).padStart(4, '0')}`
      const existing = await prisma.invoice.findUnique({
        where: { invoiceNumber },
      })
      
      if (!existing) {
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            buyerId: buyer.id,
            supplierId: supplier.id,
            amount: Math.floor(Math.random() * 20000000) + 5000000, // 5M - 25M
            dueDate: new Date(now.getTime() + (Math.random() * 30 - 10) * day),
            status: ['PENDING', 'DUE_SOON', 'PAID', 'OVERDUE_3'][Math.floor(Math.random() * 4)],
            orderId: `ORD-BUYER-${invoiceCounter}`,
          },
        })
        invoices.push(invoice)
        invoiceCounter++
      }
    }
  }
  
  console.log('✅ Created', invoices.length, 'new invoices')

  // Get final counts
  const finalSupplierCount = await prisma.user.count({ where: { type: 'SUPPLIER' } })
  const finalBuyerCount = await prisma.user.count({ where: { type: 'BUYER' } })
  const finalInvoiceCount = await prisma.invoice.count()
  
  console.log('')
  console.log('🎉 Seeding complete!')
  console.log(`   📦 ${finalSupplierCount} Suppliers (including existing)`)
  console.log(`   🛒 ${finalBuyerCount} Buyers (including existing)`)
  console.log(`   📄 ${finalInvoiceCount} Invoices total`)
  console.log(`   👤 ${finalSupplierCount + finalBuyerCount} Total Accounts`)
  
  // Verify dev account has 5 buyers
  if (devSupplier) {
    const devBuyerCount = await prisma.invoice.findMany({
      where: { supplierId: devSupplier.id },
      select: { buyerId: true },
      distinct: ['buyerId'],
    })
    console.log(`   ✅ SP0023 (dev supplier) has ${devBuyerCount.length} buyers`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    // Don't manually disconnect with Supabase PgBouncer - Prisma manages connections
    // await prisma.$disconnect()
  })

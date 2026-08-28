import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Initialize Prisma with connection pooling for Supabase
// IMPORTANT: With Supabase PgBouncer, DO NOT manually call $connect() or $disconnect()
// Prisma manages connections automatically through its connection pool
function createPrismaClient() {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/prisma.ts:10',message:'Prisma client creation started',data:{hasDatabaseUrl:!!process.env.DATABASE_URL,dbUrlStartsWith:process.env.DATABASE_URL?.substring(0,20)||'MISSING',nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,D'})}).catch(()=>{});
    // #endregion
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/prisma.ts:18',message:'Prisma client created successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    return client
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/prisma.ts:21',message:'Prisma client creation failed',data:{errorName:error instanceof Error?error.name:'UNKNOWN',errorMessage:error instanceof Error?error.message:'UNKNOWN'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,D,E'})}).catch(()=>{});
    // #endregion
    console.error('[Prisma] Failed to create Prisma client:', error)
    throw error
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma


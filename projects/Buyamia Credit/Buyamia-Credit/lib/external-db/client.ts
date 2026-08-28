/**
 * External Database Client
 * 
 * Connects to the main Buyamia database (read-only)
 * Used to fetch buyer, seller, and order data
 */

import { Pool, PoolClient } from 'pg';

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 */
export function getExternalDbPool(): Pool {
  if (!pool) {
    const connectionString = process.env.EXTERNAL_DATABASE_URL;
    
    if (!connectionString) {
      throw new Error(
        'EXTERNAL_DATABASE_URL is not set. Please add it to your .env file.\n' +
        'Format: postgresql://username:password@host:port/database?sslmode=disable'
      );
    }

    pool = new Pool({
      connectionString,
      max: 10, // Maximum number of connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on external database client', err);
    });
  }

  return pool;
}

/**
 * Execute a query on the external database
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getExternalDbPool();
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[ExternalDB] Query executed', { 
        duration: `${duration}ms`, 
        rows: result.rowCount 
      });
    }
    
    return result.rows as T[];
  } catch (error) {
    console.error('[ExternalDB] Query error:', error);
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getExternalDbPool();
  return pool.connect();
}

/**
 * Close the connection pool (for cleanup)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Test the database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('[ExternalDB] Connection successful:', result[0]);
    return true;
  } catch (error) {
    console.error('[ExternalDB] Connection failed:', error);
    return false;
  }
}




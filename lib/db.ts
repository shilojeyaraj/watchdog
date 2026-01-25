// Database connection utility for Neon PostgreSQL
// This file provides a reusable database client connection

import { Client } from 'pg';

let client: Client | null = null;

/**
 * Get or create a database client connection
 * Reuses existing connection if available and healthy
 */
function getDbClient(): Client {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // If client exists but is in error state, close it and create a new one
  if (client) {
    // Check if client is in an error state (not queryable)
    if ((client as any)._ending || (client as any)._connectionError) {
      console.log('[DB] Client in error state, creating new connection');
      client = null;
    }
  }

  if (!client) {
    client = new Client({
      connectionString: databaseUrl,
    });
    
    // Handle connection errors
    client.on('error', (err) => {
      console.error('[DB] Client connection error:', err);
      // Mark client as errored so we create a new one next time
      (client as any)._connectionError = true;
    });
  }

  return client;
}

/**
 * Execute a query with automatic connection handling and error recovery
 * Use this for one-off queries
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  let dbClient = getDbClient();
  let retries = 2; // Try up to 2 times
  
  while (retries > 0) {
    try {
      // Connect if not already connected
      if (!dbClient._connected) {
        await dbClient.connect();
      }

      const result = await dbClient.query(text, params);
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0,
      };
    } catch (error: any) {
      // Check if it's a connection error
      const isConnectionError = 
        error.message?.includes('connection error') ||
        error.message?.includes('not queryable') ||
        error.message?.includes('Connection terminated') ||
        error.code === 'ECONNRESET' ||
        error.code === 'EPIPE';
      
      if (isConnectionError && retries > 1) {
        console.warn('[DB] Connection error detected, retrying with new connection...', error.message);
        // Close the broken client
        try {
          await dbClient.end();
        } catch (e) {
          // Ignore errors when closing
        }
        // Reset client to force creation of new one
        client = null;
        dbClient = getDbClient();
        retries--;
        continue;
      }
      
      console.error('[DB] Database query error:', error);
      throw error;
    }
  }
  
  throw new Error('Failed to execute query after retries');
}

/**
 * Close the database connection
 * Call this when shutting down the application
 */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

/**
 * Test database connection
 * Useful for health checks
 */
export async function testConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

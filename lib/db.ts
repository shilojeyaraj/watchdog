// Database connection utility for Neon PostgreSQL
// Uses @neondatabase/serverless for serverless-friendly connections

import { neon } from '@neondatabase/serverless';

// Create the SQL query function
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[DB] DATABASE_URL environment variable is not set');
}

// The neon() function returns a SQL template tag function
const sql = databaseUrl ? neon(databaseUrl) : null;

/**
 * Execute a query using Neon's serverless driver
 * Compatible with the old pg-style interface
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  if (!sql) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  try {
    // Use correct Neon API: sql.query for parameterized queries
    let result;
    if (params && params.length > 0) {
      result = await sql.query(text, params);
    } else {
      result = await sql.query(text);
    }
    // Neon v1.x sql.query() returns rows as a plain array (T[]), not { rows, rowCount }
    // Handle both shapes for safety
    const rows = Array.isArray(result)
      ? result as T[]
      : (result && Array.isArray(result.rows)) ? result.rows as T[] : [];
    const rowCount = Array.isArray(result)
      ? result.length
      : (typeof result?.rowCount === 'number') ? result.rowCount : rows.length;
    return {
      rows,
      rowCount,
    };
  } catch (error) {
    if (error && error.message && error.message.includes('can now be called only as a tagged-template function')) {
      console.error(`[DB] SQL USAGE ERROR: You must use sql\`...\` for tagged templates or sql.query("...", [params]) for parameterized queries. Received: text='${text}', params=${JSON.stringify(params)}`);
    }
    console.error('[DB] Query error:', error);
    throw error;
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    console.log('[DB] Connection test successful');
    return true;
  } catch (error) {
    console.error('[DB] Connection test failed:', error);
    return false;
  }
}

// Export sql for direct use if needed
export { sql };

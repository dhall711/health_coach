// Server-side Neon Postgres client
// Only import this in API routes and server components -- NOT in "use client" files

import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

function getSQL() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Create a Neon project at neon.tech and add the connection string to .env.local"
      );
    }
    _sql = neon(url);
  }
  return _sql;
}

/**
 * Execute a parameterized SQL query against Neon.
 *
 * Uses sql.query() for conventional (text, params) calls.
 * Always returns an array of row objects (empty array on failure).
 *
 * @example
 *   const rows = await query("SELECT * FROM users WHERE id = $1", [userId]);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(text: string, params: unknown[] = []): Promise<any[]> {
  const sql = getSQL();
  const result = await sql.query(text, params);
  // Defensive: result should be { rows: [...] } but guard against edge cases
  if (Array.isArray(result)) {
    return result;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result as any)?.rows ?? [];
}

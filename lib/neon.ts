// Server-side Neon Postgres client
// Only import this in API routes and server components -- NOT in "use client" files

import { neon } from "@neondatabase/serverless";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * @example
 *   const rows = await query("SELECT * FROM users WHERE id = $1", [userId]);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(text: string, params: unknown[] = []): Promise<any[]> {
  const sql = getSQL();
  // neon() returns a tagged template function that also accepts (string, params[])
  // at runtime, but the TypeScript types only expose the tagged template signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (sql as any)(text, params);
}

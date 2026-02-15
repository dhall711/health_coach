import { NextRequest, NextResponse } from "next/server";
import { query as dbQuery } from "@/lib/neon";

// Allowlist of tables the client is permitted to query.
// Prevents SQL injection via table name.
const ALLOWED_TABLES = new Set([
  "profiles",
  "weight_logs",
  "food_favorites",
  "food_logs",
  "workouts",
  "mobility_logs",
  "water_logs",
  "progress_photos",
  "body_measurements",
  "daily_summaries",
  "streaks",
  "coach_messages",
  "plans",
  "oauth_tokens",
  "sync_logs",
]);

// Only alphanumeric + underscore allowed for column names
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function isSafeIdentifier(s: string): boolean {
  return SAFE_IDENTIFIER.test(s);
}

interface Filter {
  column: string;
  op: "eq" | "gte" | "lte";
  value: unknown;
}

interface OrderClause {
  column: string;
  ascending: boolean;
}

interface QueryDescriptor {
  table: string;
  operation: "select" | "insert" | "update" | "upsert";
  columns?: string;
  filters?: Filter[];
  order?: OrderClause[];
  limitCount?: number;
  single?: boolean;
  data?: Record<string, unknown> | Record<string, unknown>[];
  upsertOptions?: { onConflict?: string };
  updateFilters?: Filter[];
}

const OP_MAP: Record<string, string> = {
  eq: "=",
  gte: ">=",
  lte: "<=",
};

export async function POST(req: NextRequest) {
  let desc: QueryDescriptor;
  try {
    desc = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  // Validate table
  if (!desc.table || !ALLOWED_TABLES.has(desc.table)) {
    return NextResponse.json(
      { data: null, error: { message: `Table "${desc.table}" not allowed` } },
      { status: 400 }
    );
  }

  try {
    switch (desc.operation) {
      case "select":
        return await handleSelect(desc);
      case "insert":
        return await handleInsert(desc);
      case "update":
        return await handleUpdate(desc);
      case "upsert":
        return await handleUpsert(desc);
      default:
        return NextResponse.json(
          { data: null, error: { message: `Unknown operation: ${desc.operation}` } },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("DB query error:", err);
    const message = err instanceof Error ? err.message : "Database error";
    // Don't leak connection details
    const safeMessage = message.includes("DATABASE_URL")
      ? "Database not configured"
      : message;
    return NextResponse.json(
      { data: null, error: { message: safeMessage } },
      { status: 500 }
    );
  }
}

async function handleSelect(desc: QueryDescriptor) {
  const cols = desc.columns === "*" || !desc.columns ? "*" : desc.columns;
  // Validate column names in select
  if (cols !== "*") {
    const colList = cols.split(",").map((c) => c.trim());
    for (const c of colList) {
      if (!isSafeIdentifier(c)) {
        return NextResponse.json(
          { data: null, error: { message: `Invalid column: ${c}` } },
          { status: 400 }
        );
      }
    }
  }

  const params: unknown[] = [];
  let sql = `SELECT ${cols} FROM ${desc.table}`;

  // WHERE clauses
  if (desc.filters && desc.filters.length > 0) {
    const conditions = desc.filters.map((f) => {
      if (!isSafeIdentifier(f.column)) throw new Error(`Invalid column: ${f.column}`);
      const sqlOp = OP_MAP[f.op];
      if (!sqlOp) throw new Error(`Invalid operator: ${f.op}`);
      params.push(f.value);
      return `${f.column} ${sqlOp} $${params.length}`;
    });
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  // ORDER BY
  if (desc.order && desc.order.length > 0) {
    const orderParts = desc.order.map((o) => {
      if (!isSafeIdentifier(o.column)) throw new Error(`Invalid column: ${o.column}`);
      return `${o.column} ${o.ascending ? "ASC" : "DESC"}`;
    });
    sql += ` ORDER BY ${orderParts.join(", ")}`;
  }

  // LIMIT
  if (desc.limitCount && desc.limitCount > 0) {
    params.push(desc.limitCount);
    sql += ` LIMIT $${params.length}`;
  }

  const rows = await dbQuery(sql, params);

  if (desc.single) {
    return NextResponse.json({
      data: rows.length > 0 ? rows[0] : null,
      error: rows.length === 0 ? { message: "No rows returned" } : null,
    });
  }

  return NextResponse.json({ data: rows, error: null });
}

async function handleInsert(desc: QueryDescriptor) {
  if (!desc.data) {
    return NextResponse.json(
      { data: null, error: { message: "No data to insert" } },
      { status: 400 }
    );
  }

  const rows = Array.isArray(desc.data) ? desc.data : [desc.data];
  if (rows.length === 0) {
    return NextResponse.json({ data: [], error: null });
  }

  // Get columns from first row
  const columns = Object.keys(rows[0]).filter((c) => isSafeIdentifier(c));
  if (columns.length === 0) {
    return NextResponse.json(
      { data: null, error: { message: "No valid columns" } },
      { status: 400 }
    );
  }

  const params: unknown[] = [];
  const valuePlaceholders: string[] = [];

  for (const row of rows) {
    const rowPlaceholders: string[] = [];
    for (const col of columns) {
      const val = row[col];
      // Serialize objects/arrays to JSON strings for JSONB columns
      if (val !== null && typeof val === "object" && !(val instanceof Date)) {
        params.push(JSON.stringify(val));
      } else {
        params.push(val ?? null);
      }
      rowPlaceholders.push(`$${params.length}`);
    }
    valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
  }

  const sql = `INSERT INTO ${desc.table} (${columns.join(", ")}) VALUES ${valuePlaceholders.join(", ")} RETURNING *`;
  const result = await dbQuery(sql, params);

  return NextResponse.json({
    data: result,
    error: null,
  });
}

async function handleUpdate(desc: QueryDescriptor) {
  if (!desc.data || Array.isArray(desc.data)) {
    return NextResponse.json(
      { data: null, error: { message: "Update requires a single data object" } },
      { status: 400 }
    );
  }

  const columns = Object.keys(desc.data).filter((c) => isSafeIdentifier(c));
  if (columns.length === 0) {
    return NextResponse.json(
      { data: null, error: { message: "No valid columns to update" } },
      { status: 400 }
    );
  }

  const params: unknown[] = [];
  const setClauses = columns.map((col) => {
    const val = (desc.data as Record<string, unknown>)[col];
    if (val !== null && typeof val === "object" && !(val instanceof Date)) {
      params.push(JSON.stringify(val));
    } else {
      params.push(val ?? null);
    }
    return `${col} = $${params.length}`;
  });

  let sql = `UPDATE ${desc.table} SET ${setClauses.join(", ")}`;

  // WHERE from updateFilters
  if (desc.updateFilters && desc.updateFilters.length > 0) {
    const conditions = desc.updateFilters.map((f) => {
      if (!isSafeIdentifier(f.column)) throw new Error(`Invalid column: ${f.column}`);
      const sqlOp = OP_MAP[f.op];
      if (!sqlOp) throw new Error(`Invalid operator: ${f.op}`);
      params.push(f.value);
      return `${f.column} ${sqlOp} $${params.length}`;
    });
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += " RETURNING *";
  const result = await dbQuery(sql, params);

  return NextResponse.json({ data: result, error: null });
}

async function handleUpsert(desc: QueryDescriptor) {
  if (!desc.data) {
    return NextResponse.json(
      { data: null, error: { message: "No data to upsert" } },
      { status: 400 }
    );
  }

  const rows = Array.isArray(desc.data) ? desc.data : [desc.data];
  if (rows.length === 0) {
    return NextResponse.json({ data: [], error: null });
  }

  const columns = Object.keys(rows[0]).filter((c) => isSafeIdentifier(c));
  if (columns.length === 0) {
    return NextResponse.json(
      { data: null, error: { message: "No valid columns" } },
      { status: 400 }
    );
  }

  const params: unknown[] = [];
  const valuePlaceholders: string[] = [];

  for (const row of rows) {
    const rowPlaceholders: string[] = [];
    for (const col of columns) {
      const val = row[col];
      if (val !== null && typeof val === "object" && !(val instanceof Date)) {
        params.push(JSON.stringify(val));
      } else {
        params.push(val ?? null);
      }
      rowPlaceholders.push(`$${params.length}`);
    }
    valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
  }

  const conflictCol = desc.upsertOptions?.onConflict || "id";
  if (!isSafeIdentifier(conflictCol)) {
    return NextResponse.json(
      { data: null, error: { message: `Invalid conflict column: ${conflictCol}` } },
      { status: 400 }
    );
  }

  const updateCols = columns
    .filter((c) => c !== conflictCol)
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  const sql = `INSERT INTO ${desc.table} (${columns.join(", ")}) VALUES ${valuePlaceholders.join(", ")} ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateCols} RETURNING *`;
  const result = await dbQuery(sql, params);

  return NextResponse.json({ data: result, error: null });
}

// Client-side database helper -- Supabase-compatible query builder
// that routes all queries through /api/db
//
// Usage is identical to the old Supabase client:
//   import { db } from "@/lib/db";
//   const { data, error } = await db.from("food_logs").select("*").gte("timestamp", cutoff);

type FilterOp = "eq" | "gte" | "lte";

interface QueryDescriptor {
  table: string;
  operation: "select" | "insert" | "update" | "upsert" | "delete";
  columns?: string;
  filters?: { column: string; op: FilterOp; value: unknown }[];
  order?: { column: string; ascending: boolean }[];
  limitCount?: number;
  single?: boolean;
  data?: Record<string, unknown> | Record<string, unknown>[];
  upsertOptions?: { onConflict?: string };
  updateFilters?: { column: string; op: FilterOp; value: unknown }[];
  deleteFilters?: { column: string; op: FilterOp; value: unknown }[];
}

interface QueryResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: { message: string } | null;
}

class TableBuilder {
  private desc: QueryDescriptor;

  constructor(table: string) {
    this.desc = { table, operation: "select", filters: [], order: [] };
  }

  // --- Terminal operations (trigger the request) ---

  select(columns: string = "*"): FilterChain {
    this.desc.operation = "select";
    this.desc.columns = columns;
    return new FilterChain(this.desc);
  }

  insert(
    data: Record<string, unknown> | Record<string, unknown>[]
  ): Promise<QueryResult> {
    this.desc.operation = "insert";
    this.desc.data = data;
    return execute(this.desc);
  }

  update(data: Record<string, unknown>): UpdateChain {
    this.desc.operation = "update";
    this.desc.data = data;
    return new UpdateChain(this.desc);
  }

  upsert(
    data: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string }
  ): Promise<QueryResult> {
    this.desc.operation = "upsert";
    this.desc.data = data;
    this.desc.upsertOptions = options;
    return execute(this.desc);
  }

  delete(): DeleteChain {
    this.desc.operation = "delete";
    this.desc.deleteFilters = [];
    return new DeleteChain(this.desc);
  }
}

class FilterChain implements PromiseLike<QueryResult> {
  private desc: QueryDescriptor;

  constructor(desc: QueryDescriptor) {
    this.desc = desc;
  }

  eq(column: string, value: unknown): FilterChain {
    this.desc.filters!.push({ column, op: "eq", value });
    return this;
  }

  gte(column: string, value: unknown): FilterChain {
    this.desc.filters!.push({ column, op: "gte", value });
    return this;
  }

  lte(column: string, value: unknown): FilterChain {
    this.desc.filters!.push({ column, op: "lte", value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): FilterChain {
    this.desc.order!.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(count: number): FilterChain {
    this.desc.limitCount = count;
    return this;
  }

  single(): FilterChain {
    this.desc.single = true;
    this.desc.limitCount = 1;
    return this;
  }

  // Make it thenable so `await` works directly on the chain
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return execute(this.desc).then(onfulfilled, onrejected);
  }
}

class UpdateChain implements PromiseLike<QueryResult> {
  private desc: QueryDescriptor;

  constructor(desc: QueryDescriptor) {
    this.desc = desc;
    this.desc.updateFilters = [];
  }

  eq(column: string, value: unknown): UpdateChain {
    this.desc.updateFilters!.push({ column, op: "eq", value });
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return execute(this.desc).then(onfulfilled, onrejected);
  }
}

class DeleteChain implements PromiseLike<QueryResult> {
  private desc: QueryDescriptor;

  constructor(desc: QueryDescriptor) {
    this.desc = desc;
    this.desc.deleteFilters = this.desc.deleteFilters || [];
  }

  eq(column: string, value: unknown): DeleteChain {
    this.desc.deleteFilters!.push({ column, op: "eq", value });
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return execute(this.desc).then(onfulfilled, onrejected);
  }
}

async function execute(desc: QueryDescriptor): Promise<QueryResult> {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(desc),
    });
    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: { message: text || `HTTP ${res.status}` } };
    }
    const result = await res.json();
    return result;
  } catch (err) {
    return {
      data: null,
      error: { message: (err as Error).message || "Network error" },
    };
  }
}

// Exported singleton -- mirrors the old `supabase` import
export const db = {
  from(table: string): TableBuilder {
    return new TableBuilder(table);
  },
};

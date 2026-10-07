import type { Database, SqlValue } from "sql.js";

export type GridCell = string | number | null;
export type QueryOutcome = { ok: true; columns: string[]; rows: GridCell[][]; truncated: boolean } | { ok: false; error: string };

/** Runs one statement on an in-memory sql.js database. Results are capped; errors come back as data. */
export function runQuery(db: Database, sql: string, maxRows = 500): QueryOutcome {
  if (!sql.trim()) return { ok: false, error: "Type a query first." };
  try {
    const results = db.exec(sql);
    const last = results[results.length - 1];
    if (!last) return { ok: true, columns: [], rows: [], truncated: false };
    const toCell = (v: SqlValue): GridCell => (v instanceof Uint8Array ? "(binary)" : v);
    return { ok: true, columns: last.columns, rows: last.values.slice(0, maxRows).map((r) => r.map(toCell)), truncated: last.values.length > maxRows };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface TableInfo {
  name: string;
  columns: { name: string; type: string }[];
}

/** Lists the user tables and their columns, for the schema viewer. */
export function listSchema(db: Database): TableInfo[] {
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.flat() ?? [];
  return tables.map((name) => ({
    name: String(name),
    columns: (db.exec(`PRAGMA table_info("${String(name).replace(/"/g, '""')}")`)[0]?.values ?? []).map((c) => ({ name: String(c[1]), type: String(c[2] || "") })),
  }));
}

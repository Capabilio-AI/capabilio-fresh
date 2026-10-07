import initSqlJs from "sql.js";
import type { RunSql } from "@/lib/arena-challenges/checks";
import type { SqlResult } from "@/lib/arena-workstations/engines/sql-runner";

/** Offline SQL runner (sql.js) for validating authored challenges: each query gets a fresh in-memory database built from the seed. */
export const sqlJsRunner: RunSql = async (seedSql, queries) => {
  const SQL = await initSqlJs();
  return queries.map((query): SqlResult => {
    const db = new SQL.Database();
    try {
      db.run(seedSql);
      const last = db.exec(query).at(-1);
      if (!last) return { columns: [], rows: [], truncated: false };
      return { columns: last.columns, rows: last.values.map((r) => r.map((v) => (v instanceof Uint8Array ? null : v))), truncated: false };
    } catch (e) {
      return { error: (e as Error).message };
    } finally {
      db.close();
    }
  });
};

import { MAX_ROWS, runSqlLocal } from "@/lib/workplace/sql/local-runner";

export { MAX_ROWS };

export type SqlCell = string | number | null;
export type SqlResult = { columns: string[]; rows: SqlCell[][]; truncated: boolean } | { error: string };

/**
 * Runs each query on a fresh in-memory database built from the seed, in an isolated worker with a hard time limit.
 * (This used to call a public code-running service that took 10-16 seconds per request.)
 */
export async function runSqlQueries(seedSql: string, queries: string[]): Promise<SqlResult[]> {
  return runSqlLocal(seedSql, queries);
}

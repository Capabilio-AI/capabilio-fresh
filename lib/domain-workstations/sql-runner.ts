import { runCode } from "@/lib/code-execution/wandbox";

export const MAX_ROWS = 500;

// Fixed harness: the seed and the queries arrive as JSON on stdin, never
// interpolated into code. Each query runs on a fresh in-memory SQLite db,
// so a DROP/DELETE in one query can't affect another (or the grader's).
const HARNESS = `
import sys, json, sqlite3, time
data = json.load(sys.stdin)
out = []
for q in data["queries"]:
    conn = sqlite3.connect(":memory:")
    conn.executescript(data["seed"])
    deadline = time.time() + 3
    conn.set_progress_handler(lambda: 1 if time.time() > deadline else 0, 20000)
    try:
        cur = conn.execute(q)
        cols = [d[0] for d in cur.description] if cur.description else []
        rows = cur.fetchmany(${MAX_ROWS + 1})
        out.append({"columns": cols, "rows": rows[:${MAX_ROWS}], "truncated": len(rows) > ${MAX_ROWS}})
    except Exception as e:
        msg = "Query took too long (over 3 seconds) and was stopped." if "interrupted" in str(e) else str(e)
        out.append({"error": msg})
print(json.dumps(out))
`;

export type SqlCell = string | number | null;
export type SqlResult = { columns: string[]; rows: SqlCell[][]; truncated: boolean } | { error: string };

export async function runSqlQueries(seedSql: string, queries: string[]): Promise<SqlResult[]> {
  const result = await runCode("python", HARNESS, JSON.stringify({ seed: seedSql, queries }));
  if (result.stderr || result.compileError) {
    throw new Error(`SQL runner failed: ${(result.stderr || result.compileError).slice(0, 300)}`);
  }
  return JSON.parse(result.stdout) as SqlResult[];
}

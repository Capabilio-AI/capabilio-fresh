import type { Dataset } from "./dataset";

export type Dialect = "sqlite" | "postgres";

function columnType(type: "number" | "text" | "date", values: unknown[], dialect: Dialect): string {
  if (type === "number") {
    if (values.every((v) => Number.isInteger(v))) return "INTEGER";
    return dialect === "postgres" ? "NUMERIC(12,2)" : "REAL";
  }
  return type === "date" && dialect === "postgres" ? "DATE" : "TEXT";
}

/** Pure. Builds the seed script from validated structured data — the AI never supplies DDL. */
export function buildSeedSql(tables: Dataset[], dialect: Dialect = "sqlite"): string {
  const lines: string[] = [];
  for (const t of tables) {
    const cols = t.columns.map((c, j) => `"${c.name}" ${c.sqlType ?? columnType(c.type, t.rows.map((r) => r[j]).filter((v) => v !== null), dialect)}`);
    lines.push(`CREATE TABLE "${t.name}" (${cols.join(", ")});`);
    for (const row of t.rows) {
      const vals = row.map((v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`));
      lines.push(`INSERT INTO "${t.name}" VALUES (${vals.join(", ")});`);
    }
  }
  return lines.join("\n");
}

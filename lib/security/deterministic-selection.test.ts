import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(rel);
  }
  return out;
}

describe("no unordered 'pick the first row' queries", () => {
  it("every .limit(1) in app code has an .order() in the same query chain", () => {
    const offenders: string[] = [];
    for (const f of ["app", "lib", "components"].flatMap((d) => walk(d))) {
      const src = readFileSync(join(ROOT, f), "utf8");
      for (const m of src.matchAll(/\.limit\(1\)/g)) {
        const chain = src.slice(Math.max(0, m.index! - 400), m.index!);
        const stmtStart = Math.max(chain.lastIndexOf(";"), chain.lastIndexOf("await "), chain.lastIndexOf("= "));
        if (!chain.slice(stmtStart < 0 ? 0 : stmtStart).includes(".order(")) offenders.push(`${f}:${src.slice(0, m.index).split("\n").length}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("SQL functions that use limit 1 order first (migration 035)", () => {
    const sql = readFileSync(join(ROOT, "supabase/migrations/035_deterministic_row_selection.sql"), "utf8");
    for (const block of sql.split(/limit 1;/).slice(0, -1)) {
      expect(block.trimEnd().split("\n").slice(-1)[0]).toMatch(/order by/i);
    }
    expect(sql).toMatch(/create unique index if not exists institutions_name_lower_key/i);
  });
});

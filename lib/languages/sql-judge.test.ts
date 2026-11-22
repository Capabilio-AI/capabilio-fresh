import { describe, expect, it } from "vitest";
import { judgeSqlChallenge, sameResult } from "./sql-judge";
import type { SqlChallenge } from "./types";

const t = (columns: string[], rows: (string | number | null)[][]) => ({ columns, rows, truncated: false as const });

describe("sameResult", () => {
  it("ignores column names and, unless ordered, the order of rows", () => {
    expect(sameResult(t(["a"], [[1], [2]]), t(["x"], [[2], [1]]), false)).toBe(true);
    expect(sameResult(t(["a"], [[1], [2]]), t(["x"], [[2], [1]]), true)).toBe(false);
  });
  it("matches numbers to four decimals and numeric text, and tells null from the text 'null'", () => {
    expect(sameResult(t(["a"], [[1.00001]]), t(["a"], [[1]]), true)).toBe(true);
    expect(sameResult(t(["a"], [[2]]), t(["a"], [["2"]]), true)).toBe(true);
    expect(sameResult(t(["a"], [[null]]), t(["a"], [["null"]]), true)).toBe(false);
  });
  it("needs the same number of rows and columns", () => {
    expect(sameResult(t(["a"], [[1]]), t(["a"], [[1], [1]]), false)).toBe(false);
    expect(sameResult(t(["a", "b"], [[1, 2]]), t(["a"], [[1]]), false)).toBe(false);
  });
});

const people = (rows: (string | number | null)[][]) => [{ name: "people", columns: [{ name: "name", type: "text" as const }, { name: "age", type: "number" as const }], rows }];
const query: SqlChallenge = {
  kind: "sql", title: "t", statement: "s", mode: "query", ordered: true, probes: [], starter: "", commonMistakes: [],
  reference: "SELECT name FROM people WHERE age >= 18 ORDER BY name",
  datasets: [people([["Asha", 20], ["Ravi", 15], ["Meena", 30]]), people([["Zed", 18], ["Amy", 17], ["Bob", 40]])],
};

describe("judgeSqlChallenge (query mode)", () => {
  it("passes the reference's own query on every dataset", async () => {
    const r = await judgeSqlChallenge(query, "select name from people where age >= 18 order by name", "submit");
    expect(r.passed).toBe(true);
    expect(r.rows.map((x) => x.hidden)).toEqual([false, true]);
  });
  it("fails an answer that only fits the visible rows, and reports hidden datasets as pass or fail only", async () => {
    const r = await judgeSqlChallenge(query, "SELECT 'Asha' UNION SELECT 'Meena' ORDER BY 1", "submit");
    expect(r.passed).toBe(false);
    expect(r.rows[0].passed).toBe(true);
    expect(r.rows[1]).toEqual({ index: 1, passed: false, hidden: true });
  });
  it("tells the student their query failed, and refuses two statements", async () => {
    const bad = await judgeSqlChallenge(query, "SELEC name FROM people", "run");
    expect(bad.rows[0].message).toMatch(/Your query failed/);
    expect((await judgeSqlChallenge(query, "SELECT 1; SELECT 2", "run")).rows[0].message).toBe("Write one query only.");
  });
  it("counts row order when the task is ordered", async () => {
    expect((await judgeSqlChallenge(query, "SELECT name FROM people WHERE age >= 18 ORDER BY name DESC", "run")).passed).toBe(false);
  });
});

const script: SqlChallenge = {
  kind: "sql", title: "t", statement: "s", mode: "script", ordered: true, starter: "", commonMistakes: [],
  reference: "ALTER TABLE people ADD COLUMN adult INTEGER; UPDATE people SET adult = age >= 18;",
  probes: ["SELECT name, adult FROM people ORDER BY name"],
  datasets: [people([["Asha", 20], ["Ravi", 15]]), people([["Bob", 40], ["Cy", 3]])],
};

describe("judgeSqlChallenge (script mode)", () => {
  it("passes a script that leaves the same database", async () => {
    expect((await judgeSqlChallenge(script, "ALTER TABLE people ADD COLUMN adult INTEGER;\nUPDATE people SET adult = CASE WHEN age >= 18 THEN 1 ELSE 0 END;", "submit")).passed).toBe(true);
  });
  it("fails a script that leaves a different database, a failing script, and a wrong name", async () => {
    expect((await judgeSqlChallenge(script, "ALTER TABLE people ADD COLUMN adult INTEGER; UPDATE people SET adult = 1;", "run")).passed).toBe(false);
    expect((await judgeSqlChallenge(script, "DROP TABLE nothing;", "run")).rows[0].message).toMatch(/Your script failed/);
    expect((await judgeSqlChallenge(script, "ALTER TABLE people ADD COLUMN grown INTEGER;", "run")).rows[0].message).toMatch(/check could not run/);
  });
});

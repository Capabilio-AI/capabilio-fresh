import { describe, expect, it } from "vitest";
import { DatasetSpec, generateTables, seedOf, toCsv } from "./dataset";

const customers = DatasetSpec.parse({ name: "customers", description: "d", rows: 50, columns: [{ name: "customer_id", type: "id" }, { name: "plan", type: "category", choices: ["basic", "pro"] }] });
const tickets = DatasetSpec.parse({ name: "tickets", description: "d", rows: 80, columns: [{ name: "ticket_id", type: "id" }, { name: "customer_id", type: "category", ref: "customers.customer_id" }, { name: "note", type: "number", min: 1, max: 5, missingRate: 0.2 }] });
const curing = DatasetSpec.parse({ name: "cubes", description: "d", rows: 300, columns: [{ name: "days", type: "integer", min: 1, max: 28 }, { name: "strength", type: "number", from: "days", factor: 1.2, offset: 10, noise: 1 }] });

describe("generateTables", () => {
  it("gives the same data for the same seed and different data for another", () => {
    expect(generateTables([customers], seedOf("p1"))).toEqual(generateTables([customers], seedOf("p1")));
    expect(generateTables([customers], seedOf("p1"))).not.toEqual(generateTables([customers], seedOf("p2")));
  });
  it("builds the requested number of rows and sequential ids", () => {
    const [t] = generateTables([customers], 1);
    expect(t.rows).toHaveLength(50);
    expect(t.rows[0][0]).toBe(1);
    expect(t.rows[49][0]).toBe(50);
  });
  it("only references ids that exist in the earlier table", () => {
    const [c, t] = generateTables([customers, tickets], 7);
    const ids = new Set(c.rows.map((r) => r[0]));
    expect(t.rows.every((r) => ids.has(r[1] as number))).toBe(true);
  });
  it("leaves some cells empty when asked, and keeps numbers in range", () => {
    const [t] = generateTables([{ ...tickets, columns: tickets.columns.filter((c) => c.name !== "customer_id") }], 3);
    const empty = t.rows.filter((r) => r[1] === "").length;
    expect(empty).toBeGreaterThan(5);
    expect(t.rows.filter((r) => r[1] !== "").every((r) => (r[1] as number) >= 1 && (r[1] as number) <= 5)).toBe(true);
  });
  it("makes a numeric column follow another, with noise", () => {
    const [t] = generateTables([curing], 9);
    const xs = t.rows.map((r) => r[0] as number), ys = t.rows.map((r) => r[1] as number);
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const corr = cov / Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
    expect(corr).toBeGreaterThan(0.9);
  });
});

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv({ name: "t", header: ["a", "b"], rows: [["x,y", 'say "hi"'], [1, ""]] })).toBe('a,b\n"x,y","say ""hi"""\n1,\n');
  });
});

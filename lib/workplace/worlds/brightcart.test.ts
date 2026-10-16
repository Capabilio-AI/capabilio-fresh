import { describe, expect, it } from "vitest";
import { datasetProblems } from "@/lib/arena-workstations/engines/dataset";
import { buildSeedSql } from "@/lib/arena-workstations/tools/sql";
import { generateBrightCart, BRIGHTCART } from "./brightcart";

const col = (ds: { columns: { name: string }[]; rows: unknown[][] }, name: string) => ds.rows.map((r) => r[ds.columns.findIndex((c) => c.name === name)]);
const table = (tables: ReturnType<typeof generateBrightCart>, name: string) => tables.find((t) => t.name === name)!;

describe("BrightCart warehouse", () => {
  it("is identical for the same seed and different for another user", () => {
    expect(generateBrightCart(11)).toEqual(generateBrightCart(11));
    expect(generateBrightCart(11)).not.toEqual(generateBrightCart(12));
  });

  it("builds four valid tables of realistic size", () => {
    const tables = generateBrightCart(5);
    expect(tables.map((t) => t.name)).toEqual(["customers", "products", "orders", "order_items"]);
    for (const t of tables) expect(datasetProblems(t, { minRows: 5, maxRows: 2000 })).toEqual([]);
    expect(table(tables, "orders").rows.length).toBeGreaterThanOrEqual(180);
    expect(table(tables, "order_items").rows.length).toBeGreaterThan(table(tables, "orders").rows.length);
  });

  it("keeps every foreign key valid and every date inside 2026-01..2026-09", () => {
    const tables = generateBrightCart(21);
    const customers = new Set(col(table(tables, "customers"), "customer_id"));
    const products = new Set(col(table(tables, "products"), "product_id"));
    const orders = new Set(col(table(tables, "orders"), "order_id"));
    for (const id of col(table(tables, "orders"), "customer_id")) expect(customers.has(id)).toBe(true);
    for (const id of col(table(tables, "order_items"), "order_id")) expect(orders.has(id)).toBe(true);
    for (const id of col(table(tables, "order_items"), "product_id")) expect(products.has(id)).toBe(true);
    for (const d of col(table(tables, "orders"), "order_date") as string[]) {
      expect(d >= "2026-01-01" && d <= "2026-09-30").toBe(true);
    }
  });

  it("uses only known statuses and plants messy city text for cleaning tickets", () => {
    const tables = generateBrightCart(33);
    const statuses = new Set(col(table(tables, "orders"), "status") as string[]);
    for (const s of statuses) expect(BRIGHTCART.statuses).toContain(s);
    expect(statuses.has("delivered")).toBe(true);
    const cities = col(table(tables, "customers"), "city") as string[];
    expect(cities.some((c) => c !== c.trim() || c !== c.trim().replace(/^./, (x) => x.toUpperCase()).replace(/(?<=.)./g, (x) => x.toLowerCase()))).toBe(true);
  });

  it("produces a seed script the SQL runner can load", () => {
    expect(buildSeedSql(generateBrightCart(2))).toContain('CREATE TABLE "order_items"');
  });
});

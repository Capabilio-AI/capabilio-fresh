import { describe, expect, it } from "vitest";
import { buildSeedSql } from "./seed-sql";
import type { Dataset } from "./dataset";

const t: Dataset = {
  name: "orders",
  columns: [{ name: "id", type: "number" }, { name: "price", type: "number" }, { name: "placed", type: "date" }, { name: "note", type: "text" }],
  rows: [[1, 10.5, "2026-01-02", "it's fine"], [2, 3, "2026-02-03", null]],
};

describe("buildSeedSql", () => {
  it("keeps the SQLite types by default", () => {
    const sql = buildSeedSql([t]);
    expect(sql).toContain('CREATE TABLE "orders" ("id" INTEGER, "price" REAL, "placed" TEXT, "note" TEXT);');
    expect(sql).toContain("INSERT INTO \"orders\" VALUES (1, 10.5, '2026-01-02', 'it''s fine');");
  });

  it("uses real Postgres types for the postgres dialect: exact numbers and true dates", () => {
    const sql = buildSeedSql([t], "postgres");
    expect(sql).toContain('"id" INTEGER, "price" NUMERIC(12,2), "placed" DATE, "note" TEXT');
  });

  it("uses an exact column type when the table says so, even with no rows to infer from", () => {
    const empty: Dataset = { name: "summary", columns: [{ name: "revenue", type: "number", sqlType: "numeric(12,2)" }, { name: "orders", type: "number" }], rows: [] };
    expect(buildSeedSql([empty], "postgres")).toContain('"revenue" numeric(12,2), "orders" INTEGER');
  });

  it("can build an empty table", () => {
    expect(buildSeedSql([{ ...t, name: "audit", rows: [] }], "postgres")).toContain('CREATE TABLE "audit"');
  });
});

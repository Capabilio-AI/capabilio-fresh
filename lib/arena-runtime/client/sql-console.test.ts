import { beforeAll, describe, expect, it } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { listSchema, runQuery } from "./sql-console";

let db: Database;
beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run("create table orders (id integer primary key, status text, amount real); insert into orders values (1,'delivered',10.5),(2,'cancelled',4),(3,'delivered',7);");
});

describe("runQuery", () => {
  it("returns columns and rows", () => {
    expect(runQuery(db, "select status, sum(amount) as total from orders group by status order by status")).toEqual({ ok: true, columns: ["status", "total"], rows: [["cancelled", 4], ["delivered", 17.5]], truncated: false });
  });
  it("caps rows and says so", () => {
    expect(runQuery(db, "select * from orders", 2)).toMatchObject({ ok: true, truncated: true, rows: expect.arrayContaining([expect.any(Array)]) });
  });
  it("reports SQL errors as data", () => {
    const r = runQuery(db, "select * from nope");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/no such table/);
  });
  it("handles an empty query and statements with no result set", () => {
    expect(runQuery(db, "  ")).toMatchObject({ ok: false });
    expect(runQuery(db, "create table t(x)")).toEqual({ ok: true, columns: [], rows: [], truncated: false });
  });
});

describe("listSchema", () => {
  it("lists tables and columns", () => {
    expect(listSchema(db)[0]).toEqual({ name: "orders", columns: [{ name: "id", type: "INTEGER" }, { name: "status", type: "TEXT" }, { name: "amount", type: "REAL" }] });
  });
});

import { describe, expect, it } from "vitest";
import { sqlHash } from "./record";

describe("sqlHash", () => {
  it("treats the same query written differently as the same query", () => {
    expect(sqlHash("SELECT  *\nFROM orders")).toBe(sqlHash("select * from orders  "));
  });
  it("tells different queries apart and never contains the query text", () => {
    expect(sqlHash("select 1")).not.toBe(sqlHash("select 2"));
    expect(sqlHash("select secret from t")).toMatch(/^[0-9a-f]{16}$/);
  });
});

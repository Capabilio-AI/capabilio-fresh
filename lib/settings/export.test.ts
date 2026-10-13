import { describe, expect, it } from "vitest";
import { buildAccountExport, EXPORT_SOURCES, ROWS_PER_TABLE, type ExportClient } from "./export";

function fakeClient(rowsByTable: Record<string, unknown[] | "error">): ExportClient {
  return {
    from: (table) => ({
      select: () => ({
        eq: (col, value) => ({
          limit: async () => {
            const rows = rowsByTable[table];
            if (rows === "error") return { data: null, error: { message: "boom" } };
            return { data: (rows ?? []).map((r) => ({ ...(r as object), _col: col, _val: value })), error: null };
          },
        }),
      }),
    }),
  };
}

const user = { id: "u1", email: "a@b.co" };
const now = new Date("2026-10-13T00:00:00Z");

describe("buildAccountExport", () => {
  it("keys rows by table, scoped to the user, and omits empty tables", async () => {
    const out = await buildAccountExport(fakeClient({ profiles: [{ id: "u1" }], vault_items: [{ id: 1 }, { id: 2 }] }), user, now);
    expect(Object.keys(out.tables).sort()).toEqual(["profiles", "vault_items"]);
    expect(out.tables.vault_items).toHaveLength(2);
    expect(out.tables.vault_items[0]).toMatchObject({ _col: "user_id", _val: "u1" });
    expect(out.incomplete).toEqual([]);
    expect(out.exportedAt).toBe("2026-10-13T00:00:00.000Z");
  });

  it("reports a table that failed instead of pretending the file is complete", async () => {
    const out = await buildAccountExport(fakeClient({ posts: "error" }), user, now);
    expect(out.incomplete).toEqual([{ table: "posts", reason: "could not be read" }]);
  });

  it("flags a table that hit the row cap", async () => {
    const many = Array.from({ length: ROWS_PER_TABLE }, (_, i) => ({ i }));
    const out = await buildAccountExport(fakeClient({ stories: many }), user, now);
    expect(out.incomplete[0]?.table).toBe("stories");
  });

  it("never exports integration tokens", () => {
    expect(EXPORT_SOURCES.map((s) => s.table)).not.toContain("github_connections");
  });
});

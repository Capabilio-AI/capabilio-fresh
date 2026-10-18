import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { notify } from "./notify";

type Row = { user_id: string; type: string; title: string; body: string | null; href: string | null; dedupe_key: string | null };

function fakeService(opts: { fail?: boolean } = {}) {
  const calls: { rows: Row[]; options: Record<string, unknown> }[] = [];
  const upsert = vi.fn(async (rows: Row[], options: Record<string, unknown>) => {
    calls.push({ rows, options });
    return opts.fail ? { error: new Error("db down"), count: null } : { error: null, count: rows.length };
  });
  const service = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient<Database>;
  return { service, calls };
}

describe("notify", () => {
  it("stores one row per distinct person and never notifies the actor", async () => {
    const { service, calls } = fakeService();
    const n = await notify(service, { userIds: ["a", "b", "b", "actor"], actorId: "actor", type: "t", title: "Hello", dedupeKey: "k" });
    expect(n).toBe(2);
    expect(calls[0].rows.map((r) => r.user_id)).toEqual(["a", "b"]);
    expect(calls[0].options).toMatchObject({ onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  });

  it("does nothing for an empty audience", async () => {
    const { service, calls } = fakeService();
    expect(await notify(service, { userIds: [], type: "t", title: "x" })).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("truncates long text and never throws when the database fails", async () => {
    const ok = fakeService();
    await notify(ok.service, { userIds: ["a"], type: "t", title: "x".repeat(500), body: "y".repeat(900) });
    expect(ok.calls[0].rows[0].title).toHaveLength(200);
    expect(ok.calls[0].rows[0].body).toHaveLength(500);

    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = fakeService({ fail: true });
    await expect(notify(bad.service, { userIds: ["a"], type: "t", title: "x" })).resolves.toBe(0);
  });

  it("splits a large audience into chunks", async () => {
    const { service, calls } = fakeService();
    const ids = Array.from({ length: 1201 }, (_, i) => `u${i}`);
    expect(await notify(service, { userIds: ids, type: "t", title: "x" })).toBe(1201);
    expect(calls.map((c) => c.rows.length)).toEqual([500, 500, 201]);
  });
});

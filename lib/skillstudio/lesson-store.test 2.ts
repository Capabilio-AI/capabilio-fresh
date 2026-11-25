import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { promptHash, storedOrWritten } from "./lesson-store";

const Shape = z.object({ summary: z.string() });
const key = { careerId: "c1", nodeKey: "gd-t", kind: "theory" as const };

/** A one-table fake of the Supabase calls the store makes: select-one and upsert. */
function fakeService(row: { prompt_hash: string; content: unknown } | null) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const chain: Record<string, unknown> = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: row }), upsert };
  return { service: { from: () => chain } as unknown as SupabaseClient<Database>, upsert };
}

describe("storedOrWritten", () => {
  it("serves the stored lesson without calling the AI when the prompt is unchanged", async () => {
    const { service, upsert } = fakeService({ prompt_hash: promptHash("s", "p"), content: { summary: "kept" } });
    const write = vi.fn();
    const out = await storedOrWritten(service, key, promptHash("s", "p"), Shape, write);
    expect(out).toEqual({ lesson: { summary: "kept" }, fromStore: true });
    expect(write).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
  it("writes and stores a new lesson when nothing is stored, or the prompt changed, or the stored one is malformed", async () => {
    for (const row of [null, { prompt_hash: "old", content: { summary: "stale" } }, { prompt_hash: promptHash("s", "p"), content: { wrong: 1 } }]) {
      const { service, upsert } = fakeService(row);
      const out = await storedOrWritten(service, key, promptHash("s", "p"), Shape, async () => ({ summary: "fresh" }));
      expect(out).toEqual({ lesson: { summary: "fresh" }, fromStore: false });
      expect(upsert).toHaveBeenCalledOnce();
    }
  });
});

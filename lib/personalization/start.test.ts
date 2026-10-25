import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { startPathway } from "./start";

const service = {} as SupabaseClient<Database>;

describe("startPathway", () => {
  it("schedules the roadmap build when a run was started", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const tasks: (() => Promise<unknown>)[] = [];
    const out = await startPathway(service, "career-1", { request: vi.fn().mockResolvedValue({ state: "STARTED", runId: "run-1" }), run, schedule: (t) => tasks.push(t) });
    expect(out).toEqual({ state: "STARTED", runId: "run-1" });
    expect(tasks).toHaveLength(1);
    await tasks[0]();
    expect(run).toHaveBeenCalledWith(service, "run-1", "career-1");
  });

  it.each([["READY"], ["RUNNING"]] as const)("starts nothing when the roadmap is %s (a duplicate request is a no-op)", async (state) => {
    const schedule = vi.fn();
    await startPathway(service, "career-1", { request: vi.fn().mockResolvedValue({ state }), run: vi.fn(), schedule });
    expect(schedule).not.toHaveBeenCalled();
  });

  it("starts nothing while a failed run cools down", async () => {
    const schedule = vi.fn();
    const out = await startPathway(service, "career-1", { request: vi.fn().mockResolvedValue({ state: "COOLDOWN", message: "later" }), run: vi.fn(), schedule });
    expect(out.state).toBe("COOLDOWN");
    expect(schedule).not.toHaveBeenCalled();
  });
});

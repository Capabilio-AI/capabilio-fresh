import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.fn();
let authed: { userId: string } | { error: Response } = { userId: "u1" };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/lib/api/require-user", () => ({ requireUser: async () => authed }));
vi.mock("@/lib/rate-limit/check", () => ({ checkRateLimit: async () => ({ allowed: true, remaining: 10 }), rateLimitedResponse: () => new Response(null, { status: 429 }) }));
vi.mock("@/lib/arena-workstations/attempts", () => ({ recordWorkTime: (...a: unknown[]) => record(...a) }));

import { POST } from "./route";

const ID = "11111111-1111-1111-1111-111111111111";
const call = (id = ID) => POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ attemptId: id }) });

beforeEach(() => {
  record.mockReset();
  authed = { userId: "u1" };
});

describe("ticket clock route", () => {
  it("reports the signed-in student's own clock", async () => {
    record.mockResolvedValue(95);
    const res = await call();
    expect(await res.json()).toEqual({ timeSpentSeconds: 95 });
    expect(record).toHaveBeenCalledWith(expect.anything(), "u1", ID);
  });

  it("needs a signed-in student, and rejects a malformed id without touching the database", async () => {
    authed = { error: new Response(null, { status: 401 }) };
    expect((await call()).status).toBe(401);
    authed = { userId: "u1" };
    expect((await call("nope")).status).toBe(404);
    expect(record).not.toHaveBeenCalled();
  });
});

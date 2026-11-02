import { beforeEach, describe, expect, it, vi } from "vitest";

const expire = vi.fn();
let authed: { userId: string } | { error: Response } = { userId: "u1" };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/lib/api/require-user", () => ({ requireUser: async () => authed }));
vi.mock("@/lib/rate-limit/check", () => ({ checkRateLimit: async () => ({ allowed: true, remaining: 10 }), rateLimitedResponse: () => new Response(null, { status: 429 }) }));
vi.mock("@/lib/arena-workstations/attempts", () => {
  class AttemptError extends Error {
    constructor(message: string, readonly status: number, readonly extra: Record<string, unknown> = {}) { super(message); }
  }
  return { AttemptError, TIME_UP_TOLERANCE_SECONDS: 20, expireIfTimedOut: (...a: unknown[]) => expire(...a) };
});

import { AttemptError } from "@/lib/arena-workstations/attempts";
import { POST } from "./route";

const ID = "11111111-1111-1111-1111-111111111111";
const call = (id = ID) => POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ attemptId: id }) });

beforeEach(() => {
  expire.mockReset();
  authed = { userId: "u1" };
});

describe("time-up route", () => {
  it("closes the student's own ticket and reports the rating change, allowing the browser's clock to be a little ahead", async () => {
    expire.mockResolvedValue({ eloChange: -8, nextAvailableAt: "2026-11-03T00:00:00Z" });
    const res = await call();
    expect(await res.json()).toEqual({ eloChange: -8, nextAvailableAt: "2026-11-03T00:00:00Z" });
    expect(expire).toHaveBeenCalledWith(expect.anything(), "u1", ID, 20);
  });

  it("says it is not time yet instead of closing anything early", async () => {
    expire.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "not_yet" });
  });

  it("passes on a refusal with its code, so the workspace stops asking for a ticket that cannot expire", async () => {
    expire.mockRejectedValue(new AttemptError("A Proof Session stage has no time limit of this kind.", 409, { code: "not_applicable" }));
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "not_applicable" });
  });

  it("needs a signed-in student and a well-formed id", async () => {
    authed = { error: new Response(null, { status: 401 }) };
    expect((await call()).status).toBe(401);
    authed = { userId: "u1" };
    expect((await call("nope")).status).toBe(404);
    expect(expire).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const find = vi.fn();
const getRecord = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/lib/recruiter/shares", () => ({ findShareByToken: (...a: unknown[]) => find(...a) }));
vi.mock("@/lib/evidence/records", () => ({ getEvidenceRecord: (...a: unknown[]) => getRecord(...a) }));
vi.mock("@/lib/arena/attempt-evidence", () => ({ evidenceFromRecord: () => ({ title: "Task one" }) }));

import { GET } from "./route";

const A1 = "11111111-1111-1111-1111-111111111111";
const A2 = "22222222-2222-2222-2222-222222222222";
const future = new Date(Date.now() + 86_400_000).toISOString();
const active = { userId: "u1", attemptIds: [A1], expiresAt: future, revokedAt: null };
const call = (attemptId: string) => GET(new Request("http://x"), { params: Promise.resolve({ token: "t".repeat(32), attemptId }) });

beforeEach(() => {
  find.mockReset();
  getRecord.mockReset();
  getRecord.mockResolvedValue({ attemptId: A1 });
});

describe("recruiter evidence route", () => {
  it("opens a task that is in an active share, asking for it as the share's owner, and is never cached", async () => {
    find.mockResolvedValue(active);
    const res = await call(A1);
    expect(res.status).toBe(200);
    expect(getRecord).toHaveBeenCalledWith(expect.anything(), A1, "u1");
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
  });

  it("answers the same 404 for an unknown link, a revoked or expired one, a task outside the share and a bad id", async () => {
    const bodies: unknown[] = [];
    for (const [share, id] of [
      [null, A1],
      [{ ...active, revokedAt: "2026-11-01T00:00:00Z" }, A1],
      [{ ...active, expiresAt: "2026-01-01T00:00:00Z" }, A1],
      [active, A2],
      [active, "not-an-id"],
    ] as const) {
      find.mockResolvedValue(share);
      const res = await call(id);
      expect(res.status).toBe(404);
      bodies.push(await res.json());
    }
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
    expect(getRecord).not.toHaveBeenCalled();
  });

  it("is a 404 when the record behind an allowed task is missing", async () => {
    find.mockResolvedValue(active);
    getRecord.mockResolvedValue(null);
    expect((await call(A1)).status).toBe(404);
  });
});

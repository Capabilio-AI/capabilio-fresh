import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.fn();
const evidence = vi.fn();
let profile: { id: string } | null = { id: "owner-1" };

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }) }) }),
}));
vi.mock("@/lib/evidence/records", () => ({ getEvidenceRecord: (...a: unknown[]) => record(...a) }));
vi.mock("@/lib/arena/attempt-evidence", () => ({ getAttemptEvidence: (...a: unknown[]) => evidence(...a) }));

import { GET } from "./route";

const ID = "11111111-1111-1111-1111-111111111111";
const call = () => GET(new Request("http://x"), { params: Promise.resolve({ slug: "s", attemptId: ID }) });

beforeEach(() => {
  record.mockReset();
  evidence.mockReset();
  profile = { id: "owner-1" };
  evidence.mockResolvedValue({ title: "Task" });
});

describe("public evidence route", () => {
  it("serves a shared sealed record, asking for it as the portfolio's owner", async () => {
    record.mockResolvedValue({ shared: true });
    const res = await call();
    expect(res.status).toBe(200);
    expect(evidence).toHaveBeenCalledWith(expect.anything(), ID, "owner-1");
  });

  it("answers 404 for a record the student hides, exactly as for one that does not exist, and never reads the evidence", async () => {
    record.mockResolvedValue({ shared: false });
    const hidden = await call();
    expect(hidden.status).toBe(404);
    expect(evidence).not.toHaveBeenCalled();
    profile = null;
    const missing = await call();
    expect(missing.status).toBe(404);
    expect(await hidden.json()).toEqual(await missing.json());
  });

  it("still serves older tasks that have no sealed record", async () => {
    record.mockResolvedValue(null);
    expect((await call()).status).toBe(200);
  });

  it("rejects a malformed attempt id without touching the database", async () => {
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ slug: "s", attemptId: "nope" }) });
    expect(res.status).toBe(404);
    expect(record).not.toHaveBeenCalled();
  });
});

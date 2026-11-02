import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./fake-db";

const portfolio = vi.fn();
vi.mock("@/lib/portfolio/data", () => ({ getPortfolioData: (...a: unknown[]) => portfolio(...a) }));

import { createShare, findShareByToken, listShares, loadRecruiterPack, revokeShare } from "./shares";

const NOW = new Date("2026-11-02T10:00:00Z");
const record = (id: string, userId: string, title: string) => ({
  attempt_id: id, user_id: userId, role_key: "data-analyst", area_key: "sql", area_name: "SQL", company: "BrightCart", skill_ids: [], difficulty: "easy", tool_type: "sql_workspace", title, requester: null, scenario: "s",
  objective: "o", submission: { query: "SELECT 1" }, grade: { passed: true, message: "ok", checks: [] }, submissions: 1, grading_version: "v1", generation_version: "v1", assigned_at: "2026-11-01T09:00:00Z",
  completed_at: "2026-11-01T10:00:00Z", explained: true, explanation_score: 80, schema_version: 1, fingerprint: "f".repeat(64), shared: true,
});
const world = () => ({
  evidence_records: [record("a1", "u1", "Task one"), record("a2", "u1", "Task two"), record("a3", "u1", "Task three, not shared"), record("x1", "u2", "Someone else's task")],
  recruiter_shares: [] as Record<string, unknown>[],
});

beforeEach(() => {
  portfolio.mockReset();
  portfolio.mockResolvedValue({
    viewer: { fullName: "Asha Rao", collegeName: "DVR College" },
    education: [{ degree: "B.Tech", fieldOfStudy: "CSE", endYear: 2026, institutionName: "DVR College", branch: null }],
    statedRole: "Data Analyst",
    profile: { contact: { email: "asha@example.com", phone: "999" } },
    roleReadiness: null,
    proficiency: [],
    arenaWork: [{ verifiedCount: 3 }],
  });
});

describe("creating and listing shares", () => {
  it("creates a share for the student's own sealed records, with a long token and the chosen expiry", async () => {
    const db = fakeDb(world());
    const r = await createShare(db, "u1", { label: "Acme", attemptIds: ["a1", "a2"], days: 7, includeContact: false }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.share.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(r.share.expiresAt).toBe("2026-11-09T10:00:00.000Z");
      expect(r.share.state).toBe("active");
    }
  });

  it("refuses another student's record rather than leaving it out", async () => {
    const r = await createShare(fakeDb(world()), "u1", { label: "Acme", attemptIds: ["a1", "x1"], days: 30, includeContact: false }, NOW);
    expect(r).toMatchObject({ ok: false });
  });

  it("lists only the student's own shares, newest first, with the state worked out", async () => {
    const w = world();
    const db = fakeDb(w);
    await createShare(db, "u1", { label: "Acme", attemptIds: ["a1"], days: 7, includeContact: false }, NOW);
    w.recruiter_shares.push({ id: "other", user_id: "u2", token: "z".repeat(32), label: "Not mine", attempt_ids: ["x1"], include_contact: false, expires_at: "2027-01-01T00:00:00Z", revoked_at: null, view_count: 0, last_viewed_at: null, created_at: NOW.toISOString() });
    const mine = await listShares(db, "u1", NOW);
    expect(mine.map((s) => s.label)).toEqual(["Acme"]);
  });

  it("lets only the owner withdraw a share, and only once", async () => {
    const w = world();
    const db = fakeDb(w);
    const r = await createShare(db, "u1", { label: "Acme", attemptIds: ["a1"], days: 7, includeContact: false }, NOW);
    if (!r.ok) throw new Error("setup");
    expect(await revokeShare(db, "u2", r.share.id, NOW)).toBe(false);
    expect(await revokeShare(db, "u1", r.share.id, NOW)).toBe(true);
    expect(await revokeShare(db, "u1", r.share.id, NOW)).toBe(false);
  });
});

describe("what a link reveals", () => {
  async function shareWith(attemptIds: string[], over: { includeContact?: boolean; days?: number } = {}) {
    const w = world();
    const db = fakeDb(w);
    const r = await createShare(db, "u1", { label: "Acme", attemptIds, days: over.days ?? 30, includeContact: over.includeContact ?? false }, NOW);
    if (!r.ok) throw new Error("setup");
    return { db, w, share: r.share };
  }

  it("shows only the work the student put in the link, not their other sealed work or anyone else's", async () => {
    const { db, share } = await shareWith(["a1", "a2"]);
    const r = await loadRecruiterPack(db, share.token, { now: NOW });
    expect(r?.state).toBe("active");
    if (r?.state !== "active") return;
    expect(r.pack.samples.map((s) => s.title).sort()).toEqual(["Task one", "Task two"]);
    expect(r.pack.gradedTotal).toBe(3);
    expect(r.pack.candidate.name).toBe("Asha Rao");
  });

  it("never reads another student's record even if its id somehow sits in the share", async () => {
    const { db, w, share } = await shareWith(["a1"]);
    (w.recruiter_shares[0].attempt_ids as string[]).push("x1");
    const r = await loadRecruiterPack(db, share.token, { now: NOW });
    if (r?.state !== "active") throw new Error("expected active");
    expect(r.pack.samples.map((s) => s.title)).toEqual(["Task one"]);
  });

  it("shows contact details only when the student ticked them", async () => {
    const without = await shareWith(["a1"]);
    const a = await loadRecruiterPack(without.db, without.share.token, { now: NOW });
    expect(a?.state === "active" && a.pack.candidate.contact).toBeNull();
    const withContact = await shareWith(["a1"], { includeContact: true });
    const b = await loadRecruiterPack(withContact.db, withContact.share.token, { now: NOW });
    expect(b?.state === "active" && b.pack.candidate.contact).toEqual({ email: "asha@example.com", phone: "999" });
  });

  it("shows nothing about the candidate once the link has expired or been withdrawn", async () => {
    const { db, share } = await shareWith(["a1"], { days: 7 });
    portfolio.mockClear();
    expect(await loadRecruiterPack(db, share.token, { now: new Date("2026-12-01T00:00:00Z") })).toEqual({ state: "expired" });
    await revokeShare(db, "u1", share.id, NOW);
    expect(await loadRecruiterPack(db, share.token, { now: NOW })).toEqual({ state: "revoked" });
    expect(portfolio).not.toHaveBeenCalled();
  });

  it("counts each opening, and lets the student see it", async () => {
    const { db, share } = await shareWith(["a1"]);
    await loadRecruiterPack(db, share.token, { now: NOW });
    await loadRecruiterPack(db, share.token, { now: NOW });
    await loadRecruiterPack(db, share.token, { now: NOW, countView: false });
    const [mine] = await listShares(db, "u1", NOW);
    expect(mine.viewCount).toBe(2);
    expect(mine.lastViewedAt).toBe(NOW.toISOString());
  });

  it("treats a malformed or unknown token as nothing, without querying", async () => {
    const { db } = await shareWith(["a1"]);
    expect(await findShareByToken(db, "short")).toBeNull();
    expect(await findShareByToken(db, "../../etc/passwd")).toBeNull();
    expect(await findShareByToken(db, "q".repeat(32))).toBeNull();
  });
});

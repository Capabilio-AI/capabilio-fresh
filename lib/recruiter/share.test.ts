import { describe, expect, it } from "vitest";
import { expiryFrom, mayOpen, newShareToken, shareState, validateShareRequest } from "./share";

const NOW = new Date("2026-11-02T10:00:00Z");
const own = new Set(["a1", "a2", "a3"]);
const ok = { label: "Acme Analytics", attemptIds: ["a1", "a2"], days: 30, includeContact: false };

describe("recruiter share rules", () => {
  it("makes long, unique, URL-safe tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, newShareToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("is active until it expires, expired after, and revoked beats expired", () => {
    const base = { expiresAt: "2026-11-09T10:00:00Z", revokedAt: null };
    expect(shareState(base, NOW)).toBe("active");
    expect(shareState(base, new Date("2026-11-09T10:00:00Z"))).toBe("expired");
    expect(shareState({ ...base, revokedAt: "2026-11-03T00:00:00Z" }, NOW)).toBe("revoked");
    expect(shareState({ expiresAt: "2026-10-01T00:00:00Z", revokedAt: "2026-10-02T00:00:00Z" }, NOW)).toBe("revoked");
  });

  it("works out the expiry date", () => {
    expect(expiryFrom(7, NOW)).toBe("2026-11-09T10:00:00.000Z");
  });

  it("accepts a good request and tidies the name and the list", () => {
    const r = validateShareRequest({ ...ok, label: "  Acme   Analytics ", attemptIds: ["a1", "a1", "a2"] }, own);
    expect(r).toEqual({ ok: true, value: { label: "Acme Analytics", attemptIds: ["a1", "a2"], days: 30, includeContact: false } });
  });

  it("refuses a missing name, no work, too much work, a bad expiry", () => {
    expect(validateShareRequest({ ...ok, label: "   " }, own)).toMatchObject({ ok: false });
    expect(validateShareRequest({ ...ok, label: "x".repeat(81) }, own)).toMatchObject({ ok: false });
    expect(validateShareRequest({ ...ok, attemptIds: [] }, own)).toMatchObject({ ok: false });
    expect(validateShareRequest({ ...ok, attemptIds: Array.from({ length: 51 }, (_, i) => `id${i}`) }, new Set(Array.from({ length: 51 }, (_, i) => `id${i}`)))).toMatchObject({ ok: false });
    expect(validateShareRequest({ ...ok, days: 365 }, own)).toMatchObject({ ok: false });
  });

  it("refuses a record that is not the student's own sealed record instead of dropping it", () => {
    const r = validateShareRequest({ ...ok, attemptIds: ["a1", "someone-elses"] }, own);
    expect(r).toMatchObject({ ok: false });
  });

  it("opens only tasks that are in the share, and only while it is active", () => {
    const share = { attemptIds: ["a1", "a2"], expiresAt: "2026-11-09T10:00:00Z", revokedAt: null };
    expect(mayOpen(share, "a1", NOW)).toBe(true);
    expect(mayOpen(share, "a3", NOW)).toBe(false);
    expect(mayOpen({ ...share, revokedAt: "2026-11-03T00:00:00Z" }, "a1", NOW)).toBe(false);
    expect(mayOpen(share, "a1", new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });
});

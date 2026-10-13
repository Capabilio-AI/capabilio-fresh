import { describe, expect, it, vi } from "vitest";
import { getVerifiedUser, secondFactorPending } from "./aal";

type Factor = { status: string };
function client(opts: { user?: { id: string; factors?: Factor[] } | null; error?: boolean; level?: string | null }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: opts.user ?? null }, error: opts.error ? new Error("x") : null }),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: opts.level === undefined ? null : { currentLevel: opts.level } }) },
    },
  };
}
const verified = [{ status: "verified" }];

describe("getVerifiedUser", () => {
  it("returns the user when there is no second factor", async () => {
    expect(await getVerifiedUser(client({ user: { id: "u" }, level: "aal1" }))).toEqual({ id: "u" });
    const user = (await getVerifiedUser(client({ user: { id: "u", factors: [{ status: "unverified" }] }, level: "aal1" }))) as { id: string } | null;
    expect(user?.id).toBe("u");
  });

  it("refuses a password-only session when a factor is verified", async () => {
    expect(await getVerifiedUser(client({ user: { id: "u", factors: verified }, level: "aal1" }))).toBeNull();
  });

  it("accepts a session that completed the second factor", async () => {
    expect(await getVerifiedUser(client({ user: { id: "u", factors: verified }, level: "aal2" }))).toEqual({ id: "u", factors: verified });
  });

  it("fails closed when the level cannot be read, or the lookup errors", async () => {
    expect(await getVerifiedUser(client({ user: { id: "u", factors: verified }, level: null }))).toBeNull();
    expect(await getVerifiedUser(client({ user: { id: "u" }, error: true }))).toBeNull();
    expect(await getVerifiedUser(client({ user: null }))).toBeNull();
  });
});

describe("secondFactorPending", () => {
  it("skips the lookup unless the token is aal1", async () => {
    const c = client({ user: { id: "u", factors: verified } });
    expect(await secondFactorPending(c, "aal2")).toBe(false);
    expect(await secondFactorPending(c, undefined)).toBe(false);
    expect(c.auth.getUser).not.toHaveBeenCalled();
  });

  it("reads factors from the auth server, so a stripped cookie cannot hide them", async () => {
    expect(await secondFactorPending(client({ user: { id: "u", factors: verified } }), "aal1")).toBe(true);
    expect(await secondFactorPending(client({ user: { id: "u" } }), "aal1")).toBe(false);
  });

  it("fails closed when the lookup fails", async () => {
    expect(await secondFactorPending(client({ error: true }), "aal1")).toBe(true);
    expect(await secondFactorPending(client({ user: null }), "aal1")).toBe(true);
  });
});

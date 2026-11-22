import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pythonTrack } from "@/lib/languages/python";
import { checkCredential } from "./credential";
import { generateSigningKey, loadKeys } from "./sign";
import { getByCode, issueTrackCredential, listForUser, revokeCredential } from "./store";

const keys = loadKeys(generateSigningKey().envValue)!;
const modules = pythonTrack.modules.map((m) => ({ k: m.key, t: m.title, p: "2026-11-22T10:00:00.000Z", aa: 1, pa: 1, sc: 9, st: 10, pl: "python", tp: 8, tn: 8, ch: "a".repeat(64) }));

type Row = Record<string, unknown>;
/** An in-memory stand-in for the credentials table with the same unique rules, so races and collisions can be played out. */
function fakeDb(opts: { failInsertOnce?: { code: string }; raceRow?: Row } = {}) {
  const rows: Row[] = [];
  let failOnce = opts.failInsertOnce;
  let race = opts.raceRow;
  const filter = (conds: [string, unknown][], nullConds: string[]) => rows.filter((r) => conds.every(([k, v]) => r[k] === v) && nullConds.every((k) => r[k] == null));
  const table = {
    select: () => {
      const conds: [string, unknown][] = [];
      const q = { eq: (k: string, v: unknown) => { conds.push([k, v]); return q; }, order: () => Promise.resolve({ data: filter(conds, []), error: null }), maybeSingle: () => Promise.resolve({ data: filter(conds, [])[0] ?? null, error: null }) };
      return q;
    },
    insert: (row: Row) => ({
      select: () => ({
        single: () => {
          if (failOnce) { const f = failOnce; failOnce = undefined; return Promise.resolve({ data: null, error: { code: f.code, message: "duplicate key" } }); }
          if (race) { rows.push(race); race = undefined; return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } }); }
          if (rows.some((r) => r.code === row.code || (r.user_id === row.user_id && r.kind === row.kind && r.subject === row.subject))) return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } });
          const stored = { id: `id-${rows.length + 1}`, expires_at: null, revoked_at: null, revoked_reason: null, ...row };
          rows.push(stored);
          return Promise.resolve({ data: stored, error: null });
        },
      }),
    }),
    update: (patch: Row) => {
      const conds: [string, unknown][] = [];
      const nulls: string[] = [];
      const q = { eq: (k: string, v: unknown) => { conds.push([k, v]); return q; }, is: (k: string) => { nulls.push(k); return q; }, select: () => { const hit = filter(conds, nulls); hit.forEach((r) => Object.assign(r, patch)); return Promise.resolve({ data: hit.map((r) => ({ code: r.code })), error: null }); } };
      return q;
    },
  };
  return { service: { from: () => table } as unknown as SupabaseClient, rows };
}

describe("issueTrackCredential", () => {
  it("issues a credential that verifies against the public key", async () => {
    const { service } = fakeDb();
    const { credential, created } = await issueTrackCredential(service, { userId: "u1", track: pythonTrack, holder: "Ravi", modules, showCode: false, keys });
    expect(created).toBe(true);
    expect(credential.code).toMatch(/^CAP-/);
    expect(credential.key_id).toBe(keys.keyId);
    expect(checkCredential(credential, keys.publicKey).state).toBe("valid");
  });
  it("returns the same credential when asked again, instead of making a second", async () => {
    const { service, rows } = fakeDb();
    const first = await issueTrackCredential(service, { userId: "u1", track: pythonTrack, holder: null, modules, showCode: false, keys });
    const again = await issueTrackCredential(service, { userId: "u1", track: pythonTrack, holder: "Someone Else", modules, showCode: false, keys });
    expect(again.created).toBe(false);
    expect(again.credential.code).toBe(first.credential.code);
    expect(rows).toHaveLength(1);
  });
  it("does not quietly replace a revoked credential", async () => {
    const { service } = fakeDb();
    const first = await issueTrackCredential(service, { userId: "u1", track: pythonTrack, holder: null, modules, showCode: false, keys });
    await revokeCredential(service, first.credential.code, "admin1", "issued in error");
    const again = await issueTrackCredential(service, { userId: "u1", track: pythonTrack, holder: null, modules, showCode: false, keys });
    expect(again.created).toBe(false);
    expect(again.credential.revoked_at).not.toBeNull();
  });
  it("tries another code when one is taken, and returns the winner when two requests race", async () => {
    const collide = fakeDb({ failInsertOnce: { code: "23505" } });
    expect((await issueTrackCredential(collide.service, { userId: "u1", track: pythonTrack, holder: null, modules, showCode: false, keys })).created).toBe(true);
    const winner: Row = { id: "w", code: "CAP-WINN-ERRR-AAAA-BBBB", user_id: "u1", kind: "track", subject: "python", expires_at: null, revoked_at: null, revoked_reason: null };
    const raced = fakeDb({ raceRow: winner });
    const r = await issueTrackCredential(raced.service, { userId: "u1", track: pythonTrack, holder: null, modules, showCode: false, keys });
    expect(r.created).toBe(false);
    expect(r.credential.code).toBe("CAP-WINN-ERRR-AAAA-BBBB");
  });
  it("fails loudly on any other database error", async () => {
    const { service } = fakeDb({ failInsertOnce: { code: "XX000" } });
    await expect(issueTrackCredential(service, { userId: "u1", track: pythonTrack, holder: null, modules, showCode: false, keys })).rejects.toThrow("could not issue");
  });
});

describe("revokeCredential, getByCode and listForUser", () => {
  it("revokes once, says so when already revoked, and reports a code that does not exist", async () => {
    const { service } = fakeDb();
    const { credential } = await issueTrackCredential(service, { userId: "u1", track: pythonTrack, holder: null, modules, showCode: false, keys });
    expect(await revokeCredential(service, credential.code, "admin1", "issued in error")).toBe("revoked");
    expect(await revokeCredential(service, credential.code, "admin1", "again")).toBe("already");
    expect(await revokeCredential(service, "CAP-0000-0000-0000-0000", "admin1", "nope")).toBe("not_found");
    const after = await getByCode(service, credential.code);
    expect(after?.revoked_reason).toBe("issued in error");
    expect(checkCredential(after!, keys.publicKey).state).toBe("revoked");
  });
  it("lists only the student's own credentials", async () => {
    const { service } = fakeDb();
    await issueTrackCredential(service, { userId: "u1", track: pythonTrack, holder: null, modules, showCode: false, keys });
    await issueTrackCredential(service, { userId: "u2", track: pythonTrack, holder: null, modules, showCode: false, keys });
    expect((await listForUser(service, "u1")).map((c) => c.user_id)).toEqual(["u1"]);
  });
});

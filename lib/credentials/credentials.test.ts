import { describe, expect, it } from "vitest";
import { canonicalJson } from "./canonical";
import { generateSigningKey, keyIdOf, loadKeys, newCredentialCode, signText, verifyText } from "./sign";
import { buildPayload, checkCredential, signPayload, trackEvidence, type CredentialRow } from "./credential";
import { pythonTrack } from "@/lib/languages/python";
import type { ModuleProofRow } from "@/lib/languages/module-gate";

const key = loadKeys(generateSigningKey().envValue)!;
const other = loadKeys(generateSigningKey().envValue)!;
const T = "2026-11-22T10:00:00.000Z";

const HASH = "b".repeat(64);
const proofsFor = (keys: string[], at = T): Record<string, ModuleProofRow> =>
  Object.fromEntries(keys.map((k) => [k, {
    assessmentAttempts: 2, assessmentPassedAt: at, problemAttempts: 3, problemPassedAt: at, provenAt: at,
    assessmentCorrect: 9, assessmentTotal: 10, problemLanguage: "python", problemTestsPassed: 8, problemTestsTotal: 8, problemCodeSha256: HASH,
  }]));

describe("canonicalJson", () => {
  it("gives the same text whatever the order of the keys, and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { y: 1, x: 2 }] }, u: undefined })).toBe('{"a":{"c":[3,{"x":2,"y":1}],"d":2},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });
});

describe("keys and signatures", () => {
  it("loads a key from base64 or from a PEM, and refuses anything else", () => {
    const g = generateSigningKey();
    expect(loadKeys(g.envValue)?.keyId).toBe(g.keyId);
    expect(loadKeys(Buffer.from(g.envValue, "base64").toString())?.keyId).toBe(g.keyId);
    expect(loadKeys(undefined)).toBeNull();
    expect(loadKeys("not a key")).toBeNull();
    expect(loadKeys("-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----")).toBeNull();
  });
  it("verifies what it signed, and nothing else", () => {
    const sig = signText(key, "hello");
    expect(verifyText(key.publicKey, "hello", sig)).toBe(true);
    expect(verifyText(key.publicKey, "hellp", sig)).toBe(false);
    expect(verifyText(other.publicKey, "hello", sig)).toBe(false);
    expect(verifyText(key.publicKey, "hello", "not-a-signature")).toBe(false);
    expect(verifyText(key.publicKey, "hello", "")).toBe(false);
  });
  it("names a key by a short id of its public half", () => {
    expect(key.keyId).toBe(keyIdOf(key.publicKey));
    expect(key.keyId).not.toBe(other.keyId);
    expect(key.keyId).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("newCredentialCode", () => {
  it("is CAP- and four groups of four characters from an alphabet with no look-alikes, and does not repeat", () => {
    const codes = new Set(Array.from({ length: 500 }, newCredentialCode));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(/^CAP-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  });
});

describe("trackEvidence", () => {
  const all = pythonTrack.modules.map((m) => m.key);
  it("gives the evidence only when every module is proven", () => {
    const ev = trackEvidence(pythonTrack, proofsFor(all));
    expect(ev.ok).toBe(true);
    if (ev.ok) {
      expect(ev.modules).toHaveLength(pythonTrack.modules.length);
      expect(ev.modules[0]).toMatchObject({ k: all[0], p: T, aa: 2, pa: 3 });
    }
  });
  it("carries how each module was proven: the assessment score, the language, the tests met and the fingerprint of the passing code", () => {
    const ev = trackEvidence(pythonTrack, proofsFor(all));
    expect(ev.ok && ev.modules[0]).toMatchObject({ sc: 9, st: 10, pl: "python", tp: 8, tn: 8, ch: HASH });
  });
  it("says null, not a made-up number, for evidence that was not recorded", () => {
    const bare = Object.fromEntries(all.map((k) => [k, { assessmentAttempts: 1, assessmentPassedAt: T, problemAttempts: 1, problemPassedAt: T, provenAt: T }]));
    const ev = trackEvidence(pythonTrack, bare);
    expect(ev.ok && ev.modules[0]).toMatchObject({ sc: null, st: null, pl: null, tp: null, tn: null, ch: null });
  });
  it("names the modules still to prove, and a module with only half the proof does not count", () => {
    const half = { ...proofsFor(all.slice(1)), [all[0]]: { assessmentAttempts: 1, assessmentPassedAt: T, problemAttempts: 1, problemPassedAt: null, provenAt: null } };
    const ev = trackEvidence(pythonTrack, half);
    expect(ev.ok).toBe(false);
    if (!ev.ok) expect(ev.remaining).toEqual([pythonTrack.modules[0].title]);
    expect(trackEvidence(pythonTrack, {}).ok).toBe(false);
  });
});

describe("checkCredential", () => {
  const evidence = trackEvidence(pythonTrack, proofsFor(pythonTrack.modules.map((m) => m.key)));
  if (!evidence.ok) throw new Error("fixture");
  const code = "CAP-ABCD-EFGH-JKMN-PQRS";
  const payload = buildPayload({ code, track: pythonTrack, holder: "Ravi Kumar", issuedAt: T, modules: evidence.modules });
  const signed = signPayload(key, payload);
  const row = (over: Partial<CredentialRow> = {}): CredentialRow => ({ code, subject: "python", subject_title: pythonTrack.title, level: "Proven", payload: signed.payload, signature: signed.signature, issued_at: T, expires_at: null, revoked_at: null, revoked_reason: null, ...over });

  it("is valid when the signature matches and nothing has been revoked", () => {
    const r = checkCredential(row(), key.publicKey);
    expect(r.state).toBe("valid");
    expect(r.payload?.holder).toBe("Ravi Kumar");
    expect(r.payload?.modules).toHaveLength(pythonTrack.modules.length);
  });
  it("is tampered when the signed text is changed, even by one character, or when the signature is from another key", () => {
    expect(checkCredential(row({ payload: signed.payload.replace("Ravi Kumar", "Ravi Kumaar") }), key.publicKey).state).toBe("tampered");
    expect(checkCredential(row({ signature: signText(other, signed.payload) }), key.publicKey).state).toBe("tampered");
    expect(checkCredential(row({ signature: "" }), key.publicKey).state).toBe("tampered");
  });
  it("is tampered when the row claims to be a different credential than the one that was signed", () => {
    expect(checkCredential(row({ code: "CAP-ZZZZ-ZZZZ-ZZZZ-ZZZZ" }), key.publicKey).state).toBe("tampered");
    expect(checkCredential(row({ subject: "java" }), key.publicKey).state).toBe("tampered");
    expect(checkCredential(row({ subject_title: "Java Programming" }), key.publicKey).state).toBe("tampered");
    expect(checkCredential(row({ level: "Expert" }), key.publicKey).state).toBe("tampered");
  });
  it("is tampered when any evidence number or the code fingerprint is changed after signing", () => {
    expect(checkCredential(row({ payload: signed.payload.replace('"sc":9', '"sc":10') }), key.publicKey).state).toBe("tampered");
    expect(checkCredential(row({ payload: signed.payload.replace(HASH, "c".repeat(64)) }), key.publicKey).state).toBe("tampered");
  });
  it("signs the evidence, so the public page can show exactly what was signed", () => {
    const r = checkCredential(row(), key.publicKey);
    expect(r.payload?.v).toBe(2);
    expect(r.payload?.modules[0]).toMatchObject({ sc: 9, st: 10, pl: "python", tp: 8, tn: 8, ch: HASH });
  });
  it("is tampered when the text is valid JSON that was never the canonical signed form", () => {
    const loose = JSON.stringify(JSON.parse(signed.payload), null, 2);
    expect(checkCredential(row({ payload: loose, signature: signText(key, loose) }), key.publicKey).state).toBe("tampered");
  });
  it("is revoked once revoked, and expired once its date has passed, but only for a signature that checks", () => {
    expect(checkCredential(row({ revoked_at: T, revoked_reason: "issued in error" }), key.publicKey).state).toBe("revoked");
    expect(checkCredential(row({ expires_at: "2026-12-01T00:00:00Z" }), key.publicKey, new Date("2026-11-30T00:00:00Z")).state).toBe("valid");
    expect(checkCredential(row({ expires_at: "2026-12-01T00:00:00Z" }), key.publicKey, new Date("2026-12-01T00:00:00Z")).state).toBe("expired");
    expect(checkCredential(row({ revoked_at: T, revoked_reason: "x", payload: "{}" }), key.publicKey).state).toBe("tampered");
  });
  it("is never reported valid when there is no key to check it with", () => {
    expect(checkCredential(row(), null)).toEqual({ state: "unverifiable", payload: null });
  });
});

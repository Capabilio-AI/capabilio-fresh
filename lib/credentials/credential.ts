import { canonicalJson } from "./canonical";
import { signText, verifyText, type CredentialKeys } from "./sign";
import { isProven, type ModuleProofRow } from "@/lib/languages/module-gate";
import type { Track } from "@/lib/languages/types";
import type { KeyObject } from "node:crypto";

/** What is signed. Everything the public page shows about the achievement is in here; nothing else is shown. */
export interface CredentialPayload {
  v: 2;
  code: string;
  kind: "track";
  subject: string;
  title: string;
  level: string;
  /** the student's name when they chose to show it, else null */
  holder: string | null;
  issuedAt: string;
  totalModules: number;
  /** one entry per module: the evidence of how it was proven */
  modules: ModuleEvidenceEntry[];
}

/**
 * Evidence for one module. k key, t title, p when it was proven, aa and pa how many tries the assessment and the problem took; sc of st the assessment score of the
 * passing attempt; pl the language of the problem, tp of tn the hidden-and-visible tests the passing submission met; ch the SHA-256 of the passing code, so
 * code shown on the public page can be proven to be the code that passed. Any of sc, st, pl, tp, tn, ch is null when it was not recorded.
 */
export interface ModuleEvidenceEntry { k: string; t: string; p: string; aa: number; pa: number; sc: number | null; st: number | null; pl: string | null; tp: number | null; tn: number | null; ch: string | null }

export const LEVEL = "Proven";

/** Pure. The evidence for a track credential, or the modules still to prove. A track credential needs every module proven; nothing is rounded up. */
export function trackEvidence(track: Track, proofs: Readonly<Record<string, ModuleProofRow>>): { ok: true; modules: ModuleEvidenceEntry[] } | { ok: false; remaining: string[] } {
  const modules: ModuleEvidenceEntry[] = [];
  const remaining: string[] = [];
  for (const m of track.modules) {
    const row = proofs[m.key];
    if (row && isProven(track, m, row) && row.provenAt) {
      modules.push({
        k: m.key, t: m.title, p: row.provenAt, aa: row.assessmentAttempts, pa: row.problemAttempts,
        sc: row.assessmentCorrect ?? null, st: row.assessmentTotal ?? null, pl: row.problemLanguage ?? null, tp: row.problemTestsPassed ?? null, tn: row.problemTestsTotal ?? null, ch: row.problemCodeSha256 ?? null,
      });
    }
    else remaining.push(m.title);
  }
  return remaining.length === 0 ? { ok: true, modules } : { ok: false, remaining };
}

export function buildPayload(i: { code: string; track: Track; holder: string | null; issuedAt: string; modules: ModuleEvidenceEntry[] }): CredentialPayload {
  return { v: 2, code: i.code, kind: "track", subject: i.track.key, title: i.track.title, level: LEVEL, holder: i.holder, issuedAt: i.issuedAt, totalModules: i.track.modules.length, modules: i.modules };
}

/** The stored form: the canonical text that was signed, and its signature. */
export const signPayload = (keys: CredentialKeys, payload: CredentialPayload): { payload: string; signature: string } => {
  const text = canonicalJson(payload);
  return { payload: text, signature: signText(keys, text) };
};

export interface CredentialRow {
  code: string;
  subject: string;
  subject_title: string;
  level: string;
  payload: string;
  signature: string;
  issued_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export type CredentialState = "valid" | "revoked" | "expired" | "tampered" | "unverifiable";

/**
 * Pure. Whether a stored credential can be trusted right now. `tampered` means the signature does not match the signed text, or the row says something
 * different from the signed text; `unverifiable` means no public key is available to check it with (never reported as valid). Revoked and expired are read
 * from the row because they change after signing.
 */
export function checkCredential(row: CredentialRow, publicKey: KeyObject | null, now: Date = new Date()): { state: CredentialState; payload: CredentialPayload | null } {
  if (!publicKey) return { state: "unverifiable", payload: null };
  if (!verifyText(publicKey, row.payload, row.signature)) return { state: "tampered", payload: null };
  let payload: CredentialPayload;
  try { payload = JSON.parse(row.payload) as CredentialPayload; } catch { return { state: "tampered", payload: null }; }
  // the signed text must be the same credential the row claims to be, and its text must be exactly the canonical form that was signed
  if (payload.v !== 2 || payload.code !== row.code || payload.subject !== row.subject || payload.title !== row.subject_title || payload.level !== row.level || canonicalJson(payload) !== row.payload) {
    return { state: "tampered", payload: null };
  }
  if (row.revoked_at) return { state: "revoked", payload };
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return { state: "expired", payload };
  return { state: "valid", payload };
}

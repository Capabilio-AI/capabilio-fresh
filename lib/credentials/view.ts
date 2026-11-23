import { createServiceClient } from "@/lib/supabase/service";
import { checkCredential, type CredentialPayload, type CredentialState } from "./credential";
import { loadKeys } from "./sign";
import { getByCode } from "./store";
import { loadPassingCode, sha256 } from "@/lib/languages/module-proof";

export const CODE_PATTERN = /^CAP-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

export type CredentialView =
  | { found: false; code: string }
  | { found: true; code: string; state: CredentialState; payload: CredentialPayload | null; keyId: string; revokedAt: string | null; showCode: boolean; solutions: Record<string, string> };

/**
 * Everything a public credential page may show, for one code: the checked state, the signed record, and the learner's solutions when (and only when) they chose
 * to show them and each still matches the fingerprint that was signed. It reads this credential and its own modules and nothing else: no other course, no
 * badges, no passport, no personal details. Both public pages use it, so what they show can never differ.
 */
export async function loadCredentialView(rawCode: string, withSolutions: boolean): Promise<CredentialView> {
  const code = rawCode.toUpperCase();
  if (!CODE_PATTERN.test(code)) return { found: false, code };
  const service = createServiceClient();
  const row = await getByCode(service, code);
  if (!row) return { found: false, code };
  const keys = loadKeys(process.env.CREDENTIAL_SIGNING_KEY);
  const { state, payload } = checkCredential(row, keys?.publicKey ?? null);
  let solutions: Record<string, string> = {};
  if (withSolutions && payload && row.show_code && (state === "valid" || state === "revoked" || state === "expired")) {
    try {
      const stored = await loadPassingCode(service, row.user_id, row.subject);
      solutions = Object.fromEntries(payload.modules.flatMap((m) => (m.ch && stored[m.k] && sha256(stored[m.k].code) === m.ch ? [[m.k, stored[m.k].code]] : [])));
    } catch (e) { console.error("[verify] could not read solutions:", e instanceof Error ? e.message : e); }
  }
  return { found: true, code, state, payload, keyId: row.key_id, revokedAt: row.revoked_at, showCode: row.show_code, solutions };
}

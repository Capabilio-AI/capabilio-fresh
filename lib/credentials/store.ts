import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { buildPayload, signPayload, LEVEL, type CredentialRow, type ModuleEvidenceEntry } from "./credential";
import { newCredentialCode, type CredentialKeys } from "./sign";
import type { Track } from "@/lib/languages/types";

type Service = SupabaseClient;
export type StoredCredential = CredentialRow & { id: string; user_id: string; key_id: string; show_code: boolean };
const COLUMNS = "id, code, user_id, subject, subject_title, level, payload, signature, key_id, issued_at, expires_at, revoked_at, revoked_reason, show_code";

/** One credential by its public code, or null. A read that fails throws: it must never look like "no such credential". */
export async function getByCode(service: Service, code: string): Promise<StoredCredential | null> {
  const { data, error } = await untyped(service).from("skill_credentials").select(COLUMNS).eq("code", code).maybeSingle();
  if (error) throw new Error(`could not read the credential: ${error.message}`);
  return (data as StoredCredential | null) ?? null;
}

export async function listForUser(service: Service, userId: string): Promise<StoredCredential[]> {
  const { data, error } = await untyped(service).from("skill_credentials").select(COLUMNS).eq("user_id", userId).order("issued_at", { ascending: false });
  if (error) throw new Error(`could not read credentials: ${error.message}`);
  return (data ?? []) as StoredCredential[];
}

/**
 * Issues the student's credential for a track, signed with the platform key. Asking again returns the credential that already exists (so a double click
 * or a retry cannot make two), and a revoked one is returned as it is rather than quietly replaced.
 */
export async function issueTrackCredential(service: Service, i: { userId: string; track: Track; holder: string | null; modules: ModuleEvidenceEntry[]; showCode: boolean; keys: CredentialKeys }): Promise<{ credential: StoredCredential; created: boolean }> {
  const db = untyped(service);
  const existing = await db.from("skill_credentials").select(COLUMNS).eq("user_id", i.userId).eq("kind", "track").eq("subject", i.track.key).maybeSingle();
  if (existing.error) throw new Error(`could not read credentials: ${existing.error.message}`);
  if (existing.data) return { credential: existing.data as StoredCredential, created: false };
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCredentialCode();
    const issuedAt = new Date().toISOString();
    const { payload, signature } = signPayload(i.keys, buildPayload({ code, track: i.track, holder: i.holder, issuedAt, modules: i.modules }));
    const { data, error } = await db.from("skill_credentials").insert({
      code, user_id: i.userId, kind: "track", subject: i.track.key, subject_title: i.track.title, level: LEVEL, payload, signature, key_id: i.keys.keyId, issued_at: issuedAt, show_code: i.showCode,
    }).select(COLUMNS).single();
    if (!error) return { credential: data as StoredCredential, created: true };
    if (error.code !== "23505") throw new Error(`could not issue the credential: ${error.message}`);
    // a unique violation is either a code that already exists (try another) or the same student asking at the same moment (return what won)
    const again = await db.from("skill_credentials").select(COLUMNS).eq("user_id", i.userId).eq("kind", "track").eq("subject", i.track.key).maybeSingle();
    if (again.data) return { credential: again.data as StoredCredential, created: false };
  }
  throw new Error("could not make a unique credential code");
}

/** Revokes a credential. The signature stays valid (what was signed is still what was signed); the public page shows it as revoked from this row. */
export async function revokeCredential(service: Service, code: string, adminId: string, reason: string): Promise<"revoked" | "not_found" | "already"> {
  const db = untyped(service);
  const row = await getByCode(service, code);
  if (!row) return "not_found";
  if (row.revoked_at) return "already";
  const { data, error } = await db.from("skill_credentials").update({ revoked_at: new Date().toISOString(), revoked_reason: reason, revoked_by: adminId }).eq("code", code).is("revoked_at", null).select("code");
  if (error) throw new Error(`could not revoke: ${error.message}`);
  return data && data.length > 0 ? "revoked" : "already";
}

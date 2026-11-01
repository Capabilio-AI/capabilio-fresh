import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { passportUrl } from "@/lib/passport/url";
import { loadElos } from "./roster";

export interface RegistrantProof {
  targetRole: string | null;
  /** the student's one ELO on their target role; null until rated (never a made-up 400) */
  elo: number | null;
  tier: string | null;
  /** only when the student has chosen to share their Skill Passport; otherwise null, whatever the college asks */
  passportUrl: string | null;
}

/**
 * What a company needs beside a name: the role the student is working toward, their rating there, and their verified Skill Passport. The
 * passport link is included only for students who made it public: sharing it is the student's choice, not the college's.
 */
export async function loadRegistrantProof(service: SupabaseClient<Database>, userIds: string[]): Promise<Map<string, RegistrantProof>> {
  const out = new Map<string, RegistrantProof>();
  if (userIds.length === 0) return out;
  const [elos, { data: profiles }] = await Promise.all([
    loadElos(service, userIds),
    service.from("profiles").select("id, passport_code, passport_public").in("id", userIds),
  ]);
  const shared = new Map((profiles ?? []).filter((p) => p.passport_public && p.passport_code).map((p) => [p.id, p.passport_code as string]));
  for (const id of userIds) {
    const elo = elos.get(id);
    const code = shared.get(id);
    out.set(id, { targetRole: elo?.career ?? null, elo: elo?.rating ?? null, tier: elo?.tier ?? null, passportUrl: code ? await passportUrl(code) : null });
  }
  return out;
}

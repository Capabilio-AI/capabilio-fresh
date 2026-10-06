import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { z } from "zod";

type Service = SupabaseClient<Database>;

/** The student's regulation as printed on their syllabus (e.g. "R23", "R20"). Free text; matching is case-insensitive. Empty clears it. */
export const RegulationBodySchema = z.object({ regulation: z.string().trim().max(40).nullable() }).strict();

/** Sets the regulation on the CALLER's own active student membership(s) — never anyone else's. */
export async function setOwnRegulation(service: Service, userId: string, regulation: string | null): Promise<{ ok: true; updated: number } | { ok: false; message: string }> {
  const value = regulation && regulation.trim() ? regulation.trim() : null;
  const { data, error } = await service.from("institution_memberships").update({ regulation: value }).eq("user_id", userId).eq("role", "student").eq("status", "active").select("id");
  if (error) return { ok: false, message: "Couldn't save your regulation." };
  return data && data.length > 0 ? { ok: true, updated: data.length } : { ok: false, message: "You're not an active student at a college yet." };
}

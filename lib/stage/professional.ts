import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import { getCareerProfile } from "@/lib/assess/career-profile";
import type { Db as AssessDb } from "@/lib/assess/db";
import { buildOverview, type Overview } from "@/lib/dashboard/overview";

export interface ProfessionalHomeData {
  firstName: string | null;
  overview: Overview | null;
  proofCount: number;
}

/** What a working professional's home needs: their evidence count and, if they have one, their verified level. */
export async function loadProfessionalHome(userId: string, fullName: string | null): Promise<ProfessionalHomeData> {
  const service = createServiceClient();
  const [profile, vault] = await Promise.all([
    getCareerProfile(service as unknown as AssessDb, userId),
    untyped(service).from("vault_items").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  return { firstName: fullName?.trim().split(/\s+/)[0] ?? null, overview: buildOverview(profile), proofCount: vault.count ?? 0 };
}

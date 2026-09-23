import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { GuidePathPhase } from "@/lib/guide-path/generate";

export interface GuidePathRecord {
  targetCareer: string;
  isPrimary: boolean;
  phases: GuidePathPhase[];
  version: number;
  generatedAt: string;
}

export async function getGuidePaths(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ primary: GuidePathRecord | null; planB: GuidePathRecord | null }> {
  const { data, error } = await supabase
    .from("guide_paths")
    .select("target_career, is_primary, phases, version, generated_at")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false });
  if (error) throw error;

  function toRecord(row: NonNullable<typeof data>[number]): GuidePathRecord {
    return {
      targetCareer: row.target_career,
      isPrimary: row.is_primary,
      phases: row.phases as unknown as GuidePathPhase[],
      version: row.version,
      generatedAt: row.generated_at,
    };
  }

  const primaryRow = data?.find((p) => p.is_primary) ?? null;
  const planBRow = data?.find((p) => !p.is_primary) ?? null;
  return {
    primary: primaryRow ? toRecord(primaryRow) : null,
    planB: planBRow ? toRecord(planBRow) : null,
  };
}

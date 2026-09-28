import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentBranchContext } from "@/lib/assessment/attempts";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { clusterKeyForBranch, promptLabelForBranch } from "./branch-clusters";

export type ChallengeTrack = "stream" | "domain";

export function isChallengeTrack(value: string): value is ChallengeTrack {
  return value === "stream" || value === "domain";
}

/** Resolves a track to its storage scope_key and the human-readable label the generator should write about. Null when the student hasn't set a branch/career yet. */
export async function resolveTrackScope(
  supabase: SupabaseClient<Database>,
  userId: string,
  track: ChallengeTrack
): Promise<{ scopeKey: string; promptLabel: string } | null> {
  if (track === "stream") {
    const { branch } = await getStudentBranchContext(supabase, userId);
    if (!branch) return null;
    return { scopeKey: clusterKeyForBranch(branch), promptLabel: promptLabelForBranch(branch) };
  }

  const careerInterest = await getStatedCareerInterest(supabase, userId);
  if (!careerInterest) return null;
  return { scopeKey: careerInterest, promptLabel: careerInterest };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentBranchContext } from "@/lib/assessment/attempts";
import { clusterKeyForBranch, promptLabelForBranch } from "./branch-clusters";

export interface StreamScope {
  scopeKey: string;
  promptLabel: string;
  /** the student's own branch as recorded */
  branch: string;
  /** same normalisation as curriculum_versions.branch_key */
  branchKey: string;
}

/**
 * Stream-only -- Domain (career-based) challenges were removed. Stream
 * challenges are specifically curriculum/branch-focused missions; the
 * user asked to drop the career track since it's a different concept
 * that doesn't belong mixed into this feature. Resolves the student's
 * branch to its storage scope_key and the human-readable label the
 * generator should write about. Null when the student hasn't set a
 * branch yet.
 */
export async function resolveStreamScope(supabase: SupabaseClient<Database>, userId: string): Promise<StreamScope | null> {
  const { branch } = await getStudentBranchContext(supabase, userId);
  if (!branch) return null;
  return { scopeKey: clusterKeyForBranch(branch), promptLabel: promptLabelForBranch(branch), branch, branchKey: branch.trim().toLowerCase() };
}

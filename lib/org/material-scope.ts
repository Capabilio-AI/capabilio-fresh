import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { resolveMaterialBranch, staffBranchScope } from "./branch-scope";

export type MaterialScope = { ok: true; branch: string; year: number } | { ok: false; status: number; message: string };

/** Which branch and year a material goes to: a subject's own, else the explicit pair. Scoped faculty only ever publish to their own branch. */
export async function resolveMaterialScope(
  service: SupabaseClient<Database>,
  ctx: Pick<OrgContext, "institutionId" | "kind" | "branch">,
  input: { subjectId?: string; branch?: string; year?: number }
): Promise<MaterialScope> {
  let { branch, year } = input;
  if (input.subjectId) {
    const { data: subject } = await service.from("curriculum_subjects").select("branch, year").eq("id", input.subjectId).eq("institution_id", ctx.institutionId).maybeSingle();
    if (!subject) return { ok: false, status: 404, message: "Subject not found." };
    branch = subject.branch;
    year = subject.year;
  }
  const resolved = resolveMaterialBranch(staffBranchScope(ctx), branch);
  if (!resolved.ok) return { ok: false, status: 403, message: resolved.message };
  if (!resolved.value || year === undefined) return { ok: false, status: 400, message: "Pick a subject, or enter a branch and year." };
  return { ok: true, branch: resolved.value, year };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { onlyCurrentStudents } from "./current-students";
import { branchKey, sameBranch } from "./branch-scope";
import { untyped } from "./db";

export interface CollegeBranch { branch: string; students: number }

const PAGE = 1000;
const MAX = 20_000;

/**
 * Pure. The college's branches as its students actually wrote them, with how many students each has, plus branches known only from the
 * curriculum (zero students). Spelling is kept exactly as stored, because that is what a student's branch is matched against.
 */
export function mergeBranches(studentBranches: (string | null)[], subjectBranches: string[]): CollegeBranch[] {
  const counts = new Map<string, { branch: string; students: number }>();
  const add = (raw: string | null, n: number) => {
    const branch = raw?.trim();
    if (!branch) return;
    const k = branchKey(branch);
    const hit = counts.get(k);
    if (hit) hit.students += n;
    else counts.set(k, { branch, students: n });
  };
  studentBranches.forEach((b) => add(b, 1));
  subjectBranches.forEach((b) => add(b, 0));
  return [...counts.values()].sort((a, b) => b.students - a.students || a.branch.localeCompare(b.branch));
}

/** The branches a college can share with. Staff confined to one branch see only theirs. */
export async function listCollegeBranches(service: SupabaseClient<Database>, institutionId: string, scope: string | null): Promise<CollegeBranch[]> {
  const db = untyped(service);
  const students: (string | null)[] = [];
  for (let from = 0; from < MAX; from += PAGE) {
    const { data } = await onlyCurrentStudents(db.from("institution_memberships").select("branch").eq("institution_id", institutionId).eq("role", "student").eq("status", "active"))
      .order("user_id")
      .range(from, from + PAGE - 1);
    students.push(...((data ?? []) as { branch: string | null }[]).map((r) => r.branch));
    if (!data || data.length < PAGE) break;
  }
  const { data: subjects } = await db.from("curriculum_subjects").select("branch").eq("institution_id", institutionId);
  const all = mergeBranches(students, ((subjects ?? []) as { branch: string }[]).map((s) => s.branch));
  return scope ? all.filter((b) => sameBranch(b.branch, scope)) : all;
}

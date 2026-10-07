import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { branchKey } from "@/lib/org/branch-scope";
import type { ImportListItem } from "./admin-data";

type Service = SupabaseClient<Database>;
const MAX_STUDENTS = 20000;
const regKey = (r: string | null | undefined) => (r ?? "").trim().toLowerCase();

export interface StudentRow {
  branch: string | null;
  regulation: string | null;
  endYear: number | null;
}

/** Every active student of the institution, reduced to the three fields that decide which curriculum they get. */
export async function loadStudentRows(service: Service, institutionId: string): Promise<StudentRow[]> {
  const { data } = await untyped(service)
    .from("institution_memberships")
    .select("branch, regulation, end_year")
    .eq("institution_id", institutionId)
    .eq("role", "student")
    .eq("status", "active")
    .limit(MAX_STUDENTS);
  return ((data ?? []) as { branch: string | null; regulation: string | null; end_year: number | null }[]).map((r) => ({ branch: r.branch, regulation: r.regulation, endYear: r.end_year }));
}

/** How one branch's students line up against its curricula. */
export interface BranchBoard {
  key: string;
  branch: string;
  /** curricula for this branch, one per regulation (+ versions), newest first */
  imports: ImportListItem[];
  students: number;
  /** students whose regulation is set, by regulation, with whether a curriculum for it is published */
  byRegulation: { regulation: string; students: number; published: boolean; hasDraft: boolean }[];
  /** no regulation set: they get the most recently published curriculum */
  regulationUnset: number;
  /** regulation set but no published curriculum for it: their roadmap has no college syllabus until one is published */
  withoutPublished: number;
  /** distinct graduating years among the branch's students, for assigning a regulation to a batch */
  endYears: number[];
  publishedRegulations: string[];
  /** every regulation that has a curriculum, published or not — the only values the assign tool accepts */
  knownRegulations: string[];
}

/**
 * One board per branch that has either a curriculum or students. Branch identity is the same lower(trim) the roadmap uses, so a
 * student on "CSE" and a curriculum for "Computer Science and Engineering (CSE)" are different branches — shown separately, which is
 * how a college spots the mismatch instead of students silently getting nothing.
 */
export function buildBoards(imports: readonly ImportListItem[], students: readonly StudentRow[]): BranchBoard[] {
  const keys = new Map<string, string>();
  for (const i of imports) if (branchKey(i.branch)) keys.set(branchKey(i.branch), keys.get(branchKey(i.branch)) ?? i.branch.trim());
  for (const s of students) if (branchKey(s.branch)) keys.set(branchKey(s.branch), keys.get(branchKey(s.branch)) ?? (s.branch as string).trim());

  const boards = [...keys.entries()].map(([key, branch]): BranchBoard => {
    const mine = imports.filter((i) => branchKey(i.branch) === key);
    const cohort = students.filter((s) => branchKey(s.branch) === key);
    const publishedRegs = new Set(mine.filter((i) => i.status === "PUBLISHED").map((i) => regKey(i.regulation)));
    const draftRegs = new Set(mine.filter((i) => i.status !== "ARCHIVED").map((i) => regKey(i.regulation)));
    const counts = new Map<string, { regulation: string; students: number }>();
    for (const s of cohort) {
      if (!regKey(s.regulation)) continue;
      const k = regKey(s.regulation);
      const prev = counts.get(k);
      counts.set(k, { regulation: prev?.regulation ?? (s.regulation as string).trim(), students: (prev?.students ?? 0) + 1 });
    }
    const byRegulation = [...counts.entries()]
      .map(([k, v]) => ({ ...v, published: publishedRegs.has(k), hasDraft: draftRegs.has(k) }))
      .sort((a, b) => b.students - a.students);
    const regulations = (pick: (i: ImportListItem) => boolean) => [...new Set(mine.filter(pick).map((i) => i.regulation?.trim()).filter((r): r is string => Boolean(r)))];
    return {
      key,
      branch,
      imports: mine,
      students: cohort.length,
      byRegulation,
      regulationUnset: cohort.filter((s) => !regKey(s.regulation)).length,
      withoutPublished: byRegulation.filter((r) => !r.published).reduce((n, r) => n + r.students, 0),
      endYears: [...new Set(cohort.map((s) => s.endYear).filter((y): y is number => y != null))].sort((a, b) => a - b),
      publishedRegulations: regulations((i) => i.status === "PUBLISHED"),
      knownRegulations: regulations((i) => i.status !== "ARCHIVED"),
    };
  });
  // branches with students first (that is where something may be broken), then alphabetical
  return boards.sort((a, b) => Number(b.students > 0) - Number(a.students > 0) || a.branch.localeCompare(b.branch));
}

export type AssignResult = { ok: true; updated: number } | { ok: false; status: number; message: string };

/**
 * Sets the regulation on a branch's students — everyone in the branch, or one graduating batch. Only a regulation the college has a
 * curriculum for is accepted (a typo would orphan the students). Students who already chose a regulation keep it unless `overwrite`.
 */
export async function assignRegulation(
  service: Service,
  institutionId: string,
  input: { branch: string; regulation: string; endYear?: number | null; overwrite?: boolean }
): Promise<AssignResult> {
  const db = untyped(service);
  const { data: known } = await service.from("curriculum_imports").select("regulation, branch").eq("institution_id", institutionId).is("deleted_at", null).neq("status", "ARCHIVED");
  const match = (known ?? []).find((i) => branchKey(i.branch) === branchKey(input.branch) && regKey(i.regulation) === regKey(input.regulation));
  if (!match) return { ok: false, status: 400, message: `There is no ${input.regulation} curriculum for ${input.branch} yet. Create it first.` };

  const { data: rows, error } = await db
    .from("institution_memberships")
    .select("id, branch, regulation, end_year")
    .eq("institution_id", institutionId)
    .eq("role", "student")
    .eq("status", "active")
    .limit(MAX_STUDENTS);
  if (error) return { ok: false, status: 500, message: "Couldn't load the students. Please try again." };
  const ids = ((rows ?? []) as { id: string; branch: string | null; regulation: string | null; end_year: number | null }[])
    .filter((r) => branchKey(r.branch) === branchKey(input.branch))
    .filter((r) => input.endYear == null || r.end_year === input.endYear)
    .filter((r) => input.overwrite || !regKey(r.regulation))
    .map((r) => r.id);
  if (ids.length === 0) return { ok: true, updated: 0 };
  const { error: updateError } = await db.from("institution_memberships").update({ regulation: match.regulation?.trim() }).in("id", ids);
  if (updateError) return { ok: false, status: 500, message: "Couldn't save the regulation. Please try again." };
  return { ok: true, updated: ids.length };
}

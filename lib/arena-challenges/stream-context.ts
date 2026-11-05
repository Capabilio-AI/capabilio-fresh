import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { getStudentDirection, needsYearConfirmation } from "@/lib/career/direction";
import { loadPublishedCurriculum } from "@/lib/roadmap-engine/curriculum";
import type { StreamScope } from "./resolve-scope";
import { labFamily } from "./missions/registry";
import { IT_CLUSTER_SCOPE_KEY } from "./branch-clusters";
import type { StreamCandidate, StudentCourse } from "./select-stream";

type Service = SupabaseClient<Database>;

export interface StreamStudentContext {
  /** current year of study when it is known and confirmed, else null (selection then ignores the curriculum, honestly) */
  currentYear: number | null;
  /** the PUBLISHED curriculum's courses for the student's institution + branch + regulation; empty if none is published */
  courses: StudentCourse[];
}

export async function loadStreamStudentContext(service: Service, userId: string, now: Date = new Date()): Promise<StreamStudentContext> {
  const direction = await getStudentDirection(service, userId, now);
  if (!direction?.institutionId || !direction.branch) return { currentYear: null, courses: [] };
  const currentYear = needsYearConfirmation(direction, now) ? null : direction.academicYear?.year ?? null;
  const curriculum = await loadPublishedCurriculum(service, direction.institutionId, direction.branch.trim().toLowerCase(), direction.regulation);
  return { currentYear, courses: curriculum.found ? curriculum.courses.map((c) => ({ title: c.title, year: c.year })) : [] };
}

interface PoolRow {
  id: string;
  difficulty: string;
  category: string;
  course_tags: string[];
  source?: string;
  kind?: string;
}

/**
 * PUBLISHED catalog challenges for this student's branch: ones that name the branch explicitly, plus the legacy per-scope pool
 * (branch-cluster content that predates explicit branch targeting). Drafts and retired content are never returned.
 */
const PAGE = 1000; // the database returns at most this many rows per request, so a bank larger than that has to be read in pages

/** Reads every row a query matches, a page at a time (ordered by id so pages never overlap). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function allRows(make: () => any): Promise<{ data: unknown[]; error: unknown }> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make().order("id").range(from, from + PAGE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return { data: rows, error: null };
  }
}

/** What an IT student can be served: LeetCode problems, bug-fix tasks (stored as leetcode) and SQL tasks. Never simulations. */
export const IT_KINDS = ["leetcode", "sql"];

export async function loadStreamPool(service: Service, scope: Pick<StreamScope, "scopeKey" | "branchKey"> & Partial<Pick<StreamScope, "promptLabel">>, userId?: string): Promise<StreamCandidate[]> {
  if (scope.scopeKey === IT_CLUSTER_SCOPE_KEY) {
    // IT students are served from the whole stored bank of LeetCode-style problems (up to STREAM_BANK_CAP). Each student's pick is spread by
    // a per-student hash, problems they solved are excluded and ones they were just served rank last (the selector does both), so a
    // problem they failed or skipped can come back but a solved one never does.
    const { data, error } = await allRows(() => untyped(service).from("arena_challenges").select("id, difficulty, category, course_tags, week_start, kind").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("status", "PUBLISHED").in("kind", IT_KINDS));
    if (error) throw error;
    return ((data ?? []) as (PoolRow & { week_start: string | null })[]).map((r) => ({ id: r.id, difficulty: r.difficulty, category: r.category, courseTags: r.course_tags ?? [], kind: r.kind }));
  }
  const base = () => untyped(service).from("arena_challenges").select("id, difficulty, category, course_tags, source, kind").eq("track", "stream").eq("status", "PUBLISHED").is("user_id", null);
  // the student's own written-for-them challenges (user_id set) are private to them and always PUBLISHED by the database trigger
  const own = () => untyped(service).from("arena_challenges").select("id, difficulty, category, course_tags, kind").eq("track", "stream").eq("scope_key", scope.scopeKey).eq("user_id", userId ?? "").eq("active", true);
  const [explicit, legacy, mine] = await Promise.all([allRows(() => base().contains("branch_keys", [scope.branchKey])), allRows(() => base().eq("scope_key", scope.scopeKey).eq("branch_keys", "{}")), userId ? allRows(own) : Promise.resolve({ data: [], error: null })]);
  if (explicit.error) throw explicit.error;
  if (legacy.error) throw legacy.error;
  if (mine.error) throw mine.error;
  const byId = new Map<string, PoolRow & { shared: boolean }>();
  // the branch's generated bank (AI_WEEKLY) is written for these students, so it ranks with their own; only the admin catalog counts as "shared"
  for (const row of [...((explicit.data ?? []) as PoolRow[]), ...((legacy.data ?? []) as PoolRow[])]) byId.set(row.id, { ...row, shared: row.source !== "AI_WEEKLY" });
  for (const row of (mine.data ?? []) as PoolRow[]) byId.set(row.id, { ...row, shared: false });
  // ECE, EEE, Mech and Civil practise in labs: only hands-on missions are served, never calculations, code or multiple-choice
  const labsOnly = labFamily(scope.promptLabel ?? "") !== null;
  return [...byId.values()].filter((r) => !labsOnly || r.kind === "mission").map((r) => ({ id: r.id, difficulty: r.difficulty, category: r.category, courseTags: r.course_tags ?? [], shared: r.shared }));
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { getStudentDirection, needsYearConfirmation } from "@/lib/career/direction";
import { loadPublishedCurriculum } from "@/lib/roadmap-engine/curriculum";
import type { StreamScope } from "./resolve-scope";
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
}

/**
 * PUBLISHED catalog challenges for this student's branch: ones that name the branch explicitly, plus the legacy per-scope pool
 * (branch-cluster content that predates explicit branch targeting). Drafts and retired content are never returned.
 */
export async function loadStreamPool(service: Service, scope: Pick<StreamScope, "scopeKey" | "branchKey">): Promise<StreamCandidate[]> {
  if (scope.scopeKey === IT_CLUSTER_SCOPE_KEY) {
    // IT students are served from the whole stored bank of LeetCode-style problems (up to STREAM_BANK_CAP). Each student's pick is spread by
    // a per-student hash, problems they solved are excluded and ones they were just served rank last (the selector does both), so a
    // problem they failed or skipped can come back but a solved one never does.
    const { data, error } = await untyped(service).from("arena_challenges").select("id, difficulty, category, course_tags, week_start").eq("track", "stream").eq("status", "PUBLISHED").eq("kind", "leetcode").limit(1500);
    if (error) throw error;
    return ((data ?? []) as (PoolRow & { week_start: string | null })[]).map((r) => ({ id: r.id, difficulty: r.difficulty, category: r.category, courseTags: r.course_tags ?? [] }));
  }
  const base = () => untyped(service).from("arena_challenges").select("id, difficulty, category, course_tags").eq("track", "stream").eq("status", "PUBLISHED").is("user_id", null);
  const [explicit, legacy] = await Promise.all([base().contains("branch_keys", [scope.branchKey]), base().eq("scope_key", scope.scopeKey).eq("branch_keys", "{}")]);
  if (explicit.error) throw explicit.error;
  if (legacy.error) throw legacy.error;
  const byId = new Map<string, PoolRow>();
  for (const row of [...((explicit.data ?? []) as PoolRow[]), ...((legacy.data ?? []) as PoolRow[])]) byId.set(row.id, row);
  return [...byId.values()].map((r) => ({ id: r.id, difficulty: r.difficulty, category: r.category, courseTags: r.course_tags ?? [] }));
}

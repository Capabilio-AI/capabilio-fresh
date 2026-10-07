import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import type { CurriculumCourse, SkillLink } from "./coverage";
import type { CurriculumContext } from "./graph-types";

type Service = SupabaseClient<Database>;
export interface TreeSkill {
  id: string;
  name: string;
  parentId: string | null;
}

const norm = (t: string) => ` ${t.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim()} `;

/** Pure. Does a subject's title name this skill? A whole-word phrase match ("Data Structures" in "Data Structures using C"), never a fuzzy guess. */
export function titleNamesSkill(title: string, skillName: string): boolean {
  const n = norm(skillName);
  return n.trim().length >= 3 && norm(title).includes(n);
}

export const TITLE_CONFIDENCE = 0.85;

/**
 * Pure. Inferred links for a subject from what is known without any AI: the skills its TITLE names, plus the narrower skills under any skill it is
 * linked to (a subject on "Data Structures" covers "Stacks and Queues"). Always INFERRED: a subject title is Capabilio's reading, not the college's claim.
 */
export function inferredFromTitle(title: string, existing: SkillLink[], skills: readonly TreeSkill[]): SkillLink[] {
  const direct = new Set([...existing.map((l) => l.skillId), ...skills.filter((s) => titleNamesSkill(title, s.name)).map((s) => s.id)]);
  const out: SkillLink[] = [];
  const have = new Set(existing.map((l) => l.skillId));
  for (const s of skills) {
    const named = titleNamesSkill(title, s.name);
    const underLinked = s.parentId !== null && direct.has(s.parentId);
    if (have.has(s.id) || (!named && !underLinked)) continue;
    out.push({ skillId: s.id, tier: "INFERRED", confidence: TITLE_CONFIDENCE, level: "COURSE", importance: null, evidence: named ? `The subject title names "${s.name}".` : "The subject covers the broader area this topic belongs to." });
  }
  return out;
}

const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

interface MapRow {
  skill_id: string;
  status: string;
  mapping_source: string;
  confidence: number | string | null;
  importance?: string | null;
  evidence_source: string | null;
}

/**
 * Pure. Official = confirmed by a person. Inferred = Capabilio's own suggestion that nobody rejected. A rejected mapping never appears,
 * and an AI suggestion can never be treated as confirmed (the database refuses that combination too).
 */
export function tierOf(row: Pick<MapRow, "status" | "mapping_source">): "OFFICIAL" | "INFERRED" | null {
  if (row.status === "REJECTED") return null;
  if (row.status === "CONFIRMED" && row.mapping_source !== "AI_SUGGESTED") return "OFFICIAL";
  return row.status === "SUGGESTED" && row.mapping_source === "AI_SUGGESTED" ? "INFERRED" : null;
}

const toLink = (r: MapRow, level: SkillLink["level"], extra: Partial<SkillLink> = {}): SkillLink | null => {
  const tier = tierOf(r);
  if (!tier) return null;
  return { skillId: r.skill_id, tier, confidence: r.confidence === null ? null : Number(r.confidence), level, importance: (r.importance as SkillLink["importance"]) ?? null, evidence: r.evidence_source, ...extra };
};

/** The student's PUBLISHED curriculum (their college, branch and, when known, regulation) with its courses, units, outcomes and skill links. */
export async function loadCurriculumOverlay(service: Service, ctx: { institutionId: string | null; branchKey: string | null; regulation: string | null; skills?: readonly TreeSkill[] }): Promise<CurriculumContext> {
  const empty = (state: CurriculumContext["state"]): CurriculumContext => ({ state, courses: null, versionNo: null, regulation: ctx.regulation, branch: ctx.branchKey });
  if (!ctx.institutionId || !ctx.branchKey) return empty("NO_BRANCH");
  const db = untyped(service);
  const { data: published } = await db.from("curriculum_imports").select("id, regulation").eq("institution_id", ctx.institutionId).eq("branch_key", ctx.branchKey).eq("status", "PUBLISHED").is("deleted_at", null).order("published_at", { ascending: false });
  const list = (published ?? []) as { id: string; regulation: string | null }[];
  const imp = ctx.regulation ? list.find((i) => same(i.regulation, ctx.regulation)) : list[0];
  if (!imp) return empty(ctx.regulation && list.length > 0 ? "REGULATION_MISMATCH" : "NONE");

  const [{ data: courseRows }, { data: version }] = await Promise.all([
    db.from("courses").select("id, title, course_code, year, semester, source_page_start, source_page_end, skills_analysed_at, provenance").eq("import_id", imp.id).is("deleted_at", null).order("sort_order"),
    db.from("curriculum_versions").select("version_no").eq("import_id", imp.id).maybeSingle(),
  ]);
  const courses = (courseRows ?? []) as { id: string; title: string; course_code: string | null; year: number; semester: number | null; source_page_start: number | null; source_page_end: number | null; skills_analysed_at: string | null; provenance: Record<string, unknown> | null }[];
  if (courses.length === 0) return { ...empty("NONE"), regulation: imp.regulation };
  const ids = courses.map((c) => c.id);
  const [{ data: units }, { data: outcomes }, { data: cm }, { data: om }, { data: um }] = await Promise.all([
    db.from("course_units").select("id, course_id, unit_no, title").in("course_id", ids).order("unit_no"),
    db.from("course_outcomes").select("id, course_id, code, text, source").in("course_id", ids).order("sort_order"),
    db.from("course_skill_mappings").select("course_id, skill_id, status, mapping_source, confidence, importance, evidence_source").in("course_id", ids),
    db.from("course_outcome_skill_mappings").select("course_outcome_id, course_id, skill_id, status, mapping_source, confidence, importance, evidence_source").in("course_id", ids),
    db.from("unit_skill_mappings").select("unit_id, course_id, skill_id, status, mapping_source, confidence, evidence_source").in("course_id", ids),
  ]);
  const by = <T extends { course_id: string }>(rows: T[] | null, id: string) => (rows ?? []).filter((r) => r.course_id === id);

  const built: CurriculumCourse[] = courses.map((c) => ({
    id: c.id, title: c.title, code: c.course_code, year: c.year, semester: c.semester,
    pages: c.source_page_start ? { start: c.source_page_start, end: c.source_page_end ?? c.source_page_start } : null,
    // analysed = it went through skill analysis (the automatic one, or a college that curated it by hand: it has confirmed mappings)
    analysed: Boolean(c.skills_analysed_at) || by(cm as { course_id: string; status: string }[] | null, c.id).some((m) => m.status === "CONFIRMED"),
    units: by(units as { course_id: string; id: string; unit_no: number; title: string }[] | null, c.id).map((u) => ({ id: u.id, no: u.unit_no, title: u.title })),
    outcomes: by(outcomes as { course_id: string; id: string; code: string; text: string; source: "EXTRACTED" | "INFERRED" | "COLLEGE_CONFIRMED" }[] | null, c.id).map((o) => ({ id: o.id, code: o.code, text: o.text, source: o.source })),
    links: [
      ...by(cm as (MapRow & { course_id: string })[] | null, c.id).map((r) => toLink(r, "COURSE")),
      ...by(um as (MapRow & { course_id: string; unit_id: string })[] | null, c.id).map((r) => toLink(r, "UNIT", { unitId: r.unit_id })),
      ...by(om as (MapRow & { course_id: string; course_outcome_id: string })[] | null, c.id).map((r) => toLink(r, "OUTCOME", { outcomeId: r.course_outcome_id })),
    ].filter((l): l is SkillLink => l !== null),
  }));
  // the title pass is deterministic and covers every subject, so every subject counts as analysed even when a college uploaded titles only
  const out = built.map((c) => ({ ...c, analysed: true, links: [...c.links, ...inferredFromTitle(c.title, c.links, ctx.skills ?? [])] }));
  return { state: "PUBLISHED", courses: out, versionNo: (version as { version_no: number } | null)?.version_no ?? null, regulation: imp.regulation, branch: ctx.branchKey };
}

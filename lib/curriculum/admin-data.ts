import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ImportStatus, MappingImportance, MappingSource, MappingStatus } from "./mapping-rules";

type Service = SupabaseClient<Database>;

export interface ImportSummary {
  program: string | null;
  branch: string;
  regulation: string | null;
  /** distinct years of study the curriculum covers, ascending */
  years: number[];
  courses: number;
  outcomes: number;
  /** distinct canonical skills in any non-rejected mapping */
  skillsIdentified: number;
  /** SUGGESTED mappings (course- and outcome-level) still waiting for a person */
  mappingsNeedingReview: number;
  confirmedMappings: number;
  status: ImportStatus;
}
export interface ImportListItem {
  id: string;
  branch: string;
  regulation: string | null;
  status: ImportStatus;
  createdAt: string;
  publishedAt: string | null;
  versionNo: number | null;
  summary: ImportSummary;
}
export interface CourseRow {
  id: string;
  year: number;
  semester: number | null;
  title: string;
  code: string | null;
  category: string | null;
  kind: string;
  credits: number | null;
  outcomes: number;
  units: number;
  experiments: number;
  confirmed: number;
  suggested: number;
  rejected: number;
  /** skill suggestions have been run for this course (even if they found nothing) */
  skillsSuggested: boolean;
}
export interface SkillOption {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
}
export interface MappingView {
  id: string;
  skillId: string;
  skillName: string;
  category: string;
  source: MappingSource;
  status: MappingStatus;
  confidence: number | null;
  importance: MappingImportance | null;
  evidence: string | null;
  approvedAt: string | null;
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** An import that belongs to this institution and is not removed; otherwise null (the caller answers 404). */
export async function getOwnedImport(service: Service, institutionId: string, importId: string) {
  const { data } = await service.from("curriculum_imports").select("*").eq("id", importId).eq("institution_id", institutionId).is("deleted_at", null).maybeSingle();
  return data;
}

async function summarise(service: Service, imp: Database["public"]["Tables"]["curriculum_imports"]["Row"]): Promise<ImportSummary> {
  const { data: courses } = await service.from("courses").select("id, year").eq("import_id", imp.id).is("deleted_at", null);
  const ids = (courses ?? []).map((c) => c.id);
  const [outcomes, maps, omaps] = ids.length
    ? await Promise.all([
        service.from("course_outcomes").select("id", { count: "exact", head: true }).in("course_id", ids),
        service.from("course_skill_mappings").select("skill_id, status").in("course_id", ids),
        service.from("course_outcome_skill_mappings").select("skill_id, status").in("course_id", ids),
      ])
    : [{ count: 0 }, { data: [] }, { data: [] }];
  const all = [...((maps as { data: { skill_id: string; status: string }[] | null }).data ?? []), ...((omaps as { data: { skill_id: string; status: string }[] | null }).data ?? [])];
  return {
    program: imp.program, branch: imp.branch, regulation: imp.regulation,
    years: [...new Set((courses ?? []).map((c) => c.year))].sort((a, b) => a - b),
    courses: ids.length, outcomes: (outcomes as { count: number | null }).count ?? 0,
    skillsIdentified: new Set(all.filter((m) => m.status !== "REJECTED").map((m) => m.skill_id)).size,
    mappingsNeedingReview: all.filter((m) => m.status === "SUGGESTED").length,
    confirmedMappings: all.filter((m) => m.status === "CONFIRMED").length,
    status: imp.status as ImportStatus,
  };
}

export async function listImports(service: Service, institutionId: string): Promise<ImportListItem[]> {
  const { data: imports } = await service.from("curriculum_imports").select("*").eq("institution_id", institutionId).is("deleted_at", null).order("created_at", { ascending: false });
  const { data: versions } = await service.from("curriculum_versions").select("import_id, version_no").eq("institution_id", institutionId);
  const versionOf = new Map((versions ?? []).map((v) => [v.import_id, v.version_no]));
  return Promise.all(
    (imports ?? []).map(async (i) => ({
      id: i.id, branch: i.branch, regulation: i.regulation, status: i.status as ImportStatus, createdAt: i.created_at, publishedAt: i.published_at,
      versionNo: versionOf.get(i.id) ?? null, summary: await summarise(service, i),
    }))
  );
}

export async function getImportOverview(service: Service, institutionId: string, importId: string) {
  const imp = await getOwnedImport(service, institutionId, importId);
  if (!imp) return null;
  const { data: rows } = await service.from("courses").select("id, year, semester, title, course_code, category, kind, credits, deleted_at, sort_order, provenance").eq("import_id", importId).order("year").order("semester", { nullsFirst: false }).order("sort_order");
  const ids = (rows ?? []).map((c) => c.id);
  const [{ data: outcomes }, { data: units }, { data: labs }, { data: maps }, { data: version }, { data: pos }] = await Promise.all([
    ids.length ? service.from("course_outcomes").select("course_id").in("course_id", ids) : { data: [] as { course_id: string }[] },
    ids.length ? service.from("course_units").select("course_id").in("course_id", ids) : { data: [] as { course_id: string }[] },
    ids.length ? service.from("lab_experiments").select("course_id").in("course_id", ids) : { data: [] as { course_id: string }[] },
    ids.length ? service.from("course_skill_mappings").select("course_id, status").in("course_id", ids) : { data: [] as { course_id: string; status: string }[] },
    service.from("curriculum_versions").select("version_no").eq("import_id", importId).maybeSingle(),
    service.from("program_outcomes").select("kind").eq("import_id", importId),
  ]);
  const count = <T extends { course_id: string }>(list: T[] | null, id: string, pred: (x: T) => boolean = () => true) => (list ?? []).filter((x) => x.course_id === id && pred(x)).length;
  const toRow = (c: NonNullable<typeof rows>[number]): CourseRow => ({
    id: c.id, year: c.year, semester: c.semester, title: c.title, code: c.course_code, category: c.category, kind: c.kind, credits: num(c.credits),
    outcomes: count(outcomes, c.id), units: count(units, c.id), experiments: count(labs, c.id),
    confirmed: count(maps, c.id, (m) => m.status === "CONFIRMED"), suggested: count(maps, c.id, (m) => m.status === "SUGGESTED"), rejected: count(maps, c.id, (m) => m.status === "REJECTED"),
    skillsSuggested: Boolean((c.provenance as Record<string, unknown> | null)?._skillsSuggestedAt),
  });
  return {
    import: imp,
    summary: await summarise(service, imp),
    courses: (rows ?? []).filter((c) => !c.deleted_at).map(toRow),
    removed: (rows ?? []).filter((c) => c.deleted_at).map(toRow),
    versionNo: version?.version_no ?? null,
    programOutcomes: { po: (pos ?? []).filter((p) => p.kind === "PO").length, pso: (pos ?? []).filter((p) => p.kind === "PSO").length },
  };
}

export async function getSkillCatalog(service: Service): Promise<SkillOption[]> {
  const { data } = await service.from("skills").select("id, key, name, category, description").eq("status", "active").order("category").order("name");
  return (data ?? []).map((s) => ({ id: s.id, key: s.key ?? "", name: s.name, category: s.category ?? "Other", description: s.description }));
}

export async function getCourseDetail(service: Service, institutionId: string, courseId: string) {
  const { data: course } = await service.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (!course) return null;
  const imp = await getOwnedImport(service, institutionId, course.import_id);
  if (!imp) return null;
  const [{ data: outcomes }, { data: units }, { data: topics }, { data: labs }, { data: maps }, { data: omaps }, { data: skills }, { data: siblings }] = await Promise.all([
    service.from("course_outcomes").select("id, code, text, bloom_level, sort_order").eq("course_id", courseId).order("sort_order"),
    service.from("course_units").select("id, unit_no, title, hours").eq("course_id", courseId).order("unit_no"),
    service.from("unit_topics").select("unit_id, text, sort_order").eq("course_id", courseId).order("sort_order"),
    service.from("lab_experiments").select("text, sort_order").eq("course_id", courseId).order("sort_order"),
    service.from("course_skill_mappings").select("id, skill_id, mapping_source, confidence, importance, evidence_source, status, approved_at").eq("course_id", courseId),
    service.from("course_outcome_skill_mappings").select("id, course_outcome_id, skill_id, mapping_source, confidence, importance, evidence_source, status, approved_at").eq("course_id", courseId),
    service.from("skills").select("id, name, category"),
    service.from("courses").select("id, title, year").eq("import_id", course.import_id).is("deleted_at", null).neq("id", courseId).order("year").order("title"),
  ]);
  const skill = new Map((skills ?? []).map((s) => [s.id, s]));
  const view = (m: { id: string; skill_id: string; mapping_source: string; confidence: number | null; importance: string | null; evidence_source: string | null; status: string; approved_at: string | null }): MappingView => ({
    id: m.id, skillId: m.skill_id, skillName: skill.get(m.skill_id)?.name ?? "Unknown skill", category: skill.get(m.skill_id)?.category ?? "Other",
    source: m.mapping_source as MappingSource, status: m.status as MappingStatus, confidence: num(m.confidence), importance: m.importance as MappingImportance | null, evidence: m.evidence_source, approvedAt: m.approved_at,
  });
  return {
    import: imp,
    editable: imp.status !== "PUBLISHED" && imp.status !== "ARCHIVED",
    course,
    outcomes: (outcomes ?? []).map((o) => ({ ...o, mappings: (omaps ?? []).filter((m) => m.course_outcome_id === o.id).map(view) })),
    units: (units ?? []).map((u) => ({ ...u, hours: num(u.hours), topics: (topics ?? []).filter((t) => t.unit_id === u.id).map((t) => t.text) })),
    experiments: (labs ?? []).map((l) => l.text),
    mappings: (maps ?? []).map(view),
    siblings: siblings ?? [],
  };
}
export type CourseDetail = NonNullable<Awaited<ReturnType<typeof getCourseDetail>>>;

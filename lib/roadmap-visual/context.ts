import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { getCareerIntent } from "@/lib/careers/intent";
import { chooseDomainCareer, type CareerChoice } from "@/lib/arena-challenges/career-state";
import { loadStudentCapabilities } from "@/lib/capability/read-model";
import { getStudentDirection, needsYearConfirmation } from "@/lib/career/direction";
import { DEFAULT_ACADEMIC_START_MONTH } from "@/lib/career/academic-year";
import { estimateSemester, totalYearsOf } from "@/lib/roadmap-engine/position";
import { loadCurriculumOverlay } from "./curriculum-overlay";
import type { GraphContext, GraphUnavailable, Position, TemplateNodeRow } from "./graph-types";
import { loadResourcePool } from "./resources";
import { getInferredMinConfidence } from "./settings";
import type { UserNodeState } from "./status";

type Service = SupabaseClient<Database>;

export type ContextResult = { ok: true; ctx: GraphContext; meta: { which: CareerChoice; primary: string; planB: string | null; membershipId: string | null } } | { ok: false; reason: GraphUnavailable };

interface NodeDb {
  id: string;
  node_key: string;
  parent_node_id: string | null;
  type: "SPINE" | "GROUP" | "TOPIC";
  title: string;
  description: string | null;
  skill_id: string | null;
  importance: "CORE" | "RECOMMENDED" | "OPTIONAL";
  target_level: number | null;
  stage: TemplateNodeRow["stage"];
  sort_order: number;
  side: "LEFT" | "RIGHT" | "CENTER";
}

/** The student's position: year from their confirmed academic year, semester from what they confirmed or else an estimate from the calendar. */
async function loadPosition(service: Service, userId: string, now: Date): Promise<{ position: Position; institutionId: string | null; branch: string | null; regulation: string | null; membershipId: string | null }> {
  const direction = await getStudentDirection(service, userId, now);
  if (!direction) return { position: { year: null, semester: null, semesterEstimated: true, totalYears: null }, institutionId: null, branch: null, regulation: null, membershipId: null };
  const [{ data: membership }, { data: institution }] = await Promise.all([
    untyped(service).from("institution_memberships").select("current_semester, semester_confirmed_at").eq("id", direction.membershipId).maybeSingle(),
    direction.institutionId ? service.from("institutions").select("academic_start_month").eq("id", direction.institutionId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const year = needsYearConfirmation(direction, now) ? null : direction.academicYear?.year ?? null;
  const confirmed = (membership as { current_semester: number | null; semester_confirmed_at: string | null } | null) ?? null;
  const semester = year === null ? null : confirmed?.current_semester ?? estimateSemester(now, institution?.academic_start_month ?? DEFAULT_ACADEMIC_START_MONTH);
  return {
    position: { year, semester, semesterEstimated: !(confirmed?.current_semester && confirmed.semester_confirmed_at), totalYears: direction.startYear && direction.endYear ? totalYearsOf(direction.startYear, direction.endYear) : null },
    institutionId: direction.institutionId, branch: direction.branch, regulation: direction.regulation, membershipId: direction.membershipId,
  };
}

/**
 * Everything the roadmap needs, from real data: the student's chosen career and its PUBLISHED template, their evidence, their own node state, and their
 * published syllabus. Says exactly what is missing instead of inventing a roadmap.
 */
export async function loadGraphContext(service: Service, userId: string, which: CareerChoice, now: Date = new Date()): Promise<ContextResult> {
  const { intent } = await getCareerIntent(service, userId);
  const chosen = chooseDomainCareer(intent, which);
  if (chosen.state === "unset") return { ok: false, reason: { state: "NO_CAREER" } };
  if (chosen.state === "exploring") return { ok: false, reason: { state: "EXPLORING" } };
  if (chosen.state === "no_plan_b") return { ok: false, reason: { state: "NO_PLAN_B", primary: chosen.primary } };

  const db = untyped(service);
  const { data: template } = await db.from("roadmap_templates").select("id, version, title, published_at").eq("career_id", chosen.career.id).eq("status", "PUBLISHED").maybeSingle();
  if (!template) return { ok: false, reason: { state: "NO_TEMPLATE", career: chosen.career } };

  const [{ data: nodeRows }, { data: edgeRows }, { data: requirements }] = await Promise.all([
    db.from("roadmap_nodes").select("id, node_key, parent_node_id, type, title, description, skill_id, importance, target_level, stage, sort_order, side").eq("template_id", template.id),
    db.from("roadmap_edges").select("from_node_id, to_node_id, type").eq("template_id", template.id),
    db.from("career_skill_requirements").select("skill_id, importance, target_level").eq("career_id", chosen.career.id),
  ]);
  const nodesDb = (nodeRows ?? []) as NodeDb[];
  const keyOf = new Map(nodesDb.map((n) => [n.id, n.node_key]));
  const skillIds = [...new Set(nodesDb.flatMap((n) => (n.skill_id ? [n.skill_id] : [])))];
  const { data: skills } = skillIds.length ? await service.from("skills").select("id, name").in("id", skillIds) : { data: [] };
  const skillName = new Map((skills ?? []).map((s) => [s.id, s.name]));
  const { data: parents } = skillIds.length ? await service.from("skills").select("id, parent_skill_id").in("id", skillIds) : { data: [] };
  const treeSkills = (skills ?? []).map((s) => ({ id: s.id, name: s.name, parentId: (parents ?? []).find((x) => x.id === s.id)?.parent_skill_id ?? null }));
  const required = new Map(((requirements ?? []) as { skill_id: string; importance: string; target_level: number }[]).map((r) => [r.skill_id, r]));

  const nodes: TemplateNodeRow[] = nodesDb.map((n) => {
    const req = n.skill_id ? required.get(n.skill_id) : undefined;
    return {
      id: n.id, key: n.node_key, parentKey: n.parent_node_id ? keyOf.get(n.parent_node_id) ?? null : null, type: n.type, title: n.title, description: n.description ?? "", skillId: n.skill_id, skillName: n.skill_id ? skillName.get(n.skill_id) ?? null : null,
      importance: n.importance, target: n.target_level, stage: n.stage, order: n.sort_order, side: n.side,
      targetSource: req && req.target_level === n.target_level ? `${chosen.career.name} career requirement (${req.importance.toLowerCase()})` : `Capabilio's target for this topic in the ${chosen.career.name} roadmap`,
    };
  });

  const [caps, p, userStateRows, threshold] = await Promise.all([
    loadStudentCapabilities(service, userId, now),
    loadPosition(service, userId, now),
    db.from("roadmap_node_state").select("node_id, status, skip_reason").eq("student_id", userId).in("node_id", nodesDb.map((n) => n.id)),
    getInferredMinConfidence(service),
  ]);
  const [curriculum, resources] = await Promise.all([
    loadCurriculumOverlay(service, { institutionId: p.institutionId, branchKey: p.branch ? p.branch.trim().toLowerCase() : null, regulation: p.regulation, skills: treeSkills }),
    loadResourcePool(service, { skillIds, nodeIds: new Map(nodesDb.map((n) => [n.node_key, n.id])), studentId: userId, institutionId: p.institutionId }),
  ]);

  const userStates = new Map<string, { status: Exclude<UserNodeState, null>; reason: string | null }>();
  for (const r of ((userStateRows.data ?? []) as { node_id: string; status: "LEARNING" | "DONE" | "SKIPPED"; skip_reason: string | null }[])) {
    const key = keyOf.get(r.node_id);
    // marks saved before "Done" was removed count as Learning: only evidence completes a topic
    if (key) userStates.set(key, { status: r.status === "DONE" ? "LEARNING" : r.status, reason: r.skip_reason });
  }

  return {
    ok: true,
    meta: { which: chosen.which, primary: chosen.primary, planB: chosen.planB, membershipId: p.membershipId },
    ctx: {
      career: chosen.career, template: { id: template.id, version: template.version, title: template.title, publishedAt: template.published_at }, nodes,
      edges: ((edgeRows ?? []) as { from_node_id: string; to_node_id: string; type: "PREREQUISITE" | "CONNECTOR" | "OPTIONAL_PATH" }[]).flatMap((e) => (keyOf.get(e.from_node_id) && keyOf.get(e.to_node_id) ? [{ from: keyOf.get(e.from_node_id)!, to: keyOf.get(e.to_node_id)!, type: e.type }] : [])),
      scores: caps.bySkill, evidenceInputs: caps.inputs, userStates, curriculum, position: p.position, inferredThreshold: threshold, resources, now,
    },
  };
}

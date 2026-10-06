/**
 * Milestones — PURE. Year- and semester-aware, prerequisite-aware, honest about status. A skill is never scheduled before the skill it builds on
 * unless it is shown as BLOCKED and flagged "optional exploration" (the student may begin early, but is told what to build first).
 */
import { REQUIREMENT_WEIGHT } from "@/lib/careers/relevance";
import type { CertRelevance } from "@/lib/catalog/match";
import type { EngineInput, GapRow, Horizon, MilestoneRow, Stage, SubjectRow } from "./types";

export const HORIZON_ORDER: Horizon[] = ["NOW", "NEXT", "THIS_YEAR", "NEXT_YEAR", "LONG_TERM"];
/** The prerequisite counts as "begun enough" once the student is this far toward its target. */
export const PREREQUISITE_FRACTION = 0.5;

const rank = (h: Horizon) => HORIZON_ORDER.indexOf(h);
export const laterOf = (a: Horizon, b: Horizon): Horizon => (rank(a) >= rank(b) ? a : b);
const after = (h: Horizon): Horizon => HORIZON_ORDER[Math.min(rank(h) + 1, HORIZON_ORDER.length - 1)];

export function horizonOfCourse(c: { year: number; semester: number | null }, position: EngineInput["position"]): Horizon | null {
  const idx = (y: number, s: number) => (y - 1) * 2 + (s - 1);
  if (c.semester === null) return c.year < position.year ? null : c.year === position.year ? "NOW" : c.year === position.year + 1 ? "NEXT_YEAR" : "LONG_TERM";
  const delta = idx(c.year, c.semester) - idx(position.year, position.semester);
  if (delta < 0) return null;
  if (delta === 0) return "NOW";
  if (delta === 1) return "NEXT";
  if (c.year === position.year) return "THIS_YEAR";
  return c.year === position.year + 1 ? "NEXT_YEAR" : "LONG_TERM";
}

export function horizonOfSkill(stage: Stage, position: EngineInput["position"]): Horizon {
  const yearsLeft = Math.max(0, position.totalYears - position.year);
  if (stage === "FOUNDATION") return "NOW";
  if (stage === "INTERMEDIATE") return "NEXT";
  return yearsLeft === 0 ? "THIS_YEAR" : yearsLeft === 1 ? "NEXT_YEAR" : "LONG_TERM";
}

const CERT_HORIZON: Record<CertRelevance, Horizon> = { REQUIRED: "NEXT", RECOMMENDED: "NEXT_YEAR", OPTIONAL: "LONG_TERM" };

export interface MilestoneInput {
  gaps: GapRow[];
  subjects: SubjectRow[];
  certifications: { certId: string; name: string; relevance: CertRelevance }[];
  projects: { projectId: string; title: string }[];
  position: EngineInput["position"];
}

export function buildMilestones({ gaps, subjects, certifications, projects, position }: MilestoneInput): MilestoneRow[] {
  const byId = new Map(gaps.map((g) => [g.skillId, g]));
  const memo = new Map<string, { horizon: Horizon; blockedBy: string | null }>();
  const place = (g: GapRow, seen: Set<string> = new Set()): { horizon: Horizon; blockedBy: string | null } => {
    const known = memo.get(g.skillId);
    if (known) return known;
    const base = horizonOfSkill(g.stage, position);
    const parent = g.parentSkillId && !seen.has(g.parentSkillId) ? byId.get(g.parentSkillId) : undefined;
    let result = { horizon: base, blockedBy: null as string | null };
    if (parent && !parent.met && parent.currentLevel < parent.targetLevel * PREREQUISITE_FRACTION) {
      result = { horizon: laterOf(base, after(place(parent, new Set([...seen, g.skillId])).horizon)), blockedBy: parent.skillId };
    }
    memo.set(g.skillId, result);
    return result;
  };

  const skillMs: MilestoneRow[] = gaps.map((g) => {
    if (g.met) return { kind: "SKILL", refId: g.skillId, title: `${g.skillName}: target of ${g.targetLevel} reached`, horizon: "NOW", status: "COMPLETED", reason: `You're at ${g.currentLevel} and the target is ${g.targetLevel}.`, optionalExploration: false, blockedBySkillId: null };
    const { horizon, blockedBy } = place(g);
    const parent = blockedBy ? byId.get(blockedBy) : undefined;
    return {
      kind: "SKILL", refId: g.skillId, title: `Reach ${g.targetLevel} in ${g.skillName}`, horizon,
      status: blockedBy ? "BLOCKED" : g.currentLevel > 0 ? "IN_PROGRESS" : "NOT_STARTED",
      reason: blockedBy ? `Build ${parent?.skillName ?? "its prerequisite"} first — it's at ${parent?.currentLevel ?? 0} of ${parent?.targetLevel ?? 0}. You can explore this early, but it works better after.` : `You're at ${g.currentLevel} and the career asks for ${g.targetLevel}.`,
      optionalExploration: Boolean(blockedBy), blockedBySkillId: blockedBy,
    };
  });

  const courseMs: MilestoneRow[] = subjects.flatMap((s) => {
    const horizon = horizonOfCourse(s, position);
    if (!horizon) return []; // already behind the student
    return [{ kind: "COURSE" as const, refId: s.courseId, title: `${s.title} (Year ${s.year}${s.semester ? `, Semester ${s.semester}` : ""})`, horizon, status: s.schedule === "CURRENT" ? ("IN_PROGRESS" as const) : ("NOT_STARTED" as const), reason: `Builds ${s.facts.skillNames.slice(0, 3).join(", ")} — skills your target career still needs.`, optionalExploration: false, blockedBySkillId: null }];
  });
  const certMs: MilestoneRow[] = certifications.map((c) => ({ kind: "CERTIFICATION", refId: c.certId, title: c.name, horizon: CERT_HORIZON[c.relevance], status: "NOT_STARTED", reason: `${c.relevance === "REQUIRED" ? "Required" : c.relevance === "RECOMMENDED" ? "Recommended" : "Optional"} for your target career.`, optionalExploration: false, blockedBySkillId: null }));
  const projectMs: MilestoneRow[] = projects.slice(0, 1).map((p) => ({ kind: "PROJECT", refId: p.projectId, title: p.title, horizon: "NEXT", status: "NOT_STARTED", reason: "Building it turns what you've learned into evidence.", optionalExploration: false, blockedBySkillId: null }));

  const weight = (m: MilestoneRow) => (m.kind === "SKILL" ? REQUIREMENT_WEIGHT[byId.get(m.refId)?.importance ?? "LOW"] : m.kind === "COURSE" ? 3 : 2);
  const kindOrder = { COURSE: 0, SKILL: 1, CERTIFICATION: 2, PROJECT: 3 } as const;
  return [...courseMs, ...skillMs, ...certMs, ...projectMs].sort((a, b) => rank(a.horizon) - rank(b.horizon) || weight(b) - weight(a) || kindOrder[a.kind] - kindOrder[b.kind] || a.title.localeCompare(b.title));
}

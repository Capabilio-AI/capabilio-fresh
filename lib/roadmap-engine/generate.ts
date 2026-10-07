/**
 * RoadmapGenerationService, the PURE core. Input -> plan, with no database and no AI: gap analysis, subject priority, recommendations drawn only
 * from the configured catalogs, milestones, readiness and the next best action. Same input always gives the same plan.
 */
import { REQUIREMENT_WEIGHT } from "@/lib/careers/relevance";
import { recommendArena, recommendCertifications, recommendLearning, recommendProjects, type ArenaChallengeItem, type CertificationItem, type Difficulty, type LearningRecommendation, type ProjectItem } from "@/lib/catalog/match";
import { analyseGaps } from "./gaps";
import { buildMilestones } from "./milestones";
import { MANDATORY_NOTE, prioritiseSubjects } from "./subjects";
import { computeReadiness, READINESS_EXPLANATION } from "./readiness";
import type { EngineInput, GapRow, MilestoneRow, NextBestAction, SubjectRow } from "./types";

export interface LearningRow extends LearningRecommendation {
  skillId: string;
  skillName: string;
}
export interface RoadmapPlan {
  career: { id: string; name: string };
  readiness: number;
  readinessExplanation: string;
  /** no capability data of any kind: the plan is built, but a baseline assessment is the first thing to do */
  baselineRecommended: boolean;
  gaps: GapRow[];
  subjects: SubjectRow[];
  mandatoryNote: string;
  learning: LearningRow[];
  learningNotConfigured: { skillId: string; skillName: string; message: string }[];
  certifications: { cert: CertificationItem; relevance: "REQUIRED" | "RECOMMENDED" | "OPTIONAL"; coveredSkillIds: string[] }[];
  certificationNote: string | null;
  projects: { project: ProjectItem; coveredSkillIds: string[]; isAiRecommendation: boolean }[];
  projectNote: string | null;
  arena: { challenge: ArenaChallengeItem; coveredSkillIds: string[] }[];
  arenaNote: string | null;
  milestones: MilestoneRow[];
  nextBestAction: NextBestAction;
}

const MAX_LEARNING_GAPS = 8;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function nextBestAction(args: {
  gaps: GapRow[];
  milestones: MilestoneRow[];
  subjects: SubjectRow[];
  learning: LearningRow[];
  arena: RoadmapPlan["arena"];
  projects: RoadmapPlan["projects"];
  hasAnyCapabilityData: boolean;
}): NextBestAction {
  if (!args.hasAnyCapabilityData) {
    return { kind: "ASSESS", skillId: null, skillName: null, title: "Take the baseline assessment", reason: "We don't have any capability data for you yet, so we can't tell where you stand against this career.", ref: null };
  }
  const blocked = new Set(args.milestones.filter((m) => m.status === "BLOCKED").map((m) => m.refId));
  const candidates = args.gaps
    .filter((g) => !g.met && !blocked.has(g.skillId))
    .map((g) => ({ g, impact: REQUIREMENT_WEIGHT[g.importance] * (g.gap / 100) }))
    .sort((a, b) => b.impact - a.impact || a.g.skillName.localeCompare(b.g.skillName))
    .map((x) => x.g);
  if (candidates.length === 0) return { kind: "NONE", skillId: null, skillName: null, title: "You've met every target for this career", reason: "Every required skill is at or above its target level.", ref: null };

  const reasonFor = (top: GapRow) =>
    !top.assessed
      ? `You haven't been assessed on ${top.skillName} yet, so we don't know where you are. The target is ${top.targetLevel}.`
      : top.selfDeclaredOnly
      ? `You've told us you know ${top.skillName}, but nothing verifies it yet, so we count it as ${top.currentLevel}. The target is ${top.targetLevel}.`
      : `Your ${top.skillName} capability is ${top.currentLevel} and your target is ${top.targetLevel}.`;
  const has = (top: GapRow) => (s: SubjectRow) => s.facts.skillIds.includes(top.skillId);
  const base = (top: GapRow) => ({ skillId: top.skillId, skillName: top.skillName, reason: reasonFor(top) });
  /** something the student can do today: this semester's course, a resource they can start now, an Arena challenge, a project */
  const immediate = (top: GapRow): NextBestAction | null => {
    const current = args.subjects.find((s) => s.schedule === "CURRENT" && has(top)(s));
    if (current) return { ...base(top), kind: "COURSE", title: `Focus on ${current.title} this semester`, ref: { type: "course", id: current.courseId } };
    const learn = args.learning.find((l) => l.skillId === top.skillId && l.startsNow);
    if (learn) return { ...base(top), kind: "LEARN", title: `Start ${learn.item.title}`, ref: { type: "learning", id: learn.item.id } };
    const arena = args.arena.find((a) => a.coveredSkillIds.includes(top.skillId));
    if (arena) return { ...base(top), kind: "ARENA", title: `Try the Arena challenge “${arena.challenge.title}”`, ref: { type: "arena", id: arena.challenge.id } };
    const project = args.projects.find((p) => p.coveredSkillIds.includes(top.skillId));
    if (project) return { ...base(top), kind: "PROJECT", title: `Build “${project.project.title}”`, ref: { type: "project", id: project.project.id } };
    return null;
  };
  const upcoming = (top: GapRow): NextBestAction | null => {
    const next = args.subjects.find((s) => s.schedule === "UPCOMING" && has(top)(s));
    return next ? { ...base(top), kind: "COURSE", title: `Prepare for ${next.title} (Year ${next.year}${next.semester ? `, Semester ${next.semester}` : ""})`, ref: { type: "course", id: next.courseId } } : null;
  };
  // The highest-impact gap the student can act on today; failing that, one with an upcoming course; and only if no gap has any action, say so.
  for (const g of candidates) { const a = immediate(g); if (a) return a; }
  for (const g of candidates) { const a = upcoming(g); if (a) return a; }
  return { ...base(candidates[0]), kind: "NONE", title: `No resource configured yet for ${candidates[0].skillName}`, ref: null };
}

export function generateRoadmap(input: EngineInput): RoadmapPlan {
  const gaps = analyseGaps(input);
  const open = gaps.filter((g) => !g.met);
  const subjects = prioritiseSubjects(input.courses, gaps, input.position);
  const readiness = computeReadiness(input.requirements, input.capability);

  // Additional learning: only for skills the curriculum does not fully cover, only from the learning catalog.
  const needLearning = open.filter((g) => g.coverage !== "STRONG").slice(0, MAX_LEARNING_GAPS);
  const learning: LearningRow[] = needLearning.flatMap((g) => recommendLearning(g.skillId, g.currentLevel, g.targetLevel, input.catalogs.learning, 2).map((r) => ({ ...r, skillId: g.skillId, skillName: g.skillName })));
  const learningNotConfigured = needLearning.filter((g) => !learning.some((l) => l.skillId === g.skillId)).map((g) => ({ skillId: g.skillId, skillName: g.skillName, message: `No learning resource configured yet for ${g.skillName}.` }));

  const gapIds = open.map((g) => g.skillId);
  const certifications = recommendCertifications(input.career.id, gapIds, input.catalogs.certifications);
  const certConfigured = input.catalogs.certifications.some((c) => c.careers.some((x) => x.careerId === input.career.id));
  const certificationNote = certifications.length ? null : certConfigured ? "No certification in the catalog covers your remaining gaps for this career." : "Certification recommendation not configured yet.";

  const meanLevel = avg(open.map((g) => g.currentLevel));
  const maxDifficulty: Difficulty = meanLevel < 40 ? "BEGINNER" : meanLevel < 70 ? "INTERMEDIATE" : "ADVANCED";
  const projects = recommendProjects(gapIds, input.catalogs.projects, { studentId: input.student.id, institutionId: input.student.institutionId, maxDifficulty }).slice(0, 4);
  const projectNote = projects.length ? null : input.catalogs.projects.some((p) => p.status === "ACTIVE") ? "No project in the catalog matches your remaining gaps yet." : "Project recommendations aren't configured yet.";

  const wanted = meanLevel < 40 ? "easy" : meanLevel < 70 ? "medium" : "hard";
  const arenaRanked = recommendArena(gapIds, input.catalogs.arena, wanted, Number.POSITIVE_INFINITY);
  const arena = arenaRanked.slice(0, 5);
  const arenaNote = arena.length ? null : "No Arena challenge is tagged with your remaining gaps yet.";

  const milestones = buildMilestones({
    gaps, subjects,
    certifications: certifications.map((c) => ({ certId: c.cert.id, name: c.cert.name, relevance: c.relevance })),
    projects: projects.map((p) => ({ projectId: p.project.id, title: p.project.title })),
    position: input.position,
  });
  return {
    career: input.career, readiness, readinessExplanation: READINESS_EXPLANATION, baselineRecommended: !input.hasAnyCapabilityData,
    gaps, subjects, mandatoryNote: MANDATORY_NOTE, learning, learningNotConfigured, certifications, certificationNote, projects, projectNote, arena, arenaNote, milestones,
    nextBestAction: nextBestAction({ gaps, milestones, subjects, learning, arena: arenaRanked, projects, hasAnyCapabilityData: input.hasAnyCapabilityData }),
  };
}

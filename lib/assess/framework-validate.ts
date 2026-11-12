// The deterministic gate between "a model proposed a framework" and "students are assessed on it". The critic's verdict is applied by plain rules, and every
// number a student's assessment depends on (importance, weight, target level, question budget) is derived here from the competency class, never taken from the
// model. Pure and fully tested.

import type { RoleCritique } from "@/lib/ai/llm/prompts/role-critic.v1";
import { ASSESSMENT_LENGTH } from "@/lib/ai/llm/prompts/role-profile.v1";
import type { RoleFramework } from "@/lib/ai/llm/prompts/role-framework.v2";

export type Tier = RoleFramework["skills"][number]["tier"];
export type Importance = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export const IMPORTANCE_OF_TIER: Readonly<Record<Tier, Importance>> = { CORE: "CRITICAL", INDUSTRY: "HIGH", TOOL: "HIGH", PRACTICAL: "HIGH", SUPPORTING: "MEDIUM", ANALYTICAL: "MEDIUM", ADVANCED: "LOW" };
const WEIGHT: Readonly<Record<Importance, number>> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const TARGET: Readonly<Record<Importance, number>> = { CRITICAL: 75, HIGH: 65, MEDIUM: 55, LOW: 40 };

export const MIN_SKILLS = 10;
export const MIN_CORE = 5;
export const MAX_CORE = 8;
export const MIN_CONFIDENCE = 0.5;
/** more than this share of the proposed skills rejected means the draft was not about this role: regenerate instead of patching */
export const MAX_DROPPED_SHARE = 0.35;

/** General employability is assessed in the common assessment and tracked separately, so it never appears in a role's technical graph. */
const GENERIC = new Set([
  "communication", "communication skills", "technical communication", "written communication", "verbal communication", "teamwork", "collaboration", "team collaboration",
  "problem solving", "problem solving skills", "critical thinking", "time management", "leadership", "project management", "ms office", "microsoft office",
  "interpersonal skills", "adaptability", "creativity", "presentation skills", "analytical thinking", "analytical skills", "attention to detail", "work ethic",
]);
export const normalizeSkill = (name: string) => name.toLowerCase().replace(/[^a-z0-9+#. ]+/g, " ").replace(/\s+/g, " ").trim();
export const isGenericSkill = (name: string) => GENERIC.has(normalizeSkill(name));
/** The reviewer echoes skill names with small changes ("Prototype BMS Testing" for "Prototype BMS Testing (practical)"): match on the core of the name. */
const coreOf = (name: string) => normalizeSkill(name.replace(/\([^)]*\)/g, " "));

export interface GatedSkill {
  name: string;
  tier: Tier;
  category: "technical" | "analytical" | "professional" | "domain";
  description: string;
  rationale: string;
  assessmentType: RoleFramework["skills"][number]["assessmentType"];
  importance: Importance;
  assessmentWeight: number;
  targetLevel: number;
  minQuestions: number;
  maxQuestions: number;
  relevance: number;
}
export interface GateResult {
  ok: boolean;
  skills: GatedSkill[];
  dropped: { name: string; reason: string }[];
  /** why the framework cannot be used as it is; empty when ok */
  reasons: string[];
  competencyConfidence: number;
  missingCoreSkills: string[];
}

/** Question budgets that always add up to a full assessment: minimums at most ASSESSMENT_LENGTH, maximums at least ASSESSMENT_LENGTH. */
export function budgets(importances: readonly Importance[]): { min: number; max: number }[] {
  const min = { CRITICAL: 2, HIGH: 1, MEDIUM: 1, LOW: 0 };
  const max = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const out = importances.map((i) => ({ min: min[i], max: max[i] }));
  const sum = (k: "min" | "max") => out.reduce((a, b) => a + b[k], 0);
  // too many mandatory questions: relax the lowest classes first
  for (const step of ["MEDIUM", "HIGH"] as const) {
    for (let i = out.length - 1; i >= 0 && sum("min") > ASSESSMENT_LENGTH; i--) if (importances[i] === step && out[i].min > 0) out[i].min = 0;
  }
  // too few possible questions: let the most important skills take more
  for (let guard = 0; sum("max") < ASSESSMENT_LENGTH && guard < 40; guard++) {
    const i = importances.findIndex((x, ix) => (x === "CRITICAL" || x === "HIGH") && out[ix].max < 5);
    if (i < 0) break;
    out[i].max += 1;
  }
  return out;
}

export function applyCritique(framework: RoleFramework, critique: RoleCritique): GateResult {
  const review = new Map(critique.skills.map((s) => [normalizeSkill(s.name), s]));
  const reviewOf = (name: string) => {
    const exact = review.get(normalizeSkill(name));
    if (exact) return exact;
    const core = coreOf(name);
    const near = critique.skills.filter((s) => { const c = coreOf(s.name); return c === core || (core.length >= 6 && c.length >= 6 && (c.startsWith(core) || core.startsWith(c))); });
    return near.length === 1 ? near[0] : undefined;
  };
  const dropped: GateResult["dropped"] = [];
  const kept: (RoleFramework["skills"][number] & { relevance: number })[] = [];
  const seen = new Set<string>();
  for (const s of framework.skills) {
    const key = normalizeSkill(s.name);
    const r = reviewOf(s.name);
    if (seen.has(key)) { dropped.push({ name: s.name, reason: "duplicate" }); continue; }
    seen.add(key);
    if (isGenericSkill(s.name) || r?.isGeneralEmployability) { dropped.push({ name: s.name, reason: "general employability, assessed separately" }); continue; }
    if (!r) { dropped.push({ name: s.name, reason: "not reviewed" }); continue; }
    if (r.relevance <= 2) { dropped.push({ name: s.name, reason: `reviewer: not part of this role (${r.relevance}/5)${r.comment ? `: ${r.comment}` : ""}` }); continue; }
    if (!r.entryLevelAppropriate && s.tier !== "ADVANCED") { dropped.push({ name: s.name, reason: "not an entry-level expectation" }); continue; }
    kept.push({ ...s, relevance: r.relevance });
  }

  // too many CORE skills dilute the meaning of core: the least central extras become INDUSTRY skills
  const core = kept.filter((s) => s.tier === "CORE").sort((a, b) => b.relevance - a.relevance);
  for (const s of core.slice(MAX_CORE)) s.tier = "INDUSTRY";

  const reasons: string[] = [];
  const coreKept = kept.filter((s) => s.tier === "CORE").length;
  if (!critique.roleIdentityMatches) reasons.push("the reviewer says these skills describe a different role than the one named");
  if (critique.confidence < MIN_CONFIDENCE) reasons.push(`reviewer confidence ${critique.confidence.toFixed(2)} is below ${MIN_CONFIDENCE}`);
  if (kept.length < MIN_SKILLS) reasons.push(`only ${kept.length} relevant skills remain after review (need ${MIN_SKILLS})`);
  if (coreKept < MIN_CORE) reasons.push(`only ${coreKept} core skills remain (need ${MIN_CORE})`);
  if (dropped.length / Math.max(1, framework.skills.length) > MAX_DROPPED_SHARE) reasons.push(`${dropped.length} of ${framework.skills.length} proposed skills were rejected`);
  reasons.push(...critique.concerns.slice(0, 3));

  const ordered = [...kept].sort((a, b) => Object.keys(IMPORTANCE_OF_TIER).indexOf(a.tier) - Object.keys(IMPORTANCE_OF_TIER).indexOf(b.tier) || b.relevance - a.relevance);
  const importances = ordered.map((s) => IMPORTANCE_OF_TIER[s.tier]);
  const q = budgets(importances);
  const skills: GatedSkill[] = ordered.map((s, i) => ({
    name: s.name, tier: s.tier, category: s.category, description: s.description, rationale: s.rationale, assessmentType: s.assessmentType, relevance: s.relevance,
    importance: importances[i], assessmentWeight: WEIGHT[importances[i]], targetLevel: TARGET[importances[i]], minQuestions: q[i].min, maxQuestions: Math.max(q[i].max, q[i].min, 1),
  }));

  // concerns alone do not block a framework; the structural problems above do
  const blocking = reasons.slice(0, reasons.length - Math.min(3, critique.concerns.length));
  return {
    ok: blocking.length === 0, skills, dropped, reasons: blocking.length === 0 ? [] : reasons,
    competencyConfidence: Math.round(critique.confidence * (kept.length / Math.max(1, framework.skills.length)) * 100) / 100,
    missingCoreSkills: critique.missingCoreSkills,
  };
}

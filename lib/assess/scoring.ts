// Pure result maths. Three different things, never mixed:
//   skill graph  -> per-skill score + confidence            (what the student can do)
//   readiness    -> weighted alignment with a role's needs  (how close to the role)
//   ELO          -> a rating that lives in the DB ledger    (never computed here, never a percentage)

import type { Confidence } from "./config";
import { estimateSkill, type Obs } from "./engine";

// Proof ladder. A multiple-choice answer is SCREENING: it shows where to start, never that someone can do the work, so it can lift a
// skill to SCREEN_CAP and no further. Only practical evidence (a passed Arena task, verified proof of work) raises the ceiling, by
// PRACTICAL_STEP per difficulty-weighted task: 1 medium task allows 55, 2 allow 70, 3 allow 85 (the highest role target), 4 allow 100.
export const SCREEN_CAP = 40;
const PRACTICAL_STEP = 15;
const PRACTICAL_WEIGHT: Record<Obs["difficulty"], number> = { EASY: 0.5, MEDIUM: 1, HARD: 1.5 };
export const skillCap = (proof: number) => Math.min(100, SCREEN_CAP + PRACTICAL_STEP * proof);

/** An observation plus whether it came from real work (Arena / verified proof) rather than a screening question. */
export type SourcedObs = Obs & { practical?: boolean };
const proofWeight = (obs: readonly SourcedObs[]) => obs.reduce((a, o) => a + (o.practical && o.correct ? PRACTICAL_WEIGHT[o.difficulty] : 0), 0);

export interface RoleSkill {
  skillId: string;
  key: string;
  name: string;
  category: string | null;
  importance: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  targetLevel: number;
  weight: number;
}

export interface SkillResult extends RoleSkill {
  /** 0-100 proven level, already held under the ceiling its evidence earns (see skillCap); null when nothing measured it */
  score: number | null;
  confidence: Confidence;
  evidenceCount: number;
  /** difficulty-weighted count of passed practical tasks; 0 means screening evidence only */
  proof: number;
}

/** Every canonical skill of the role appears, with or without evidence: the radar is never partial. */
export function buildSkillResults(skills: readonly RoleSkill[], evidence: Readonly<Record<string, readonly SourcedObs[]>>): SkillResult[] {
  return skills.map((s) => {
    const obs = evidence[s.skillId] ?? [];
    const e = estimateSkill(obs);
    const proof = proofWeight(obs);
    return { ...s, score: e.score === null ? null : Math.min(e.score, skillCap(proof)), confidence: e.confidence, evidenceCount: e.n, proof };
  });
}

/**
 * Readiness 0-100 = sum(weight x attainment) / sum(weight) over EVERY skill the role needs, attainment being score / target capped
 * at 1. A skill nobody has measured counts as zero, not as "ignored", so a handful of answers can never look like a ready candidate;
 * critical skills carry more weight (via `weight`). Because scores are capped by proof (see skillCap), screening alone cannot pass
 * about half of what a role asks, and the rest has to be earned in Arena or verified work. `coverage` is the weighted share of the
 * role's skills that anything has measured, so the UI can say "based on N of M skills".
 */
export function computeReadiness(results: readonly SkillResult[]): { readiness: number; coverage: number } {
  let num = 0;
  let measured = 0;
  let totalWeight = 0;
  for (const r of results) {
    totalWeight += r.weight;
    if (r.score === null) continue;
    measured += r.weight;
    num += r.weight * Math.min(1, r.score / Math.max(1, r.targetLevel));
  }
  return {
    readiness: totalWeight === 0 ? 0 : Math.round((num / totalWeight) * 100),
    coverage: totalWeight === 0 ? 0 : Math.round((measured / totalWeight) * 100),
  };
}

export interface Highlights {
  strongest: SkillResult[];
  focusAreas: SkillResult[];
  notYetMeasured: SkillResult[];
}

export function highlights(results: readonly SkillResult[], take = 3): Highlights {
  const measured = results.filter((r) => r.score !== null);
  const gap = (r: SkillResult) => r.weight * Math.max(0, r.targetLevel - (r.score ?? 0));
  return {
    strongest: [...measured].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, take),
    focusAreas: [...measured].filter((r) => (r.score ?? 0) < r.targetLevel).sort((a, b) => gap(b) - gap(a)).slice(0, take),
    notYetMeasured: results.filter((r) => r.score === null),
  };
}

/** Encouraging, specific wording: development areas, never "you are bad at X". */
export function developmentPhrase(name: string): string {
  return `${name} is currently an area for development`;
}

export function nextBestAction(h: Highlights): string {
  const top = h.focusAreas[0];
  if (top) return `Start with ${top.name}: it is the biggest step toward your target role right now.`;
  const open = h.notYetMeasured[0];
  if (open) return `Try an Arena challenge on ${open.name} to add evidence for it.`;
  return "You are at or above target on every measured skill. Take on a harder Arena challenge to keep growing.";
}

// ------------------------------------------------------------------------------------------------------------------
// general diagnostic: per-section horizontal bars (never role-specific, never ELO)
// ------------------------------------------------------------------------------------------------------------------

export interface SectionBar {
  section: string;
  label: string;
  score: number | null;
  confidence: Confidence;
  correct: number;
  total: number;
}

export function buildSectionBars(sections: readonly { key: string; label: string }[], evidence: Readonly<Record<string, readonly Obs[]>>): SectionBar[] {
  return sections.map((s) => {
    const obs = evidence[s.key] ?? [];
    const e = estimateSkill(obs);
    return { section: s.key, label: s.label, score: e.score, confidence: e.confidence, correct: obs.filter((o) => o.correct).length, total: obs.length };
  });
}

// ------------------------------------------------------------------------------------------------------------------
// ELO session summary (from the ledger rows of one session)
// ------------------------------------------------------------------------------------------------------------------

export interface EloSummary {
  startingElo: number;
  answered: number;
  correct: number;
  incorrect: number;
  gained: number;
  lost: number;
  net: number;
  newElo: number;
}

export function summariseElo(startingElo: number, events: readonly { change: number }[]): EloSummary {
  const gained = events.filter((e) => e.change > 0).reduce((a, e) => a + e.change, 0);
  const lost = events.filter((e) => e.change < 0).reduce((a, e) => a + -e.change, 0);
  return {
    startingElo,
    answered: events.length,
    correct: events.filter((e) => e.change > 0).length,
    incorrect: events.filter((e) => e.change <= 0).length,
    gained,
    lost,
    net: gained - lost,
    newElo: startingElo + gained - lost,
  };
}

// Pure result maths. Three different things, never mixed:
//   skill graph  -> per-skill score + confidence            (what the student can do)
//   readiness    -> weighted alignment with a role's needs  (how close to the role)
//   ELO          -> a rating that lives in the DB ledger    (never computed here, never a percentage)

import { CONFIDENCE_FACTOR, type Confidence } from "./config";
import { estimateSkill, type Obs } from "./engine";

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
  score: number | null;
  confidence: Confidence;
  evidenceCount: number;
}

/** Every canonical skill of the role appears, with or without evidence: the radar is never partial. */
export function buildSkillResults(skills: readonly RoleSkill[], evidence: Readonly<Record<string, readonly Obs[]>>): SkillResult[] {
  return skills.map((s) => {
    const e = estimateSkill(evidence[s.skillId] ?? []);
    return { ...s, score: e.score, confidence: e.confidence, evidenceCount: e.n };
  });
}

/**
 * Readiness 0-100 = sum(weight x confidenceFactor x attainment) / sum(weight x confidenceFactor), attainment being
 * score / target capped at 1. Critical skills carry more weight (via `weight`), and a skill we are only weakly sure about
 * counts for less in BOTH numerator and denominator, so a lucky guess cannot swing it. `coverage` says how much of the
 * role's weighted skill set was actually measured, so the UI can say "based on N of M skills".
 */
export function computeReadiness(results: readonly SkillResult[]): { readiness: number; coverage: number } {
  let num = 0;
  let den = 0;
  let totalWeight = 0;
  for (const r of results) {
    totalWeight += r.weight;
    if (r.score === null) continue;
    const c = r.weight * CONFIDENCE_FACTOR[r.confidence];
    num += c * Math.min(1, r.score / Math.max(1, r.targetLevel));
    den += c;
  }
  return {
    readiness: den === 0 ? 0 : Math.round((num / den) * 100),
    coverage: totalWeight === 0 ? 0 : Math.round((results.filter((r) => r.score !== null).reduce((a, r) => a + r.weight, 0) / totalWeight) * 100),
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

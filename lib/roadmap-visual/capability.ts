/**
 * Capability per skill, v2. One explainable model; every number below can be shown to the student with the evidence that produced it.
 *
 *   weight(item)  = verification × recency × difficulty
 *     verification: 1 for verified evidence, 0.25 for a self-declared claim (whose level is also capped at 40)
 *     recency:      0.5 ^ (age / half-life of its kind), never below 0.25; an undated item counts as 0.5 and is flagged
 *     difficulty:   easy 0.8, medium 1, hard 1.2 (1 when unknown)
 *
 *   snapshotLevel = Σ weight × level / Σ weight        over assessments, projects, certifications, course performance, mentor evaluations, ...
 *   practiceLevel = Σ 3 × recency × difficulty          over verified Arena passes (each fresh medium pass is worth 3 points)
 *   ceiling       = min(90, 3 × Σ weight of VERIFIED evidence): depth. One proof cannot show a skill; about 30 recent medium proofs reach 90.
 *   level         = min(ceiling, the higher of the two that exist), or a self-declared level (at most 40); NULL when there is no evidence at all
 *   100           = reserved for a verified interview with a live challenge. Until that exists nothing shows above 90.
 *   Learning a lesson is not proof: learning-module items carry no weight.
 *   confidence    = (1 − e^(−0.8 × Σ weight)) × (0.85 + 0.15 × min(1, (distinct verified kinds − 1) / 2)), at most 0.95;
 *                   a self-declared-only skill has at most 0.2
 */
import type { EvidenceKind } from "@/lib/capability/read-model";

export const FORMULA_VERSION = "capability.v3";
export const SELF_DECLARED_CAP = 40;
export const SELF_DECLARED_WEIGHT = 0.25;
/** Proofs for a full all-round skill, and the points each is worth (3 x 30 = 90). The last 10 are for the verified interview with a live challenge. */
export const MASTERY_PROOFS = 30;
export const MAX_WITHOUT_INTERVIEW = 90;
export const POINTS_PER_PROOF = MAX_WITHOUT_INTERVIEW / MASTERY_PROOFS;
export const ARENA_POINTS_PER_PASS = POINTS_PER_PROOF;
const MIN_RECENCY = 0.25;
const UNDATED_RECENCY = 0.5;
const CONFIDENCE_RATE = 0.8;

export const HALF_LIFE_DAYS: Record<EvidenceKind, number> = {
  ARENA: 120,
  ASSESSMENT: 180,
  LEARNING_MODULE: 180,
  GITHUB: 180,
  PROJECT: 365,
  COURSE_PERFORMANCE: 365,
  MENTOR_EVALUATION: 365,
  CERTIFICATION: 730,
  SELF_DECLARED: 90,
};
export const DIFFICULTY_WEIGHT = { easy: 0.8, medium: 1, hard: 1.2 } as const;
export type Difficulty = keyof typeof DIFFICULTY_WEIGHT;

export interface EvidenceInput {
  kind: EvidenceKind;
  /** 0-100 for snapshot-style evidence; unused for ARENA passes (each pass is worth a fixed amount) */
  level?: number | null;
  observedAt: Date | null;
  difficulty?: Difficulty | null;
  /** short human description: where this came from */
  label: string;
  /** the raw score the source reported, when it has one */
  rawScore?: number | null;
  link?: string | null;
}

export interface EvidenceLine {
  kind: EvidenceKind;
  label: string;
  observedAt: string | null;
  rawScore: number | null;
  link: string | null;
  verified: boolean;
  /** this line's own level contribution: the item's level (snapshot kinds) or the points a pass adds (Arena) */
  contribution: number;
  weight: number;
  components: { verification: number; recency: number; difficulty: number };
  undated: boolean;
}

export interface SkillScore {
  /** null = nothing has been assessed. Never 0 for "unknown". */
  level: number | null;
  confidence: number;
  /** at least one verified evidence item backs this */
  verified: boolean;
  verifiedLevel: number | null;
  selfDeclaredLevel: number | null;
  evidenceCount: number;
  lines: EvidenceLine[];
  breakdown: Partial<Record<EvidenceKind, number>>;
  formula: { snapshotLevel: number | null; practiceLevel: number | null; totalWeight: number; verifiedKinds: number; version: typeof FORMULA_VERSION };
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function recencyFactor(kind: EvidenceKind, observedAt: Date | null, now: Date): { value: number; undated: boolean } {
  if (!observedAt) return { value: UNDATED_RECENCY, undated: true };
  const ageDays = Math.max(0, (now.getTime() - observedAt.getTime()) / 86_400_000);
  return { value: Math.max(MIN_RECENCY, Math.pow(0.5, ageDays / HALF_LIFE_DAYS[kind])), undated: false };
}

function lineFor(item: EvidenceInput, now: Date): EvidenceLine {
  const verified = item.kind !== "SELF_DECLARED";
  const { value: recency, undated } = recencyFactor(item.kind, item.observedAt, now);
  const difficulty = item.difficulty ? DIFFICULTY_WEIGHT[item.difficulty] : 1;
  const verification = verified ? 1 : SELF_DECLARED_WEIGHT;
  const isPractice = item.kind === "ARENA";
  const contribution = isPractice ? ARENA_POINTS_PER_PASS * recency * difficulty : verified ? clamp(item.level ?? 0) : Math.min(SELF_DECLARED_CAP, clamp(item.level ?? 0));
  return {
    kind: item.kind, label: item.label, observedAt: item.observedAt ? item.observedAt.toISOString() : null, rawScore: item.rawScore ?? null, link: item.link ?? null,
    verified, contribution: round1(contribution), weight: verification * recency * difficulty, components: { verification, recency: round1(recency * 100) / 100, difficulty }, undated,
  };
}

/** Pure. How deep the verified evidence is: 3 points for each fresh, medium proof, never above 90. One proof, or a few, can never show a whole skill. */
export const proofCeiling = (verifiedWeight: number): number => Math.min(MAX_WITHOUT_INTERVIEW, POINTS_PER_PROOF * Math.max(0, verifiedWeight));

function levelOf(lines: EvidenceLine[]): { level: number | null; snapshot: number | null; practice: number | null } {
  const snap = lines.filter((l) => l.kind !== "ARENA");
  const practice = lines.filter((l) => l.kind === "ARENA");
  const w = snap.reduce((n, l) => n + l.weight, 0);
  const snapshot = snap.length && w > 0 ? snap.reduce((n, l) => n + l.weight * l.contribution, 0) / w : null;
  const practiceLevel = practice.length ? Math.min(MAX_WITHOUT_INTERVIEW, practice.reduce((n, l) => n + l.contribution, 0)) : null;
  const parts = [snapshot, practiceLevel].filter((v): v is number => v !== null);
  // depth caps what verified evidence can show; a self-declared claim has its own cap and is not capped by depth
  const verified = lines.filter((l) => l.verified);
  const ceiling = proofCeiling(verified.reduce((n, l) => n + l.weight, 0));
  const raw = parts.length ? Math.max(...parts) : null;
  const level = raw === null ? null : verified.length ? Math.min(raw, ceiling) : raw;
  return { level: level === null ? null : Math.round(level), snapshot: snapshot === null ? null : round1(snapshot), practice: practiceLevel === null ? null : round1(practiceLevel) };
}

/** Pure. Scores one skill from its evidence. No evidence -> level null. */
export function scoreSkill(items: EvidenceInput[], now: Date = new Date()): SkillScore {
  // having learned something is not proof of it: learning-module items never count
  const lines = items.filter((i) => i.kind !== "LEARNING_MODULE").map((i) => lineFor(i, now)).sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? ""));
  const all = levelOf(lines);
  const verifiedLines = lines.filter((l) => l.verified);
  const verifiedLevel = verifiedLines.length ? levelOf(verifiedLines).level : null;
  const selfLines = lines.filter((l) => !l.verified);
  const selfDeclaredLevel = selfLines.length ? Math.round(Math.min(SELF_DECLARED_CAP, selfLines.reduce((n, l) => n + l.contribution, 0) / selfLines.length)) : null;

  const totalWeight = lines.reduce((n, l) => n + l.weight, 0);
  const verifiedKinds = new Set(verifiedLines.map((l) => l.kind)).size;
  const base = 1 - Math.exp(-CONFIDENCE_RATE * totalWeight);
  const confidence = lines.length === 0 ? 0 : verifiedLines.length ? Math.min(0.95, base * (0.85 + 0.15 * Math.min(1, (verifiedKinds - 1) / 2))) : Math.min(0.2, base * 0.4);

  const breakdown: Partial<Record<EvidenceKind, number>> = {};
  for (const l of lines) breakdown[l.kind] = (breakdown[l.kind] ?? 0) + 1;
  return {
    level: all.level,
    confidence: Math.round(confidence * 100) / 100,
    verified: verifiedLines.length > 0,
    verifiedLevel,
    selfDeclaredLevel,
    evidenceCount: lines.length,
    lines,
    breakdown,
    formula: { snapshotLevel: all.snapshot, practiceLevel: all.practice, totalWeight: round1(totalWeight * 100) / 100, verifiedKinds, version: FORMULA_VERSION },
  };
}

/** The formula in plain words, for the "Why this score" panel (kept next to the code that implements it). */
export const FORMULA_TEXT =
  "Each piece of evidence counts in proportion to how verified it is, how recent it is and how hard it was. " +
  "Assessments, projects and similar results are averaged by that weight; Arena passes add up (each recent medium pass is worth 3 points). " +
  "Your level is the higher of the two, but never more than the depth of your proof allows: about 30 recent proofs reach 90, and 100 is for a verified interview with a live challenge. " +
  "Learning a lesson is not proof. A self-declared claim counts for a quarter and never shows above 40. With no evidence there is no level.";

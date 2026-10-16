import type { EvidenceKind } from "@/lib/capability/read-model";
import { levelLabel } from "@/lib/capability/matrix";
import { ARENA_POINTS_PER_PASS, type EvidenceLine } from "@/lib/roadmap-visual/capability";

/**
 * A badge is recognition of demonstrated work, never of a quiz answer or a claim. The initial assessment gives a baseline (where you start) and
 * can never earn a badge; only evidence of doing the work can: a verified Arena task, a project, GitHub activity or a mentor's evaluation.
 */
export const BADGE_LEVELS = ["Foundation", "Proficient", "Advanced"] as const;
export type BadgeLevel = (typeof BADGE_LEVELS)[number];

/** Evidence that shows the work was done. Assessments, courses, certificates and self-declared skills describe knowledge, so they set a baseline but earn nothing. */
export const PRACTICAL_KINDS: ReadonlySet<EvidenceKind> = new Set<EvidenceKind>(["ARENA", "PROJECT", "GITHUB", "MENTOR_EVALUATION"]);

/**
 * Practice level (0-100) needed for each badge, and how many pieces of work must back it. A medium Arena task is worth 25 (easy 20, hard 30), so two
 * medium tasks make a Proficient badge. A badge is an achievement and does not fade: it is scored on the work as done, not as aged by capability.v2's
 * recency decay (how recent the work is shows separately, as `lastWorkAt`).
 */
export const BADGE_RULES: Record<BadgeLevel, { from: number; items: number }> = {
  Foundation: { from: 20, items: 1 },
  Proficient: { from: 50, items: 2 },
  Advanced: { from: 75, items: 3 },
};

/** Pure. The level of a set of evidence lines without ageing: Arena tasks add up by difficulty, other evidence is averaged, and the higher counts. */
export function levelOfLines(lines: readonly EvidenceLine[]): number | null {
  const arena = lines.filter((l) => l.kind === "ARENA");
  const rest = lines.filter((l) => l.kind !== "ARENA");
  const parts: number[] = [];
  if (arena.length) parts.push(Math.min(100, arena.reduce((s, l) => s + ARENA_POINTS_PER_PASS * l.components.difficulty, 0)));
  if (rest.length) parts.push(rest.reduce((s, l) => s + l.contribution, 0) / rest.length);
  return parts.length ? Math.round(Math.max(...parts)) : null;
}

export function badgeLevelFor(level: number | null, items: number): BadgeLevel | null {
  if (level === null) return null;
  return [...BADGE_LEVELS].reverse().find((b) => level >= BADGE_RULES[b].from && items >= BADGE_RULES[b].items) ?? null;
}

export interface BadgeEvidence {
  kind: EvidenceKind;
  label: string;
  observedAt: string | null;
  score: number | null;
  link: string | null;
}
export interface Badge {
  skillId: string;
  name: string;
  level: BadgeLevel;
  /** backed by a single piece of work so far */
  provisional: boolean;
  /** pieces of demonstrated work behind the badge */
  evidenceCount: number;
  /** when the current level was first reached; null when the evidence is undated */
  earnedAt: string | null;
  /** when each level was first reached, so a badge shows how it grew */
  levelDates: Partial<Record<BadgeLevel, string | null>>;
  evidence: BadgeEvidence[];
}
export interface PassportSkill {
  skillId: string;
  name: string;
  badge: Badge | null;
  /** earned: a badge. practising: work exists but not enough yet. baseline: only the assessment has measured it. not-assessed: nothing yet. */
  status: "earned" | "practising" | "baseline" | "not-assessed";
  /** how many pieces of demonstrated work exist */
  practiceCount: number;
  practiceLevel: number | null;
  /** where the assessment started this skill (never a badge) */
  baselineLevel: number | null;
  baselineLabel: string | null;
  evidence: BadgeEvidence[];
  /** the most recent piece of demonstrated work; the badge stays, but old work is a reason to do a new task */
  lastWorkAt: string | null;
  /** what the next badge needs, in numbers */
  next: { level: BadgeLevel; moreItems: number; morePoints: number } | null;
}

export interface SkillInput {
  skillId: string;
  name: string;
  lines: readonly EvidenceLine[];
}

const toEvidence = (l: EvidenceLine): BadgeEvidence => ({ kind: l.kind, label: l.label, observedAt: l.observedAt, score: l.rawScore, link: l.link });
const byDate = (a: EvidenceLine, b: EvidenceLine) => (a.observedAt ?? "9999").localeCompare(b.observedAt ?? "9999");

/** Pure. When each level was first reached: replay the work in date order and note the line that tipped each level. */
export function levelDates(practical: readonly EvidenceLine[]): Partial<Record<BadgeLevel, string | null>> {
  const dates: Partial<Record<BadgeLevel, string | null>> = {};
  const sorted = [...practical].sort(byDate);
  sorted.forEach((line, i) => {
    const reached = badgeLevelFor(levelOfLines(sorted.slice(0, i + 1)), i + 1);
    if (!reached) return;
    for (const b of BADGE_LEVELS) if (BADGE_LEVELS.indexOf(b) <= BADGE_LEVELS.indexOf(reached) && !(b in dates)) dates[b] = line.observedAt;
  });
  return dates;
}

export function passportSkill(s: SkillInput): PassportSkill {
  const practical = s.lines.filter((l) => PRACTICAL_KINDS.has(l.kind));
  const baselineLines = s.lines.filter((l) => !PRACTICAL_KINDS.has(l.kind));
  const practiceLevel = levelOfLines(practical);
  const baselineLevel = levelOfLines(baselineLines);
  const level = badgeLevelFor(practiceLevel, practical.length);
  const evidence = [...s.lines].sort((a, b) => byDate(b, a)).map(toEvidence);
  const lastWorkAt = practical.map((l) => l.observedAt).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
  const base = { skillId: s.skillId, name: s.name, practiceCount: practical.length, practiceLevel, baselineLevel, baselineLabel: baselineLevel === null ? null : levelLabel(baselineLevel), evidence, lastWorkAt };

  const above = level ? BADGE_LEVELS[BADGE_LEVELS.indexOf(level) + 1] : BADGE_LEVELS[0];
  const next = above ? { level: above, moreItems: Math.max(0, BADGE_RULES[above].items - practical.length), morePoints: Math.max(0, BADGE_RULES[above].from - (practiceLevel ?? 0)) } : null;

  if (level) {
    const dates = levelDates(practical);
    return { ...base, status: "earned", next, badge: { skillId: s.skillId, name: s.name, level, provisional: practical.length < 2, evidenceCount: practical.length, earnedAt: dates[level] ?? null, levelDates: dates, evidence: practical.sort(byDate).reverse().map(toEvidence) } };
  }
  return { ...base, badge: null, next, status: practical.length > 0 ? "practising" : baselineLevel !== null ? "baseline" : "not-assessed" };
}

const RANK: Record<PassportSkill["status"], number> = { earned: 3, practising: 2, baseline: 1, "not-assessed": 0 };

export function passportSkills(skills: readonly SkillInput[]): PassportSkill[] {
  const rank = (s: PassportSkill) => RANK[s.status] * 10 + (s.badge ? BADGE_LEVELS.indexOf(s.badge.level) : 0);
  return skills.map(passportSkill).sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name));
}

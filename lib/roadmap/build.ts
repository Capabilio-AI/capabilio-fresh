/**
 * Curriculum roadmap gap analysis — PURE. No database, no AI: every item is derived from stored data
 * (confirmed curriculum mapping, verified Arena counts, the role's target profile, the curated
 * resource list). See docs/curriculum-roadmap-audit.md, Phase 2.
 */
export interface RoadmapArea {
  key: string;
  name: string;
  enabled: boolean;
}
export interface RoadmapSubject {
  id: string;
  name: string;
  year: number;
  /** Skill areas the admin CONFIRMED for this subject. */
  areaKeys: string[];
}
export interface RoadmapResource {
  areaKey: string;
  kind: "project" | "certification" | "practice";
  title: string;
  url: string | null;
  description: string | null;
}
export interface RoadmapInput {
  role: { key: string; name: string } | null;
  /** In display order. */
  areas: RoadmapArea[];
  targets: { areaKey: string; minVerified: number }[];
  verified: Record<string, number>;
  /** Confirmed current year of study; null when unset or not yet confirmed by the student. */
  academicYear: number | null;
  /** All of the student's institution + branch subjects, any year. */
  subjects: RoadmapSubject[];
  resources: RoadmapResource[];
}

export type NeedsInfoReason =
  | "no_role"
  | "no_target_profile"
  | "year_unknown"
  | "no_curriculum"
  | "no_curriculum_for_year"
  | "no_confirmed_mapping";

export type Timing = "past" | "this_year" | "next_year";

export interface RoadmapItem {
  areaKey: string;
  areaName: string;
  verifiedCount: number;
  minVerified: number;
  covering: { name: string; year: number; timing: Timing }[];
  /** Demonstrated but no subject covers it: the student got here on their own. */
  beyondCurriculum: boolean;
  /** Deterministic Arena focus: verified tasks still needed (0 when demonstrated). */
  arenaTasksRemaining: number;
  /** Curated, stored suggestions — only ever populated for external gaps. */
  resources: RoadmapResource[];
}

export type Roadmap =
  | { status: "needs_info"; reasons: NeedsInfoReason[] }
  | { status: "ready"; roleName: string; academicYear: number; affirm: RoadmapItem[]; engage: RoadmapItem[]; external: RoadmapItem[] };

const timingOf = (subjectYear: number, current: number): Timing | null =>
  subjectYear < current ? "past" : subjectYear === current ? "this_year" : subjectYear === current + 1 ? "next_year" : null;

export function buildRoadmap(input: RoadmapInput): Roadmap {
  if (!input.role) return { status: "needs_info", reasons: ["no_role"] };

  const targetByArea = new Map(input.targets.map((t) => [t.areaKey, t.minVerified]));
  const targeted = input.areas.filter((a) => a.enabled && targetByArea.has(a.key));

  const reasons: NeedsInfoReason[] = [];
  if (targeted.length === 0) reasons.push("no_target_profile");
  if (input.academicYear == null) reasons.push("year_unknown");
  if (input.subjects.length === 0) reasons.push("no_curriculum");
  else if (input.academicYear != null) {
    const slice = input.subjects.filter((s) => timingOf(s.year, input.academicYear!) !== null);
    // Only past years uploaded: we cannot claim what this or next year covers, so we cannot claim gaps.
    if (!slice.some((s) => s.year >= input.academicYear!)) reasons.push("no_curriculum_for_year");
    else if (!slice.some((s) => s.areaKeys.length > 0)) reasons.push("no_confirmed_mapping");
  }
  if (reasons.length > 0 || input.academicYear == null) return { status: "needs_info", reasons };

  const year = input.academicYear;
  const affirm: RoadmapItem[] = [];
  const engage: RoadmapItem[] = [];
  const external: RoadmapItem[] = [];

  for (const area of targeted) {
    const min = targetByArea.get(area.key)!;
    const count = input.verified[area.key] ?? 0;
    const demonstrated = count >= min;
    const covering = input.subjects
      .filter((s) => s.areaKeys.includes(area.key))
      .flatMap((s) => {
        const timing = timingOf(s.year, year);
        return timing ? [{ name: s.name, year: s.year, timing }] : [];
      })
      .sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
    const covered = covering.length > 0;
    const item: RoadmapItem = {
      areaKey: area.key,
      areaName: area.name,
      verifiedCount: count,
      minVerified: min,
      covering,
      beyondCurriculum: demonstrated && !covered,
      arenaTasksRemaining: Math.max(0, min - count),
      resources: [],
    };
    if (demonstrated) affirm.push(item);
    else if (covered) engage.push(item);
    else external.push({ ...item, resources: input.resources.filter((r) => r.areaKey === area.key) });
  }
  return { status: "ready", roleName: input.role.name, academicYear: year, affirm, engage, external };
}

import { createHash } from "node:crypto";

/** JSON with object keys sorted at every level, so equal inputs always serialise (and hash) identically. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

export const hashSnapshot = (snapshot: unknown): string => createHash("sha256").update(stableStringify(snapshot)).digest("hex");

export type Trigger = "CAREER_CHANGE" | "CURRICULUM_PUBLISHED" | "PROGRESS_UPDATE" | "MANUAL";

/** Why a new version exists, from how its inputs differ from the previous version's (null = the first version for this career). */
export function inferTrigger(prev: { curriculumVersionId?: string | null } | null, next: { curriculumVersionId?: string | null }, requested?: "MANUAL"): Trigger {
  if (requested === "MANUAL") return "MANUAL";
  if (!prev) return "CAREER_CHANGE";
  if ((prev.curriculumVersionId ?? null) !== (next.curriculumVersionId ?? null)) return "CURRICULUM_PUBLISHED";
  return "PROGRESS_UPDATE";
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const sorted = <T,>(xs: T[]) => [...xs].sort();

/**
 * The same input with every list in a canonical order. Postgres returns rows in no promised order, so without this two identical loads could
 * hash differently (and create spurious roadmap versions). Content is untouched; only the order of lists changes.
 */
export function canonicalInput<T extends {
  requirements: { skillId: string }[];
  courses: { id: string; skills: { skillId: string }[]; prerequisiteCourseIds: string[] }[];
  catalogs: {
    learning: { id: string; skillIds: string[]; prerequisites: string[] }[];
    certifications: { id: string; skillIds: string[]; careers: { careerId: string }[] }[];
    projects: { id: string; skillIds: string[]; expectedEvidence: string[] }[];
    arena: { id: string; skillIds: string[] }[];
  };
}>(input: T): T {
  return {
    ...input,
    requirements: [...input.requirements].sort((a, b) => (a.skillId < b.skillId ? -1 : 1)),
    courses: [...input.courses].sort(byId).map((c) => ({ ...c, skills: [...c.skills].sort((a, b) => (a.skillId < b.skillId ? -1 : 1)), prerequisiteCourseIds: sorted(c.prerequisiteCourseIds) })),
    catalogs: {
      learning: [...input.catalogs.learning].sort(byId).map((l) => ({ ...l, skillIds: sorted(l.skillIds) })),
      certifications: [...input.catalogs.certifications].sort(byId).map((c) => ({ ...c, skillIds: sorted(c.skillIds), careers: [...c.careers].sort((a, b) => (a.careerId < b.careerId ? -1 : 1)) })),
      projects: [...input.catalogs.projects].sort(byId).map((p) => ({ ...p, skillIds: sorted(p.skillIds) })),
      arena: [...input.catalogs.arena].sort(byId).map((a) => ({ ...a, skillIds: sorted(a.skillIds) })),
    },
  };
}

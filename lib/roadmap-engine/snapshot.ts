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

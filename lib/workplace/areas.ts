import { levelAtLeast, type ExperienceLevel } from "./level";

/** Skill areas that suit only people with some experience. Any area not listed is for everyone. */
export const AREA_MIN_LEVEL: Readonly<Record<string, ExperienceLevel>> = { investigation: "junior", incident: "mid", "pipeline-debugging": "junior" };

/**
 * When the daily rotation starts serving an area. Investigation and incidents also have guided, entry-level tickets (one clear lead, the way to split the
 * data is named), so a fresher gets them too; the full versions stay behind the levels in AREA_MIN_LEVEL because ticket selection filters by level.
 */
export const ROTATION_MIN_LEVEL: Readonly<Record<string, ExperienceLevel>> = { "pipeline-debugging": "junior" };

/**
 * The areas a user of this experience level is served from. Only if that would leave nothing at all are they all kept, so a role can never run
 * out of tickets. A held-back area joins the rotation when the user reaches its level.
 */
export function areasForLevel(areaKeys: readonly string[], level: ExperienceLevel): string[] {
  const suited = areaKeys.filter((k) => levelAtLeast(level, ROTATION_MIN_LEVEL[k] ?? "fresher"));
  return suited.length > 0 ? suited : [...areaKeys];
}

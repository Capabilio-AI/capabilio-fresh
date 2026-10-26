import type { Difficulty } from "@/lib/arena-workstations/types";
import type { ExperienceLevel } from "../level";
import type { Rng } from "../rng";
import { templateTiers } from "../tickets/pick";
import { PROCESS_TEMPLATES } from "./process-templates";
import { REQUIREMENT_TEMPLATES } from "./requirement-templates";
import type { BusinessDocsTemplate } from "./types";

export const BUSINESS_DOCS_TEMPLATES: readonly BusinessDocsTemplate[] = [...REQUIREMENT_TEMPLATES, ...PROCESS_TEMPLATES];

/**
 * A ticket of the requested area only, best fit for difficulty and level first (same widening as every other tool). Titles the user
 * already had are skipped while others remain. Null when the area has no business-docs ticket at all.
 */
export function pickDocsTemplate(input: { areaKey: string; difficulty: Difficulty; level: ExperienceLevel; rng: Rng; avoidTitles: readonly string[] }): BusinessDocsTemplate | null {
  const seen = new Set(input.avoidTitles.map((t) => t.trim().toLowerCase()));
  const tiers = templateTiers(BUSINESS_DOCS_TEMPLATES, input);
  for (const tier of tiers) {
    const fresh = tier.filter((t) => !seen.has(t.title.toLowerCase()));
    if (fresh.length) return input.rng.pick(fresh);
  }
  // ponytail: every ticket of this area was already served; repeating one beats serving nothing (only 2 per area so far)
  return tiers.length ? input.rng.pick(tiers[tiers.length - 1]) : null;
}

/**
 * Roles outside software and data. The skill catalog is mostly IT, so a model asked to design one of these roadmaps from the full list borrows IT
 * skills (Git, statistics, embedded testing) to fill the gaps. For these roles the IT categories are hidden from the model's skill list, and the
 * current roadmap is not offered as a starting point. The relevance review still checks every roadmap, listed here or not.
 */
export const DOMAIN_ONLY_CAREER_KEYS: ReadonlySet<string> = new Set([
  "mechanical-design-engineer", "ai-mechanical-engineer", "ai-civil-engineer", "site-engineer", "ai-electrical-engineer",
  "ai-automotive-engineer", "plc-automation-engineer", "ai-rf-design-engineer", "ai-operations-executive",
]);

const IT_SKILL_CATEGORIES: ReadonlySet<string> = new Set(["AI/ML", "Cloud", "Cybersecurity", "Computer Systems", "Data", "Databases", "DevOps", "Programming", "Software Engineering"]);

export const isDomainOnly = (careerKey: string): boolean => DOMAIN_ONLY_CAREER_KEYS.has(careerKey);

const MIN_PROFILE_SKILLS = 5;
const NON_IT_SHARE = 0.7;

/**
 * Pure. Is this a non-IT role, judged from its own skill profile's categories? A role built on demand for a new title (a textile or a chemical engineer)
 * is not on the list above, but its profile shows what field it is in. Too few skills to judge means "not known", so the full list is used.
 */
export function profileIsNonIt(categories: readonly (string | null)[]): boolean {
  if (categories.length < MIN_PROFILE_SKILLS) return false;
  return categories.filter((c) => !IT_SKILL_CATEGORIES.has(c ?? "")).length / categories.length >= NON_IT_SHARE;
}

/** Pure. The skills the model may see for this role: everything, except the IT categories for a domain-only role. */
export function skillsForPrompt<T extends { category: string | null }>(careerKey: string, skills: readonly T[], nonIt = false): T[] {
  return nonIt || isDomainOnly(careerKey) ? skills.filter((s) => !IT_SKILL_CATEGORIES.has(s.category ?? "")) : [...skills];
}

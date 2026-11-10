import type { MarketSnapshot } from "@/lib/market/snapshot";
import { MAX_TOPICS, MIN_TOPICS } from "./normalize";

export interface PromptCareer {
  name: string;
  description: string | null;
  category: string | null;
}

/** "Category: skill, skill, ..." lines: the whole active taxonomy in a compact form the model must choose from. */
export function skillCatalogText(skills: { name: string; category: string | null }[]): string {
  const by = new Map<string, string[]>();
  for (const s of skills) by.set(s.category ?? "Other", [...(by.get(s.category ?? "Other") ?? []), s.name]);
  return [...by].sort(([a], [b]) => a.localeCompare(b)).map(([c, names]) => `${c}: ${names.sort().join("; ")}`).join("\n");
}

export const ROADMAP_SYSTEM = `You design career roadmaps for engineering students in India for a skills-evidence platform. You answer only by calling the provided tool.
A roadmap is a tree: SPINE nodes are stages in order, GROUP nodes are topic areas under a stage, TOPIC nodes are single skills a student can be assessed on.`;

export type DemandTier = "CORE" | "RECOMMENDED" | "OPTIONAL";

/**
 * Pure. How much employers want a skill, judged against the most requested skill for the role rather than against 100%: job boards only give a
 * short snippet of each posting, so even the one skill every posting needs shows up in a minority of them.
 */
export function demandTier(share: number, topShare: number): DemandTier {
  if (share >= 0.5 * topShare || share >= 0.15) return "CORE";
  if (share >= 0.2 * topShare || share >= 0.05) return "RECOMMENDED";
  return "OPTIONAL";
}

/** Pure. The live-postings evidence as a prompt block, or nothing when there is none. Only skills seen often enough to mean something are listed. */
export function marketBlock(market: MarketSnapshot | null | undefined): string[] {
  if (!market || market.sampled < 10) return [];
  const seen = market.topSkills.filter((s) => s.postings >= 2).slice(0, 60);
  if (seen.length === 0) return [];
  const top = seen[0].share;
  return [
    "",
    `LIVE MARKET EVIDENCE: ${market.sampled} current job postings in India for this role. For each skill: the share of postings that mention it (only the short posting text is searched, so real demand is higher) and how much employers want it:`,
    seen.map((s) => `${s.name}: ${Math.round(s.share * 100)}% of postings, ${demandTier(s.share, top)}`).join("\n"),
    "Use the demand label as the topic's importance. A skill that is not listed can still belong if the role clearly needs it. A skill must still be a name from the SKILL LIST below, or be added through newSkills.",
  ];
}

export function roadmapPrompt(input: { career: PromptCareer; skills: { name: string; category: string | null }[]; keepTopics?: string[]; feedback?: string[]; market?: MarketSnapshot | null }): string {
  const { career, skills, keepTopics, feedback, market } = input;
  return [
    `Design the roadmap for the career "${career.name}"${career.description ? `: ${career.description}` : ""}.`,
    "",
    "RULES",
    `- Base the skills on what employers in India actually ask for in job postings for this exact role today, not on a generic syllabus. Include EVERY skill a person genuinely needs to be hired into it, and nothing as filler: the number of TOPIC nodes is set by the role itself (between ${MIN_TOPICS} and ${MAX_TOPICS}; a focused role may need about ${MIN_TOPICS + 6}, a broad one 40 or more). Do not pad to a round number and do not cut real requirements to stay short.`,
    '- Group them under GROUP nodes (as many as the role has distinct areas, normally 5-12), across 3-4 SPINE stages (FOUNDATION, CORE, SPECIALIZATION, JOB_READY), ordered by "order" starting at 1.',
    "- importance reflects demand: CORE for skills that postings for this role require most, RECOMMENDED for ones many postings list or that clearly lift a candidate, OPTIONAL for occasional or differentiating ones. Include the tools and technologies postings name (for example the specific software), not just topics, and the soft skills the role really screens for.",
    "- SPINE: parent null, side CENTER. GROUP: parent is a SPINE, side LEFT or RIGHT (alternate). TOPIC: parent is a GROUP, same side as its group, never under another topic.",
    "- Every TOPIC has `skill` = EXACTLY one name from the skill list below, or from newSkills. One topic per skill. Never invent a topic without a skill.",
    "- Use an existing skill whenever one fits. Only when none does, add it to newSkills (name, parent, description). `parent` must be the exact name of an existing skill from the list, `name` must be specific (under 60 characters) and not a synonym of an existing skill.",
    "- target is a whole number 0-100: the level a job-ready person should reach (about 50-70 for foundations, 65-85 for core and specialization). importance is CORE, RECOMMENDED or OPTIONAL.",
    "- Each node's `stage` is the stage of its spine. Prerequisite edges (type PREREQUISITE) go only from a topic to a later topic in the same or a later stage; they must not form cycles. Add edges only where one skill truly requires another.",
    "- Descriptions: one plain sentence (under 200 characters) saying what the student learns. No marketing language.",
    "- Node keys: lowercase letters, digits and dashes only.",
    "",
    ...marketBlock(market),
    "",
    "SKILL LIST (the only valid existing skill names)",
    skillCatalogText(skills),
    ...(keepTopics?.length ? ["", "THE CURRENT ROADMAP covers these skills. Keep the ones that are still relevant so students' progress carries over, and add or drop only what the field has changed:", keepTopics.join("; ")] : []),
    ...(feedback?.length ? ["", "YOUR PREVIOUS ANSWER WAS REJECTED. Fix every problem below and answer again in full:", ...feedback.map((f) => `- ${f}`)] : []),
  ].join("\n");
}

export const EXTRAS_SYSTEM = `You recommend portfolio projects and professional certifications for engineering students in India. You answer only by calling the provided tool.
Only recommend certifications you are certain exist, from the real provider, with the provider's real official URL. If you are not certain, leave it out: every link is machine-checked and unverifiable ones are dropped.`;

/** Pure. How many projects and certifications a roadmap of this size deserves: more skills, more to build and more to earn. */
export function extrasTargets(skillCount: number): { projects: [number, number]; certifications: [number, number] } {
  const projects = Math.min(14, Math.max(6, Math.ceil(skillCount / 3)));
  const certifications = Math.min(8, Math.max(4, Math.ceil(skillCount / 6)));
  return { projects: [projects, projects + 2], certifications: [certifications, certifications + 2] };
}

export function extrasPrompt(input: { career: PromptCareer; skillNames: string[] }): string {
  const t = extrasTargets(input.skillNames.length);
  return [
    `Career: "${input.career.name}".`,
    "",
    "RULES",
    `- ${t.projects[0]} to ${t.projects[1]} projects, ordered from beginner to advanced, the last one a capstone that a hiring manager for this role would respect. Each is an original brief a student can build alone: title, difficulty, a description of what to build (2-3 sentences, using the tools employers expect for this role), 2-5 \`evidence\` items (concrete things a reviewer can check, like a repository, a deployed link, a test report, or drawings and photos for physical work), and 2-6 \`skills\`.`,
    `- ${t.certifications[0]} to ${t.certifications[1]} certifications that employers in India recognise for this career: exact official name, provider, the official https URL of that certification's own page (not a homepage), difficulty, and 1-5 \`skills\`.`,
    "- `skills` values must be copied EXACTLY from the list below. Every skill on the list should be covered by at least one project.",
    "",
    "SKILLS ON THIS CAREER'S ROADMAP",
    input.skillNames.join("; "),
  ].join("\n");
}

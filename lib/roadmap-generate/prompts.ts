import { MIN_TOPICS } from "./normalize";

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

export function roadmapPrompt(input: { career: PromptCareer; skills: { name: string; category: string | null }[]; keepTopics?: string[]; feedback?: string[] }): string {
  const { career, skills, keepTopics, feedback } = input;
  return [
    `Design the roadmap for the career "${career.name}"${career.description ? `: ${career.description}` : ""}.`,
    "",
    "RULES",
    `- ${MIN_TOPICS}-60 TOPIC nodes in total, grouped under 5-10 GROUP nodes, across 3-4 SPINE stages (FOUNDATION, CORE, SPECIALIZATION, JOB_READY), ordered by "order" starting at 1.`,
    "- SPINE: parent null, side CENTER. GROUP: parent is a SPINE, side LEFT or RIGHT (alternate). TOPIC: parent is a GROUP, same side as its group, never under another topic.",
    "- Every TOPIC has `skill` = EXACTLY one name from the skill list below, or from newSkills. One topic per skill. Never invent a topic without a skill.",
    "- Use an existing skill whenever one fits. Only when none does, add it to newSkills (name, parent, description). `parent` must be the exact name of an existing skill from the list, `name` must be specific (under 60 characters) and not a synonym of an existing skill.",
    "- target is a whole number 0-100: the level a job-ready person should reach (about 50-70 for foundations, 65-85 for core and specialization). importance is CORE, RECOMMENDED or OPTIONAL.",
    "- Each node's `stage` is the stage of its spine. Prerequisite edges (type PREREQUISITE) go only from a topic to a later topic in the same or a later stage; they must not form cycles. Add edges only where one skill truly requires another.",
    "- Descriptions: one plain sentence (under 200 characters) saying what the student learns. No marketing language.",
    "- Node keys: lowercase letters, digits and dashes only.",
    "",
    "SKILL LIST (the only valid existing skill names)",
    skillCatalogText(skills),
    ...(keepTopics?.length ? ["", "THE CURRENT ROADMAP covers these skills. Keep the ones that are still relevant so students' progress carries over, and add or drop only what the field has changed:", keepTopics.join("; ")] : []),
    ...(feedback?.length ? ["", "YOUR PREVIOUS ANSWER WAS REJECTED. Fix every problem below and answer again in full:", ...feedback.map((f) => `- ${f}`)] : []),
  ].join("\n");
}

export const EXTRAS_SYSTEM = `You recommend portfolio projects and professional certifications for engineering students in India. You answer only by calling the provided tool.
Only recommend certifications you are certain exist, from the real provider, with the provider's real official URL. If you are not certain, leave it out: every link is machine-checked and unverifiable ones are dropped.`;

export function extrasPrompt(input: { career: PromptCareer; skillNames: string[] }): string {
  return [
    `Career: "${input.career.name}".`,
    "",
    "RULES",
    "- 6 to 8 projects. Each is an original brief a student can build alone: title, difficulty, a description of what to build (2-3 sentences), 2-5 `evidence` items (concrete things a reviewer can check, like a repository, a deployed link, a test report), and 2-6 `skills`.",
    "- 4 to 6 certifications that employers recognise for this career: exact official name, provider, the official https URL of that certification's own page (not a homepage), difficulty, and 1-5 `skills`.",
    "- `skills` values must be copied EXACTLY from the list below. Spread them so most of the list is covered by something.",
    "",
    "SKILLS ON THIS CAREER'S ROADMAP",
    input.skillNames.join("; "),
  ].join("\n");
}

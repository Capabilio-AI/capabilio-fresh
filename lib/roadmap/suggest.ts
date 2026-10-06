import { z } from "zod";
import { completeJson, GROQ_MODEL } from "@/lib/ai/groq";

/** Re-exported so callers that record provenance never import the AI provider themselves. */
export const EXTRACTION_MODEL = GROQ_MODEL;

export interface AreaOption {
  key: string;
  name: string;
}

/**
 * PROPOSE ONLY. Returns skill-area keys the model thinks a subject builds. It has no database access
 * and its output is filtered to real keys; nothing here is ever saved — the admin must confirm.
 */
export async function suggestAreasForSubject(subjectName: string, roleName: string, areas: AreaOption[]): Promise<string[]> {
  const valid = new Set(areas.map((a) => a.key));
  const list = areas.map((a) => `- ${a.key}: ${a.name}`).join("\n");
  const result = await completeJson(
    `University subject: "${subjectName}".\nWhich of these ${roleName} skill areas does studying this subject directly build? Choose only clear matches; an empty list is a valid answer.\n${list}\nReturn JSON: {"areas": string[]} using only the keys above.`,
    "You map university subjects to professional skill areas conservatively. You never invent keys.",
    z.object({ areas: z.array(z.string()) })
  );
  return [...new Set(result.areas.filter((k) => valid.has(k)))];
}

export interface SubjectOutcomes {
  id: string;
  title: string;
  outcomes: string[];
}

/**
 * Same PROPOSE-ONLY rule as above, for a semester's worth of subjects that carry Course Outcomes: one call per batch,
 * each subject judged on its own outcomes. A subject with no clear match gets an empty list — never a forced guess.
 */
export async function suggestAreasForOutcomes(items: SubjectOutcomes[], roleName: string, areas: AreaOption[]): Promise<Map<string, string[]>> {
  const valid = new Set(areas.map((a) => a.key));
  const ids = new Set(items.map((i) => i.id));
  const list = areas.map((a) => `- ${a.key}: ${a.name}`).join("\n");
  const subjects = items.map((i) => `id=${i.id} | ${i.title}\n${i.outcomes.map((o) => `  * ${o}`).join("\n")}`).join("\n\n");
  const result = await completeJson(
    `For each university subject below, using ONLY its stated course outcomes, which of these ${roleName} skill areas does it directly build? Choose only clear matches; an empty list is a valid, common answer.\n${list}\n\nSubjects:\n${subjects}\n\nReturn JSON: {"results":[{"id":string,"areas":string[]}]} with one entry per id and only the keys above.`,
    "You map university subjects to professional skill areas conservatively, from their course outcomes. You never invent keys or ids.",
    z.object({ results: z.array(z.object({ id: z.string(), areas: z.array(z.string()) })) })
  );
  const out = new Map<string, string[]>();
  for (const r of result.results) if (ids.has(r.id)) out.set(r.id, [...new Set(r.areas.filter((k) => valid.has(k)))]);
  return out;
}


export const StructuredSubjectsSchema = z.object({
  subjects: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(200),
        category: z.string().trim().max(120).nullish(),
        kind: z.enum(["course", "lab", "elective_option", "project", "audit"]),
        confidence: z.enum(["high", "low"]),
      })
    )
    .max(60),
});
export type StructuredSubjects = z.infer<typeof StructuredSubjectsSchema>;

const TABLE_SYSTEM = `You read one semester's course-structure table from a university syllabus and list its subjects. You copy names exactly as printed (rejoin names that wrap across lines) and never invent, translate or expand a title. You are conservative: if you are unsure a line is a real course, mark confidence "low".`;

function tablePrompt(text: string, year: number, semester: number): string {
  return `Semester: Year ${year}, Semester ${semester}.
Text of the semester's course-structure table (columns: S.No, Category, Title, L T P Credits):
"""
${text.slice(0, 9000)}
"""
List every specific named course. Rules:
- kind: "lab" for laboratory courses, "project" for project/internship courses, "audit" for audit (no-credit) courses, "elective_option" for each numbered option listed under an elective row (one item per option, category = the elective's name, e.g. "Professional Elective-I"), otherwise "course".
- Do NOT list free-text notes or sentences under the table (e.g. "Mandatory … Internship of 08 weeks during summer vacation", "Note: …").
- Do NOT list generic placeholders with no specific title: "Open Elective", "Minor Course", "Honors Course", "12 week MOOC … course", "Total" rows, or credit sums.
- category = the Category column as printed (e.g. "Professional Core"), or null.
Return JSON: {"subjects":[{"name":string,"category":string|null,"kind":"course"|"lab"|"elective_option"|"project"|"audit","confidence":"high"|"low"}]}`;
}

/**
 * PROPOSE ONLY, like the functions above: reads one semester's course table (text only, no database access) and lists its subjects.
 * The caller grounds every name against the source text before anything reaches the admin.
 */
export async function extractSubjectsFromTable(tableText: string, year: number, semester: number): Promise<StructuredSubjects> {
  return completeJson(tablePrompt(tableText, year, semester), TABLE_SYSTEM, StructuredSubjectsSchema);
}

// ---------------------------------------------------------------------------------------------------------------------
// Canonical-taxonomy suggestions and the layout-agnostic section structurer (Phase 3). Same rule as above: PROPOSE ONLY — no
// database access here; callers ground and validate everything before it is stored, and mappings are only ever stored as SUGGESTED.
// ---------------------------------------------------------------------------------------------------------------------

export interface CatalogSkill {
  name: string;
  category: string;
}
export interface CourseForSkills {
  id: string;
  title: string;
  objectives: string[];
  outcomes: { code: string; text: string }[];
  unitTitles: string[];
  experiments: string[];
}
export const SkillCandidatesSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      skills: z
        .array(
          z.object({
            /** a skill NAME from the catalog, or a new one when no catalog skill fits */
            name: z.string().trim().min(2).max(120),
            /** the sentence from the course text that justifies it */
            evidence: z.string().trim().min(5).max(400),
            /** outcome codes (CO1…) that support it; empty = course-level only */
            outcomes: z.array(z.string()).max(12),
            confidence: z.enum(["high", "medium", "low"]),
          })
        )
        .max(12),
    })
  ),
});
export type SkillCandidates = z.infer<typeof SkillCandidatesSchema>;

const CLIP = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Candidate skills per course, each with the text that justifies it and the outcomes that support it. Prefer catalog names; a skill
 * outside the catalog may be proposed and will be queued for admin review, never created. Soft skills only when the text states them.
 */
export async function suggestSkillsForCourses(courses: CourseForSkills[], catalog: CatalogSkill[]): Promise<SkillCandidates["results"]> {
  const list = catalog.map((s) => `${s.name} (${s.category})`).join("; ");
  const body = courses
    .map(
      (c) =>
        `id=${c.id} | ${c.title}\nObjectives: ${CLIP(c.objectives.join(" "), 500)}\nOutcomes:\n${c.outcomes.map((o) => `  ${o.code}: ${CLIP(o.text, 220)}`).join("\n") || "  (none stated)"}\nUnits: ${CLIP(c.unitTitles.join("; "), 300)}\nLab work: ${CLIP(c.experiments.slice(0, 6).join(" | "), 400)}`
    )
    .join("\n\n");
  const out = await completeJson(
    `Catalog of skills: ${list}\n\nFor each university course below, list the skills a student demonstrably builds, using ONLY what the text states.\n- Use a catalog skill NAME exactly when one fits. Only if a clearly distinct skill is stated and missing from the catalog, give a short new name.\n- "evidence" must quote or closely paraphrase a sentence from that course's own text.\n- "outcomes" lists the outcome codes (e.g. CO2) that support the skill; [] if only the objectives/units support it.\n- Soft skills (communication, teamwork…) ONLY when the course text explicitly states them.\n- Fewer, well-supported skills beat many weak ones; an empty list is valid.\n\nCourses:\n${body}\n\nReturn JSON: {"results":[{"id":string,"skills":[{"name":string,"evidence":string,"outcomes":string[],"confidence":"high"|"medium"|"low"}]}]} with one entry per id.`,
    "You identify skills from university course descriptions conservatively and never invent evidence, outcome codes or course ids.",
    SkillCandidatesSchema
  );
  const ids = new Set(courses.map((c) => c.id));
  return out.results.filter((r) => ids.has(r.id));
}

export const SectionStructureSchema = z.object({
  objectives: z.array(z.string().trim().min(4).max(400)).max(12),
  outcomes: z.array(z.object({ code: z.string().trim().min(2).max(10), text: z.string().trim().min(8).max(500) })).max(12),
  units: z.array(z.object({ unitNo: z.number().int().min(1).max(12), title: z.string().trim().min(2).max(160), topics: z.array(z.string().trim().min(3).max(200)).max(40) })).max(12),
  experiments: z.array(z.string().trim().min(5).max(500)).max(60),
  textbooks: z.array(z.string().trim().min(5).max(400)).max(12),
  referenceBooks: z.array(z.string().trim().min(5).max(400)).max(12),
});
export type SectionStructure = z.infer<typeof SectionStructureSchema>;

/**
 * For a course section whose layout the deterministic parser did not recognise. Copy-only: the caller keeps just the items that
 * can be found in the source text, so an invented outcome or unit cannot reach the review screen.
 */
export async function structureCourseSection(title: string, sectionText: string): Promise<SectionStructure> {
  return completeJson(
    `Course: ${title}\nText of the course's syllabus entry:\n"""\n${sectionText.slice(0, 9000)}\n"""\nExtract, copying wording from the text and inventing nothing: objectives, course outcomes (code like CO1 and text), units (number, title, topics), lab experiments, textbooks, reference books. Use [] for anything the text does not contain.\nReturn JSON: {"objectives":string[],"outcomes":[{"code":string,"text":string}],"units":[{"unitNo":number,"title":string,"topics":string[]}],"experiments":string[],"textbooks":string[],"referenceBooks":string[]}`,
    "You read one university course syllabus entry and copy its structure faithfully. You never invent or paraphrase content that is not in the text.",
    SectionStructureSchema
  );
}

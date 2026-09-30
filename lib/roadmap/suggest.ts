import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";

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

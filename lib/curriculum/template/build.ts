import type { PersistCourse } from "@/lib/roadmap/extract/persist";
import type { ParsedSection } from "@/lib/roadmap/extract/section";
import { resolveSkill, type SkillIndex } from "@/lib/skills/resolve";
import type { Importance, TemplateCourse } from "./parse";

export const DECLARED_EVIDENCE = "Stated by the college in its curriculum template.";

/** A skill the college itself stated for a course. Written by the template importer as the college's confirmed mapping — never by the AI extraction path. */
export interface DeclaredSkill {
  skillId: string;
  importance: Importance | null;
  /** outcome codes of the course it was tied to */
  outcomeCodes: string[];
}
export interface UnitSkill {
  courseIndex: number;
  unitNo: number;
  skillId: string;
}
export interface BuiltTemplate {
  /** the course tree only; skills are carried separately in `declared` */
  courses: PersistCourse[];
  /** per course, parallel to `courses` */
  declared: DeclaredSkill[][];
  unitSkills: UnitSkill[];
  /** skill names the college wrote that are not in the Capabilio skills list, with where they appeared */
  unmatchedSkills: { name: string; course: string; line: number }[];
  /** courses that came with no outcomes and no units: the analysis step has little to work from */
  thinCourses: string[];
}

function section(c: TemplateCourse): ParsedSection {
  const hasHours = c.lecture !== null || c.tutorial !== null || c.practical !== null || c.credits !== null;
  return {
    ltpc: hasHours ? { l: c.lecture ?? 0, t: c.tutorial ?? 0, p: c.practical ?? 0, c: c.credits } : null,
    prerequisites: c.prerequisites,
    objectives: c.objectives,
    outcomes: c.outcomes,
    units: c.units,
    experiments: c.experiments,
    textbooks: c.textbooks,
    referenceBooks: c.referenceBooks,
    onlineResources: c.onlineResources,
    provenance: { _source: "Capabilio curriculum template" },
    complete: c.outcomes.length > 0 || c.units.length > 0 || c.experiments.length > 0,
  };
}

/**
 * Pure. Turns a parsed template into what the draft-import writer takes. A skill the college named becomes a confirmed mapping only when it
 * resolves EXACTLY to the Capabilio skills list (name or alias): a near-match is reported as unmatched rather than guessed, because a
 * confirmed mapping drives student roadmaps.
 */
export function buildFromTemplate(courses: TemplateCourse[], index: SkillIndex): BuiltTemplate {
  const unmatchedSkills: BuiltTemplate["unmatchedSkills"] = [];
  const unitSkills: UnitSkill[] = [];
  const declared: DeclaredSkill[][] = [];
  const out: PersistCourse[] = courses.map((c, courseIndex) => {
    const bySkill = new Map<string, DeclaredSkill>();
    for (const s of c.skills) {
      const hit = resolveSkill(s.name, index);
      if (!hit || hit.via !== "alias") {
        unmatchedSkills.push({ name: s.name, course: c.code, line: s.line });
        continue;
      }
      // a skill taught in a unit or by an outcome is also one the course teaches
      if (s.scope.type === "unit") unitSkills.push({ courseIndex, unitNo: s.scope.unitNo, skillId: hit.skillId });
      const prev = bySkill.get(hit.skillId);
      const codes = new Set(prev?.outcomeCodes ?? []);
      if (s.scope.type === "outcome") codes.add(s.scope.code);
      bySkill.set(hit.skillId, { skillId: hit.skillId, importance: s.importance ?? prev?.importance ?? null, outcomeCodes: [...codes] });
    }
    declared.push([...bySkill.values()]);
    return {
      row: { year: c.year, semester: c.semester, name: c.title, code: c.code, category: c.category, kind: c.kind },
      parsed: section(c),
      structuredBy: "parser" as const,
      mappings: [],
    };
  });
  return {
    courses: out,
    declared,
    unitSkills,
    unmatchedSkills,
    thinCourses: courses.filter((c) => c.outcomes.length === 0 && c.units.length === 0 && c.objectives.length === 0).map((c) => c.code),
  };
}

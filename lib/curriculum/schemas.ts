import { z } from "zod";

/**
 * Request bodies for the curriculum admin API. All strict: the institution, the import and WHO approved something are never
 * client-supplied (they come from the caller's own membership and the route's own id).
 */
const line = (max: number) => z.string().trim().min(1).max(max);
const hours = z.number().min(0).max(40).nullable();
export const BLOOM = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] as const;
export const KINDS = ["course", "lab", "elective_option", "project", "audit"] as const;

const Outcome = z.object({ code: z.string().trim().regex(/^[A-Za-z0-9._-]{1,20}$/, "Use a short code such as CO1"), text: line(600), bloomLevel: z.enum(BLOOM).nullable().optional() }).strict();
const Unit = z.object({ unitNo: z.number().int().min(1).max(40), title: line(160), hours: hours.optional(), topics: z.array(line(200)).max(80) }).strict();

export const CourseTreeSchema = z
  .object({
    title: line(200).optional(),
    year: z.number().int().min(1).max(6).optional(),
    semester: z.number().int().min(1).max(2).nullable().optional(),
    courseCode: z.string().trim().max(40).nullable().optional(),
    category: z.string().trim().max(120).nullable().optional(),
    kind: z.enum(KINDS).optional(),
    lectureHours: hours.optional(),
    tutorialHours: hours.optional(),
    practicalHours: hours.optional(),
    credits: z.number().min(0).max(40).nullable().optional(),
    prerequisites: z.string().trim().max(500).nullable().optional(),
    objectives: z.array(line(400)).max(20).optional(),
    textbooks: z.array(line(500)).max(30).optional(),
    referenceBooks: z.array(line(500)).max(30).optional(),
    onlineResources: z.array(line(500)).max(30).optional(),
    isElective: z.boolean().optional(),
    isLab: z.boolean().optional(),
    outcomes: z.array(Outcome).max(30).optional(),
    units: z.array(Unit).max(30).optional(),
    experiments: z.array(line(500)).max(80).optional(),
  })
  .strict()
  .refine((t) => !t.outcomes || new Set(t.outcomes.map((o) => o.code.toLowerCase())).size === t.outcomes.length, { message: "Outcome codes must be unique." })
  .refine((t) => !t.units || new Set(t.units.map((u) => u.unitNo)).size === t.units.length, { message: "Unit numbers must be unique." });
export type CourseTree = z.infer<typeof CourseTreeSchema>;

const SNAKE: Record<string, string> = {
  courseCode: "course_code", lectureHours: "lecture_hours", tutorialHours: "tutorial_hours", practicalHours: "practical_hours",
  referenceBooks: "reference_books", onlineResources: "online_resources", isElective: "is_elective", isLab: "is_lab",
};

/** The jsonb payload replace_course_tree() expects: snake_case, and only the keys that were sent (a missing key means "leave it"). */
export function toTreeJson(tree: CourseTree): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (value === undefined) continue;
    if (key === "outcomes") out.outcomes = (value as NonNullable<CourseTree["outcomes"]>).map((o) => ({ code: o.code, text: o.text, bloom_level: o.bloomLevel ?? null }));
    else if (key === "units") out.units = (value as NonNullable<CourseTree["units"]>).map((u) => ({ unit_no: u.unitNo, title: u.title, hours: u.hours ?? null, topics: u.topics }));
    else out[SNAKE[key] ?? key] = value;
  }
  return out;
}

export const CreateImportSchema = z
  .object({ branch: line(200), regulation: z.string().trim().min(1).max(80).nullable().optional(), program: z.string().trim().max(200).nullable().optional() })
  .strict();

export const UpdateImportSchema = z
  .object({
    branch: line(200).optional(),
    regulation: z.string().trim().min(1).max(80).nullable().optional(),
    program: z.string().trim().max(200).nullable().optional(),
    /** PUBLISHED is deliberately absent: only the publish route can reach it */
    status: z.enum(["DRAFT", "EXTRACTED", "UNDER_REVIEW", "CONFIRMED"]).optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update." });

export const AddCoursesSchema = z
  .object({
    courses: z.array(z.object({ year: z.number().int().min(1).max(6), semester: z.number().int().min(1).max(2).nullable().optional(), title: line(200), code: z.string().trim().max(40).nullable().optional(), category: z.string().trim().max(120).nullable().optional() }).strict()).min(1).max(200),
  })
  .strict();

export const DecisionsSchema = z
  .object({
    decisions: z
      .array(
        z.object({ skillId: z.string().uuid(), decision: z.enum(["confirm", "reject", "clear"]), importance: z.enum(["CORE", "SUPPORTING", "MINOR"]).nullable().optional(), outcomeId: z.string().uuid().optional() }).strict()
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine((b) => new Set(b.decisions.map((d) => `${d.outcomeId ?? ""}|${d.skillId}`)).size === b.decisions.length, { message: "Each skill can only appear once per request." });

/** `expectedCount` is the size of the preview the person looked at: confirming without having previewed (or after the list changed) is refused. */
export const ConfirmHighSchema = z
  .object({ preview: z.boolean(), minConfidence: z.number().min(0.5).max(1).default(0.9), expectedCount: z.number().int().min(0).optional() })
  .strict()
  .refine((b) => b.preview || b.expectedCount !== undefined, { message: "Preview the list before confirming it." });
export const MergeSchema = z.object({ intoCourseId: z.string().uuid() }).strict();
export const IdSchema = z.string().uuid();

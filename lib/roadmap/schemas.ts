import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

const SubjectInput = z.object({ name: text(200), code: z.string().trim().max(40).optional() }).strict();

// strict(): the institution is never in the body — it is derived server-side from the caller's admin membership.
export const SubjectsBodySchema = z
  .object({
    branch: text(200),
    year: z.number().int().min(1).max(6),
    semester: z.number().int().min(1).max(2).optional(),
    subjects: z.array(SubjectInput).min(1).max(100),
  })
  .strict();

export const MappingBodySchema = z
  .object({
    roleKey: text(64),
    areaKeys: z.array(text(64)).max(20),
    fromSuggestion: z.boolean(),
  })
  .strict();

export const SuggestBodySchema = z.object({ subjectName: text(200), roleKey: text(64) }).strict();

export type SubjectsBody = z.infer<typeof SubjectsBodySchema>;

import { z } from "zod";

/** One subject the extraction proposes. Same core fields as the CSV import row (branch is chosen once at upload). */
export const CandidateRowSchema = z.object({
  tempId: z.string(),
  year: z.number().int().min(1).max(6),
  semester: z.number().int().min(1).max(2),
  name: z.string().min(1).max(200),
  code: z.string().max(40).nullable(),
  category: z.string().max(120).nullable(),
  kind: z.enum(["course", "lab", "elective_option", "project", "audit"]),
  /** 'low' = the model wasn't sure, or the name could not be found in the source text */
  confidence: z.enum(["high", "low"]),
  needsReview: z.boolean(),
  reason: z.string().nullable(),
  outcomesCount: z.number().int().min(0),
  suggestedAreaKeys: z.array(z.string()),
  /** why the row has (or hasn't) a suggested mapping — never a forced guess */
  mappingNote: z.enum(["suggested", "none_confident", "no_outcomes", "not_attempted"]),
});
export type CandidateRow = z.infer<typeof CandidateRowSchema>;

export const ExtractionResultSchema = z.object({
  rows: z.array(CandidateRowSchema),
  warnings: z.array(z.string()),
  /** the curriculum_imports draft (status EXTRACTED) holding the full course tree; absent on results from before Phase 3 */
  importId: z.string().uuid().nullish(),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export type ExtractionErrorCode = "no_text_layer" | "unrecognised_format" | "unreadable" | "ai_unavailable" | "internal";

export interface ExtractionRecord {
  id: string;
  branch: string;
  fileName: string;
  status: "processing" | "ready" | "failed";
  chunksDone: number;
  chunksTotal: number;
  errorCode: ExtractionErrorCode | null;
  result: ExtractionResult | null;
  createdAt: string;
  updatedAt: string;
}

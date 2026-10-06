import { extractSubjectsFromTable } from "../suggest";
import type { SemesterChunk } from "./chunk";
import { isGrounded, norm } from "./ground";
import type { CandidateRow } from "./types";

type BaseRow = Omit<CandidateRow, "tempId" | "outcomesCount" | "suggestedAreaKeys" | "mappingNote">;

export { isGrounded };

/** One AI call for one semester table, then grounded against the source text: an ungrounded or low-confidence name is flagged, never trusted. */
export async function structureSemester(chunk: SemesterChunk): Promise<BaseRow[]> {
  const result = await extractSubjectsFromTable(chunk.text, chunk.year, chunk.semester);
  const seen = new Set<string>();
  const rows: BaseRow[] = [];
  for (const s of result.subjects) {
    const key = norm(s.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const grounded = isGrounded(s.name, chunk.text);
    const low = s.confidence === "low" || !grounded;
    rows.push({
      year: chunk.year,
      semester: chunk.semester,
      name: s.name.replace(/\s*\/\s*\/?\s*SWAYAM.*$/i, "").trim() || s.name,
      code: null,
      category: s.category ?? null,
      kind: s.kind,
      confidence: low ? "low" : "high",
      needsReview: low,
      reason: !grounded ? "This name could not be found word-for-word in the semester table." : s.confidence === "low" ? "The reader was not confident this is a real course." : null,
    });
  }
  return rows;
}

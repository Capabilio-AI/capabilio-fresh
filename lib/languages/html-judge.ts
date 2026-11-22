import { readPage } from "./html-check";
import type { HtmlChallenge } from "./types";

export const MAX_PAGE_CHARS = 20000;
export interface RequirementResult { index: number; text: string; passed: boolean }

/** Reads the student's page and checks every requirement. A requirement that throws counts as not met, so one broken page cannot hide the others. */
export function judgePage(ch: HtmlChallenge, source: string): { passed: boolean; results: RequirementResult[]; note: string | null } {
  if (source.length > MAX_PAGE_CHARS) return { passed: false, results: [], note: "That page is too long." };
  const doc = readPage(source);
  const results = ch.requirements.map((r, index) => {
    let passed = false;
    try { passed = Boolean(r.test(doc)); } catch { passed = false; }
    return { index, text: r.text, passed };
  });
  return { passed: results.every((r) => r.passed), results, note: doc.parseError };
}

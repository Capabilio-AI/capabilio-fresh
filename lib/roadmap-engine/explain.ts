import { explainSubjects, type SubjectFactsForExplanation } from "@/lib/roadmap/suggest";
import { checkExplanation } from "./explanation";
import type { SubjectRow } from "./types";

export type ExplainFn = (careerName: string, subjects: SubjectFactsForExplanation[]) => Promise<Map<string, string>>;
const MAX_EXPLAINED = 8;

/**
 * Optional AI sentences for the top subjects. Each is kept only if it passes the grounding check against that subject's own facts;
 * anything else is dropped (the deterministic facts are always shown regardless). An AI failure simply yields no sentences.
 */
export async function buildExplanations(careerName: string, subjects: SubjectRow[], allSkillNames: string[], explain: ExplainFn = explainSubjects): Promise<{ sentences: Map<string, string>; rejected: number; failed: boolean }> {
  const focus = subjects.filter((s) => s.schedule !== "PAST").slice(0, MAX_EXPLAINED);
  if (focus.length === 0) return { sentences: new Map(), rejected: 0, failed: false };
  let raw: Map<string, string>;
  try {
    raw = await explain(careerName, focus.map((s) => ({ id: s.courseId, title: s.title, skillNames: s.facts.skillNames, outcomeCount: s.facts.outcomeCount, gapPoints: s.facts.gapPoints })));
  } catch {
    return { sentences: new Map(), rejected: 0, failed: true };
  }
  const sentences = new Map<string, string>();
  let rejected = 0;
  for (const s of focus) {
    const text = raw.get(s.courseId);
    if (!text) continue;
    if (checkExplanation(text, s.facts, allSkillNames).ok) sentences.set(s.courseId, text.trim());
    else rejected++;
  }
  return { sentences, rejected, failed: false };
}

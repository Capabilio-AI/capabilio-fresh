/**
 * An AI-written one-sentence explanation of why a subject matters is accepted ONLY if it restates the facts it was given (PURE check):
 * one short sentence, mentioning no skill outside those facts, no number outside those facts, and never telling the student to skip a subject.
 */
export interface ExplanationFacts {
  skillNames: string[];
  outcomeCount: number;
  gapPoints: number;
}

const MAX_CHARS = 240;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function checkExplanation(text: string, facts: ExplanationFacts, allSkillNames: string[]): { ok: true } | { ok: false; reason: string } {
  const t = text.trim();
  if (!t) return { ok: false, reason: "empty" };
  if (t.length > MAX_CHARS) return { ok: false, reason: "too long" };
  if ((t.match(/[.!?](\s|$)/g) ?? []).length > 1) return { ok: false, reason: "more than one sentence" };
  if (/\b(skip|ignore|drop|don't (need|bother)|no need to)\b/i.test(t)) return { ok: false, reason: "tells the student to skip a subject" };
  const allowed = new Set(facts.skillNames.map((s) => s.toLowerCase()));
  for (const name of allSkillNames) {
    if (allowed.has(name.toLowerCase())) continue;
    if (new RegExp(`(^|[^\\p{L}])${escape(name)}($|[^\\p{L}])`, "iu").test(t)) return { ok: false, reason: `mentions ${name}, which is not one of the facts` };
  }
  const numbers = new Set([String(facts.outcomeCount), String(facts.gapPoints)]);
  for (const n of t.match(/\d+/g) ?? []) if (!numbers.has(n)) return { ok: false, reason: `mentions the number ${n}, which is not one of the facts` };
  return { ok: true };
}

import type { CheckRow } from "./checks";

/** Each use of the AI helper while an attempt is open lowers the final score by this much, like a hint. */
export const AI_HELP_PENALTY = 5;
/** Per attempt, before and after submitting. */
export const MAX_AI_HELP = 3;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Numbers as a person would write them: 37.5 -> "37.5"; 13824 -> "13824" and "13,824". Small whole numbers are too common to treat as secrets. */
function numberForms(n: number): string[] {
  if (Number.isInteger(n) && Math.abs(n) < 10) return [];
  const forms = new Set([String(n), String(Number(n.toFixed(2))), String(Number(n.toFixed(1)))]);
  if (Number.isInteger(n)) forms.add(n.toLocaleString("en-US"));
  return [...forms].filter((f) => f.length >= 2);
}

/**
 * Pure. Best-effort guard on the AI helper's reply: true if it states something the checks hold secret -- a numeric answer, the correct
 * option, the ground-truth query, or a required string. The prompt forbids these; this catches the model ignoring it.
 */
export function leaksAnswer(reply: string, checks: Pick<CheckRow, "checkType" | "config">[]): boolean {
  const text = norm(reply);
  const plain = reply.replace(/,/g, "");
  for (const { checkType, config } of checks) {
    if (typeof config.expected === "number") {
      if (numberForms(config.expected).some((f) => new RegExp(`(^|[^0-9.])${f.replace(/[.,]/g, "\\$&")}([^0-9]|\\.(?!\\d)|$)`).test(f.includes(",") ? reply : plain))) return true;
    }
    if (checkType === "CHOICE_ANSWER") {
      const correct = [config.correct].flat().map((c) => norm(String(c ?? ""))).filter((c) => c.length >= 3);
      if (correct.some((c) => text.includes(c))) return true;
    }
    if (typeof config.groundTruthQuery === "string" && text.includes(norm(config.groundTruthQuery))) return true;
    if (Array.isArray(config.contains) && config.contains.some((c) => typeof c === "string" && c.length >= 8 && reply.includes(c))) return true;
    if (typeof config.expected === "string" && config.expected.trim().length >= 4 && text.includes(norm(config.expected))) return true;
  }
  return false;
}

/** The reply shown when the helper's answer was withheld. Names what to revisit from real challenge data only. */
export function withheldReply(stepTitles: string[], skillNames: string[]): string {
  const where = stepTitles.length ? `Revisit: ${stepTitles.join("; ")}.` : "";
  const skills = skillNames.length ? ` Skills involved: ${skillNames.join(", ")}.` : "";
  return `I can't give that away directly. Re-read the ticket and work the problem step by step.${where ? ` ${where}` : ""}${skills}`;
}

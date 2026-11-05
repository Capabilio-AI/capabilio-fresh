// Bug makers for the fix-the-bug bank: take a correct program and change ONE thing (a comparison, an operator, a constant, min<->max ...). The
// caller keeps a mutant only if it still builds, passes some tests and fails others, so every kept task has a real, findable bug.
export type MutantLang = "python" | "javascript" | "cpp" | "c";
export interface Mutant { code: string; note: string; kind: string }

interface Op { kind: string; re: RegExp; to: (m: string) => string | null; note: (from: string, to: string) => string }

const swap = (pairs: Record<string, string>) => (m: string) => pairs[m] ?? null;
const OPS: Op[] = [
  { kind: "compare", re: / (<=|>=|<|>) /g, to: (m) => swap({ "<=": "<", ">=": ">", "<": "<=", ">": ">=" })(m.trim()) && ` ${swap({ "<=": "<", ">=": ">", "<": "<=", ">": ">=" })(m.trim())} `, note: (a, b) => `the comparison${a} was changed to${b}, so a boundary value is treated wrongly` },
  { kind: "equality", re: / (===|==|!==|!=) /g, to: (m) => { const t = m.trim(); const o: Record<string, string> = { "===": "!==", "==": "!=", "!==": "===", "!=": "==" }; return o[t] ? ` ${o[t]} ` : null; }, note: (a, b) => `the test${a} was flipped to${b}` },
  { kind: "arith", re: / [+-] /g, to: (m) => (m.trim() === "+" ? " - " : " + "), note: (a, b) => `the operator${a} was changed to${b}` },
  { kind: "logic", re: / (and|or|&&|\|\|) /g, to: (m) => { const t = m.trim(); const o: Record<string, string> = { and: "or", or: "and", "&&": "||", "||": "&&" }; return ` ${o[t]} `; }, note: (a, b) => `the condition${a} was changed to${b}` },
  { kind: "minmax", re: /\b(min|max)\(/g, to: (m) => (m.startsWith("min") ? "max(" : "min("), note: (a, b) => `${a.replace("(", "")} was swapped for ${b.replace("(", "")}` },
  { kind: "accumulate", re: / (\+=|-=) /g, to: (m) => (m.trim() === "+=" ? " -= " : " += "), note: (a, b) => `the update${a} was changed to${b}` },
  { kind: "constant", re: /(?<![\w."'])(\d+)(?![\w."'])/g, to: (m) => String(Number(m) + 1), note: (a, b) => `the constant ${a} was changed to ${b}` },
  { kind: "constant", re: /(?<![\w."'])([2-9]|\d{2,})(?![\w."'])/g, to: (m) => String(Number(m) - 1), note: (a, b) => `the constant ${a} was changed to ${b}` },
];

const insideString = (line: string, at: number) => ((line.slice(0, at).match(/(?<!\\)["']/g) ?? []).length % 2) === 1;
const skipLine = (line: string) => /^\s*(#include|import|from|using|package)\b/.test(line) || /^\s*(\/\/|#)/.test(line);

/** Every single-change mutant of a program, in a stable order. Many will not build or behave the same; the caller filters. */
export function mutants(code: string, _lang: MutantLang): Mutant[] {
  const lines = code.split("\n");
  const out: Mutant[] = [];
  const seen = new Set<string>([code]);
  lines.forEach((line, li) => {
    if (skipLine(line)) return;
    for (const op of OPS) {
      for (const m of line.matchAll(op.re)) {
        const at = m.index ?? 0;
        if (insideString(line, at)) continue;
        const from = m[0];
        const to = op.to(from);
        if (!to || to === from) continue;
        const next = [...lines.slice(0, li), line.slice(0, at) + to + line.slice(at + from.length), ...lines.slice(li + 1)].join("\n");
        if (seen.has(next)) continue;
        seen.add(next);
        out.push({ code: next, kind: op.kind, note: `line ${li + 1}: ${op.note(from, to)}` });
      }
    }
  });
  return out;
}

// Pure helpers for spotting submissions that are copies of each other and solves that came too fast to be typed.

const KEYWORDS = new Set(
  ("if else elif for while do return int long double float char void string bool boolean true false null none class def public private static new import from include using " +
    "select from where group by order having join on as and or not in is case when then end with union insert update delete create table values distinct over partition").split(" ")
);

/** Code with comments removed, whitespace folded and every name replaced by `v`, so renaming variables does not hide a copy. */
export function normaliseCode(code: string): string[] {
  const bare = code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)(\/\/|#|--).*$/gm, " ");
  const tokens = bare.toLowerCase().match(/[a-z_][a-z0-9_]*|\d+(?:\.\d+)?|\S/g) ?? [];
  return tokens.map((t) => (/^[a-z_]/.test(t) && !KEYWORDS.has(t) ? "v" : t));
}

const SHINGLE = 4;
/** Fewer tokens than this is too short to say anything: a one-line answer is the same for everyone. */
export const MIN_TOKENS = 30;

export function shingles(tokens: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE <= tokens.length; i++) out.add(tokens.slice(i, i + SHINGLE).join(" "));
  return out;
}

/** Share of 4-token runs the two programs have in common, from 0 (nothing) to 1 (identical after normalising). Null when either is too short. */
export function similarity(a: string, b: string): number | null {
  const ta = normaliseCode(a);
  const tb = normaliseCode(b);
  if (ta.length < MIN_TOKENS || tb.length < MIN_TOKENS) return null;
  const sa = shingles(ta);
  const sb = shingles(tb);
  let both = 0;
  for (const s of sa) if (sb.has(s)) both++;
  const union = sa.size + sb.size - both;
  return union === 0 ? null : both / union;
}

export const SIMILAR_AT = 0.85;

/**
 * How many of a student's correct solves came in a run of `minRun` or more, each less than `gapMs` after the one before. Reading a
 * problem and writing a working answer takes longer than a minute, so a quick run suggests answers were pasted in from elsewhere.
 */
export function rapidSolves(timesMs: readonly number[], gapMs = 60_000, minRun = 3): number {
  const sorted = [...timesMs].sort((a, b) => a - b);
  let flagged = 0;
  let run = 1;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] - sorted[i - 1] < gapMs) {
      run++;
      continue;
    }
    if (run >= minRun) flagged += run;
    run = 1;
  }
  return flagged;
}

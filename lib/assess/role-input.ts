// Pure checks on what a student types as their career role. The point is to stop obvious nonsense and injection attempts BEFORE any
// database or model call; the model's own "is this a real role" judgement is the second, semantic gate.

export type RoleInput = { ok: true; text: string } | { ok: false; message: string };

const REPHRASE = "That doesn't look like a career role. Try something like \"data analyst\", \"devops engineer\" or \"game developer\".";
const INJECTION = /\b(ignore|disregard|forget)\b.{0,30}\b(instruction|prompt|rule)s?\b|\bsystem prompt\b|\bjailbreak\b|<\s*script|\{\{|\bapi[_ ]?key\b/i;
const MASH = /(asdf|qwer|zxcv|hjkl|uiop|sdfg|dfgh|fghj|ghjk)/i;

/** lower-case, letters/digits and the few symbols roles use (+ # . /), single spaces. Also the form aliases are stored in. */
export function normalizeRole(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#./ -]+/gu, " ")
    .replace(/[-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkRoleInput(raw: string): RoleInput {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 160) return { ok: false, message: "Tell us the role in a few words (2 to 160 characters)." };
  if (INJECTION.test(trimmed)) return { ok: false, message: REPHRASE };
  const text = normalizeRole(trimmed);
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (letters < 2 || letters / Math.max(1, text.replace(/\s/g, "").length) < 0.6) return { ok: false, message: REPHRASE };
  if (/(.)\1{4,}/u.test(text) || MASH.test(text)) return { ok: false, message: REPHRASE };
  // a long "word" with no vowel is almost never language ("bcdfgh")
  if (text.split(" ").some((w) => w.length >= 5 && !/[aeiouy]/i.test(w) && /^[a-z]+$/.test(w))) return { ok: false, message: REPHRASE };
  return { ok: true, text };
}

export function slugOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}
export function skillKeyOf(name: string): string {
  return "SKILL_" + name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

/** Edit distance (insert, delete, substitute). Small inputs only: role titles. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = row;
  }
  return prev[b.length];
}

/**
 * Whether two normalised titles differ only by typos: in each word at most one character inserted, dropped or changed. Deliberately this strict: "automobile engineer" and
 * "automotive engineer" are two edits apart and are two different titles, so they are never merged without the student saying so.
 */
export function isSpellingVariant(a: string, b: string): boolean {
  if (a.length < 5 || b.length < 5) return false;
  if (levenshtein(a, b) <= 1) return true;
  // several words may each carry one slip ("mechnical design enginer"), but a word that differs by two letters is a different word (automobile / automotive)
  const x = a.split(" ");
  const y = b.split(" ");
  if (x.length !== y.length) return false;
  const differing = x.map((w, i) => [w, y[i]]).filter(([p, q]) => p !== q);
  return differing.length > 0 && differing.length <= 3 && differing.every(([p, q]) => p.length >= 5 && q.length >= 5 && levenshtein(p, q) <= 1);
}

/** Words that name a kind of job rather than a field: two roles sharing only these are not related ("Cloud Engineer" and "Automotive Engineer"). */
const JOB_NOUNS = new Set(["engineer", "developer", "analyst", "specialist", "manager", "associate", "executive", "officer", "consultant", "technician", "designer", "architect", "administrator", "scientist", "intern", "trainee", "lead", "senior", "junior", "assistant", "coordinator"]);
export const fieldWords = (title: string): string[] => normalizeRole(title).split(" ").filter((w) => w.length >= 3 && !JOB_NOUNS.has(w));

/** True when the titles share a word that names the field (not just "engineer"), or one is a typo of the other. Used to keep unrelated roles out of "did you mean". */
export function sharesField(a: string, b: string): boolean {
  const bs = fieldWords(b);
  return fieldWords(a).some((w) => bs.some((x) => x === w || x.startsWith(w) || w.startsWith(x) || (w.length >= 6 && levenshtein(w, x) <= 2)));
}

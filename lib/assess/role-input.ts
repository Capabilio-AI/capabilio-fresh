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

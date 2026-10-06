/** Pure text-grounding helpers: the guard against AI output that is not in the source document. */
export const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/** Share of `claim`'s words (length > 1) that appear in `source`, 0..1. */
export function wordOverlap(claim: string, source: string, minWordLength = 2): number {
  const src = new Set(norm(source).split(" "));
  const words = norm(claim).split(" ").filter((w) => w.length >= minWordLength);
  if (words.length === 0) return 0;
  return words.filter((w) => src.has(w)).length / words.length;
}

/** True when (nearly) every word of the model's name appears in the source — the guard against invented titles. */
export const isGrounded = (name: string, sourceText: string): boolean => wordOverlap(name, sourceText) >= 0.9;

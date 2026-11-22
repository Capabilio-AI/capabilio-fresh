/** Words that carry no meaning when matching what a student types to a goal's name. */
const STOP = new Set(["a", "an", "the", "to", "be", "become", "want", "wanna", "i", "im", "am", "my", "me", "in", "of", "for", "and", "or", "as", "do", "get", "become", "work", "job", "career", "become", "how", "can", "would", "like", "love", "dream", "is", "it", "into", "on"]);

/** Pure. Lower-case words with punctuation and filler removed: "I want to become a Fashion Designer!" -> ["fashion", "designer"]. */
export function goalWords(text: string): string[] {
  return text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 0 && !STOP.has(w));
}

/** Pure. The same words in one stable string, so the same goal typed two ways counts once. */
export const goalKey = (text: string): string => goalWords(text).join(" ");

export interface PathwayCandidate { key: string; name: string; kind: string; aliases: readonly string[] }
export interface PathwayMatch { key: string; name: string; kind: string; score: number }

/** Words that stay a plain English word once stemmed ("designer", "designing", "design" should meet). Very light on purpose. */
const stem = (w: string): string => w.replace(/(ing|ers|er|ed|s)$/, "").replace(/(.)\1$/, "$1");

/**
 * Pure. How well what a student typed names a pathway: 1 when it is the pathway's name or an alias (word for word), otherwise the share of the
 * name's or alias's words found in the text, and only when at least two thirds are found. A weak match is no match: asking is better than guessing.
 */
export function matchPathways(text: string, candidates: readonly PathwayCandidate[], min = 2 / 3): PathwayMatch[] {
  const typed = goalWords(text).map(stem);
  if (typed.length === 0) return [];
  const have = new Set(typed);
  const out: PathwayMatch[] = [];
  for (const c of candidates) {
    let best = 0;
    for (const phrase of [c.name, ...c.aliases]) {
      const words = goalWords(phrase).map(stem);
      if (words.length === 0) continue;
      const found = words.filter((w) => have.has(w)).length / words.length;
      // an exact phrase, with nothing extra typed, is the strongest signal
      const exact = found === 1 && words.length === typed.length;
      best = Math.max(best, exact ? 1 : found >= min ? found * 0.9 : 0);
    }
    if (best > 0) out.push({ key: c.key, name: c.name, kind: c.kind, score: Math.round(best * 100) / 100 });
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 3);
}

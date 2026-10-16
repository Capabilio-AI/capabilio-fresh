import { normalizeSkillText } from "./normalize";
import type { SkillIndex } from "./resolve";

/** Matches of fewer characters than this are skipped: a skill called "Go" would otherwise match every "go" in a job description. */
const MIN_SINGLE_WORD_LENGTH = 3;
const MAX_PHRASE_WORDS = 4;

/**
 * Pure. The catalog skills a block of text mentions, by canonical name, in order of first appearance, each once. It looks for the longest
 * phrase first, so "Power BI" is not read as "Power" and "BI". This is plain matching against the skill catalog (names and aliases), so it
 * never invents a skill and never calls an AI; the catch is that it only finds skills the catalog already knows.
 */
export function extractSkills(text: string, index: SkillIndex, names: ReadonlyMap<string, string>): string[] {
  const words = normalizeSkillText(text).split(" ").filter(Boolean);
  const found: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < words.length; ) {
    let advanced = 1;
    for (let n = Math.min(MAX_PHRASE_WORDS, words.length - i); n >= 1; n--) {
      const phrase = words.slice(i, i + n).join(" ");
      if (n === 1 && phrase.length < MIN_SINGLE_WORD_LENGTH) continue;
      const skillId = index.exact.get(phrase);
      if (!skillId) continue;
      const name = names.get(skillId);
      if (name && !seen.has(skillId)) {
        seen.add(skillId);
        found.push(name);
      }
      advanced = n;
      break;
    }
    i += advanced;
  }
  return found;
}

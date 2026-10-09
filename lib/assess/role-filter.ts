import { normalizeRole } from "./role-input";

export interface FilterableRole {
  careerId: string;
  name: string;
  aliases: string[];
}
export interface RoleHit<T extends FilterableRole> {
  role: T;
  /** the alias that matched, when it is not just the role's own name */
  matched: string | null;
}

/** The roles shown first when nothing is typed: in-demand, current roles. Anything not listed follows alphabetically. */
export const FEATURED = ["Data Analyst", "Software Engineer", "AI/ML Engineer", "Generative AI Engineer", "Full Stack Developer", "Cloud Engineer", "Cybersecurity Analyst", "Data Engineer", "Product Manager", "Data Scientist"];

/**
 * Instant, local filtering over the role list that ships with the page. Ranking: name starts with the text, an alias starts with it,
 * a word of the name/alias starts with it, then anything that contains it. Pure, so it is unit-tested and costs no request.
 */
export function filterRoles<T extends FilterableRole>(roles: readonly T[], text: string): RoleHit<T>[] {
  const q = normalizeRole(text);
  if (!q) {
    const rank = (r: T) => { const i = FEATURED.indexOf(r.name); return i < 0 ? FEATURED.length : i; };
    return [...roles].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).map((role) => ({ role, matched: null }));
  }
  const scored: { hit: RoleHit<T>; score: number }[] = [];
  for (const role of roles) {
    const name = normalizeRole(role.name);
    let best = 9;
    let matched: string | null = null;
    const consider = (candidate: string, isName: boolean) => {
      const words = candidate.split(" ");
      const score = candidate.startsWith(q) ? (isName ? 0 : 1) : words.some((w) => w.startsWith(q)) ? 2 : candidate.includes(q) ? 3 : 9;
      if (score < best) { best = score; matched = isName ? null : candidate; }
    };
    consider(name, true);
    for (const a of role.aliases) consider(a, false);
    if (best < 9) scored.push({ hit: { role, matched }, score: best });
  }
  return scored.sort((a, b) => a.score - b.score || a.hit.role.name.localeCompare(b.hit.role.name)).map((s) => s.hit);
}

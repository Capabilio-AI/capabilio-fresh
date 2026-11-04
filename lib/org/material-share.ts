/** One thing shared with students, with every branch-and-year group it goes to. PURE: the library, the counts and the tests all use this. */
export interface ShareRow {
  id: string;
  share_id: string;
  type: "notes" | "pdf" | "link" | "file";
  title: string;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  url: string | null;
  body: string | null;
  branch: string;
  year: number;
  subject_id: string | null;
  author_membership_id: string;
  published_at: string;
}
export interface Audience { branch: string; year: number }
export interface MaterialShare extends Omit<ShareRow, "branch" | "year" | "id"> {
  /** the id of the first row, for opening a file or link */
  id: string;
  rowIds: string[];
  audiences: Audience[];
}

export const YEARS = [1, 2, 3, 4];
const key = (b: string) => b.trim().toLowerCase();

/** Rows that belong together (same share) become one item, newest first, with their audiences sorted. */
export function groupShares(rows: ShareRow[]): MaterialShare[] {
  const by = new Map<string, ShareRow[]>();
  for (const r of rows) by.set(r.share_id, [...(by.get(r.share_id) ?? []), r]);
  return [...by.values()]
    .map((group): MaterialShare => {
      const { branch: _b, year: _y, id, ...first } = group[0];
      void _b; void _y;
      return {
        ...first,
        id,
        rowIds: group.map((g) => g.id),
        audiences: group.map((g) => ({ branch: g.branch, year: g.year })).sort((a, b) => a.branch.localeCompare(b.branch) || a.year - b.year),
        published_at: group.reduce((latest, g) => (g.published_at > latest ? g.published_at : latest), group[0].published_at),
      };
    })
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

/** "Computer Science and Engineering (CSE)" -> "CSE"; otherwise a short form of the name. */
export function shortBranch(branch: string): string {
  const code = branch.match(/\(([^)]{1,12})\)\s*$/)?.[1];
  if (code) return code;
  return branch.length > 22 ? `${branch.slice(0, 20).trim()}…` : branch;
}

function yearsText(years: number[]): string {
  const ys = [...new Set(years)].sort((a, b) => a - b);
  if (ys.length === YEARS.length && YEARS.every((y) => ys.includes(y))) return "All years";
  const runs: string[] = [];
  for (let i = 0; i < ys.length; ) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
    runs.push(j > i ? `${ys[i]}–${ys[j]}` : String(ys[i]));
    i = j + 1;
  }
  return `${ys.length === 1 ? "Year" : "Years"} ${runs.join(", ")}`;
}

/**
 * The audience in a few readable chips. Every branch of the college with every year is "All branches · All years"; branches that share the same
 * years are folded together; the rest list their own years. `full` is the complete sentence for a tooltip.
 */
export function summariseAudience(audiences: Audience[], allBranches: string[]): { chips: string[]; full: string } {
  const byBranch = new Map<string, { name: string; years: number[] }>();
  for (const a of audiences) {
    const k = key(a.branch);
    const hit = byBranch.get(k);
    if (hit) hit.years.push(a.year);
    else byBranch.set(k, { name: a.branch, years: [a.year] });
  }
  const groups = [...byBranch.values()].map((g) => ({ name: g.name, years: yearsText(g.years) }));
  const full = groups.map((g) => `${g.name} · ${g.years}`).join("; ");
  if (groups.length === 0) return { chips: [], full: "" };
  const everyBranch = allBranches.length > 0 && allBranches.every((b) => byBranch.has(key(b)));
  const sameYears = groups.every((g) => g.years === groups[0].years);
  if (everyBranch && sameYears) return { chips: [`All branches · ${groups[0].years}`], full };
  if (groups.length > 1 && sameYears) return { chips: [`${groups.length} branches · ${groups[0].years}`], full };
  return { chips: groups.map((g) => `${shortBranch(g.name)} · ${g.years}`), full };
}

/**
 * A student gets one copy of anything shared with several years of their branch. Of the copies, the one for their own year wins (they are the
 * nearest to what they study), otherwise the latest earlier year. Input order is kept.
 */
export function onePerShare<T extends { share_id: string; year: number }>(rows: T[], currentYear: number | null): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const hit = best.get(r.share_id);
    const closer = (a: T, b: T) => (currentYear === null ? a.year > b.year : Math.abs(currentYear - a.year) < Math.abs(currentYear - b.year));
    if (!hit || closer(r, hit)) best.set(r.share_id, r);
  }
  const keep = new Set(best.values());
  return rows.filter((r) => keep.has(r));
}

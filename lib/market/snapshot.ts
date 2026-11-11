/** A skill the matcher looks for: the canonical id and name, and the lowercase spellings that count as a mention. */
export interface SkillVocab { id: string; name: string; patterns: string[] }

/** One live job posting, reduced to what we use. The description is only the short snippet job boards give out. */
export interface Posting {
  id: string; title: string; company: string; location: string;
  salaryMin: number | null; salaryMax: number | null; salaryPredicted: boolean;
  url: string; created: string | null; snippet: string;
}

export interface SkillDemand { skillId: string; name: string; postings: number; share: number }
export interface MarketJob { id: string; title: string; company: string; location: string; salaryMin: number | null; salaryMax: number | null; url: string; created: string | null; skillIds: string[] }
export interface MarketSnapshot {
  role: string;
  fetchedAt: string;
  /** postings the numbers below are based on */
  sampled: number;
  topSkills: SkillDemand[];
  titles: { name: string; postings: number }[];
  companies: { name: string; postings: number }[];
  locations: { name: string; postings: number }[];
  /** yearly pay in rupees from postings that state it; null when none did */
  salary: { currency: "INR"; p25: number; median: number; p75: number; sample: number } | null;
  jobs: MarketJob[];
}

const MAX_JOBS = 30;
const TOP = 8;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Pure. Adzuna's search response as postings. A row without a title or a link is dropped; nothing here throws. */
export function parsePostings(json: unknown): Posting[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((r): Posting[] => {
    const o = r as Record<string, unknown>;
    const title = str(o.title);
    const url = str(o.redirect_url);
    if (!title || !/^https?:\/\//.test(url)) return [];
    return [{
      id: String(o.id ?? url), title, url,
      company: str((o.company as { display_name?: unknown } | undefined)?.display_name),
      location: str((o.location as { display_name?: unknown } | undefined)?.display_name),
      salaryMin: num(o.salary_min), salaryMax: num(o.salary_max),
      salaryPredicted: String(o.salary_is_predicted ?? "0") === "1",
      created: str(o.created) || null,
      snippet: str(o.description),
    }];
  });
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compiled = new WeakMap<SkillVocab[], { id: string; re: RegExp }[]>();

function patternsOf(vocab: SkillVocab[]): { id: string; re: RegExp }[] {
  const cached = compiled.get(vocab);
  if (cached) return cached;
  const built = vocab.flatMap((s) => {
    // one-letter spellings ("r", "c") match everywhere, so they never count
    const ps = s.patterns.map((p) => p.trim().toLowerCase()).filter((p) => p.length >= 2);
    if (ps.length === 0) return [];
    // a word boundary that also works next to symbols such as c++ or .net
    return [{ id: s.id, re: new RegExp(`(?<![a-z0-9])(?:${ps.map(escape).join("|")})(?![a-z0-9])`, "i") }];
  });
  compiled.set(vocab, built);
  return built;
}

/** Pure. The skills a text mentions, each once. */
export function matchSkills(text: string, vocab: SkillVocab[]): string[] {
  return patternsOf(vocab).filter((p) => p.re.test(text)).map((p) => p.id);
}

/** Pure. Linear-interpolated percentile (q 0..1) of a list of numbers; null for an empty list. */
export function percentile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(v[lo] + (v[hi] - v[lo]) * (pos - lo));
}

function tally(names: string[]): { name: string; postings: number }[] {
  const counts = new Map<string, number>();
  for (const n of names.map((x) => x.trim()).filter(Boolean)) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, TOP).map(([name, postings]) => ({ name, postings }));
}

/** Pure. What a set of live postings says about a role: which skills employers ask for and how often, who hires, where, and what it pays. */
export function buildSnapshot(role: string, postings: Posting[], vocab: SkillVocab[], now: Date = new Date()): MarketSnapshot {
  const nameOf = new Map(vocab.map((s) => [s.id, s.name]));
  const perPosting = postings.map((p) => ({ p, skills: matchSkills(`${p.title} ${p.snippet}`, vocab) }));
  const counts = new Map<string, number>();
  for (const { skills } of perPosting) for (const id of skills) counts.set(id, (counts.get(id) ?? 0) + 1);
  const topSkills = [...counts]
    .sort((a, b) => b[1] - a[1] || (nameOf.get(a[0]) ?? "").localeCompare(nameOf.get(b[0]) ?? ""))
    .map(([skillId, n]) => ({ skillId, name: nameOf.get(skillId) ?? skillId, postings: n, share: postings.length ? Number((n / postings.length).toFixed(3)) : 0 }));

  // pay is what the posting says, never the board's own estimate
  const paid = postings.filter((p) => !p.salaryPredicted && (p.salaryMin || p.salaryMax));
  const mids = paid.map((p) => ((p.salaryMin ?? p.salaryMax!) + (p.salaryMax ?? p.salaryMin!)) / 2);
  const salary = mids.length ? { currency: "INR" as const, p25: percentile(mids, 0.25)!, median: percentile(mids, 0.5)!, p75: percentile(mids, 0.75)!, sample: mids.length } : null;

  return {
    role, fetchedAt: now.toISOString(), sampled: postings.length, topSkills,
    titles: tally(postings.map((p) => p.title)),
    companies: tally(postings.map((p) => p.company)),
    locations: tally(postings.map((p) => p.location.split(",")[0])),
    salary,
    jobs: perPosting.slice(0, MAX_JOBS).map(({ p, skills }) => ({ id: p.id, title: p.title, company: p.company, location: p.location, salaryMin: p.salaryPredicted ? null : p.salaryMin, salaryMax: p.salaryPredicted ? null : p.salaryMax, url: p.url, created: p.created, skillIds: skills })),
  };
}

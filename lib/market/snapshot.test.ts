import { describe, expect, it } from "vitest";
import { buildSnapshot, matchSkills, parsePostings, percentile, type Posting, type SkillVocab } from "./snapshot";

const vocab: SkillVocab[] = [
  { id: "sql", name: "SQL", patterns: ["sql", "t-sql"] },
  { id: "pbi", name: "Power BI", patterns: ["power bi", "powerbi"] },
  { id: "cpp", name: "C++", patterns: ["c++"] },
  { id: "r", name: "R", patterns: ["r"] },
  { id: "py", name: "Python", patterns: ["python"] },
];
const posting = (o: Partial<Posting> = {}): Posting => ({ id: "1", title: "Data Analyst", company: "Acme", location: "Pune", salaryMin: null, salaryMax: null, salaryPredicted: false, url: "https://x.io/1", created: "2026-11-01T00:00:00Z", snippet: "", ...o });

describe("parsePostings", () => {
  it("normalises an Adzuna response and drops rows without a title or link", () => {
    const out = parsePostings({ results: [
      { id: 7, title: "Data Analyst", description: "Use SQL", company: { display_name: "Acme" }, location: { display_name: "Pune, Maharashtra" }, salary_min: 400000, salary_max: 600000, salary_is_predicted: "0", redirect_url: "https://a.io/7", created: "2026-11-01T00:00:00Z" },
      { id: 8, title: "", redirect_url: "https://a.io/8" },
      { id: 9, title: "No link" },
    ] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "7", company: "Acme", location: "Pune, Maharashtra", salaryMin: 400000, salaryMax: 600000, salaryPredicted: false, snippet: "Use SQL" });
  });
  it("copes with garbage", () => {
    expect(parsePostings(null)).toEqual([]);
    expect(parsePostings({ results: "x" })).toEqual([]);
  });
});

describe("matchSkills", () => {
  it("matches whole words and symbols, not fragments", () => {
    expect(matchSkills("Strong SQL and Power BI; some C++", vocab).sort()).toEqual(["cpp", "pbi", "sql"]);
    expect(matchSkills("mysqldump and clearance", vocab)).toEqual([]);
  });
  it("ignores one-letter skills that would match everywhere", () => {
    expect(matchSkills("R is a language but also a letter: a r b", vocab)).toEqual([]);
  });
  it("counts a skill once per posting", () => {
    expect(matchSkills("sql sql SQL", vocab)).toEqual(["sql"]);
  });
});

describe("percentile", () => {
  it("interpolates and handles tiny samples", () => {
    expect(percentile([100, 200, 300, 400], 0.5)).toBe(250);
    expect(percentile([100], 0.75)).toBe(100);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("buildSnapshot", () => {
  const posts = [
    posting({ id: "a", snippet: "SQL and Power BI", salaryMin: 400000, salaryMax: 600000, company: "Acme" }),
    posting({ id: "b", snippet: "SQL, Python", salaryMin: 500000, salaryMax: 700000, company: "Acme", title: "Junior Data Analyst" }),
    posting({ id: "c", snippet: "Python only", company: "Beta", location: "Remote" }),
    posting({ id: "d", snippet: "Excel", company: "Gamma", salaryMin: 9_000_000, salaryMax: 9_000_000, salaryPredicted: true }),
  ];
  const snap = buildSnapshot("Data Analyst", posts, vocab, new Date("2026-11-10T00:00:00Z"));
  it("reports how often each skill is asked for", () => {
    const sql = snap.topSkills.find((s) => s.skillId === "sql")!;
    expect(sql).toMatchObject({ postings: 2, share: 0.5 });
    expect(snap.topSkills[0].postings).toBeGreaterThanOrEqual(snap.topSkills[1].postings);
  });
  it("computes pay from real figures only, ignoring predicted ones", () => {
    expect(snap.salary).toMatchObject({ sample: 2, currency: "INR" });
    expect(snap.salary!.median).toBe(550000);
    expect(snap.salary!.p75).toBeLessThan(9_000_000);
  });
  it("lists who is hiring and where", () => {
    expect(snap.companies[0]).toMatchObject({ name: "Acme", postings: 2 });
    expect(snap.locations.map((l) => l.name)).toContain("Pune");
  });
  it("keeps only light fields for the jobs it lists, with the skills seen in each", () => {
    const job = snap.jobs.find((j) => j.id === "a")!;
    expect(job.skillIds.sort()).toEqual(["pbi", "sql"]);
    expect(job).not.toHaveProperty("snippet");
  });
  it("has no pay figure when nothing real was posted", () => {
    expect(buildSnapshot("x", [posting({ snippet: "SQL" })], vocab).salary).toBeNull();
  });
});

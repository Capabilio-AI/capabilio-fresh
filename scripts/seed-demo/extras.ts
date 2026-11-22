// DEMO DATA. The remaining layers for a demo student: common-challenge history, GitHub scan, Launchpad company visits and CRT results.
// Companies are fictional and their websites use the reserved .example domain; GitHub accounts and repositories are fictional too.
import { randomUUID } from "node:crypto";
import { rowToFullRepoAnalysis } from "@/lib/code-dna/github-scan";
import { deriveScoreBreakdown } from "@/lib/code-dna/score-breakdown";
import { summarizeCalendar, type AccountFacts, type ActivitySummary } from "@/lib/code-dna/github-profile";
import { scoreAttempt } from "@/lib/crt/score";
import { CRT_MODULES, type CrtQuestion } from "@/lib/crt/model";
import { rngFor } from "./rng";

type Db = any;
const DAY = 864e5;
const iso = (t: number) => new Date(t).toISOString();

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Common challenges (the Stream track): real questions from the IT cluster, answered over about ten weeks
// ---------------------------------------------------------------------------------------------------------------------------------------------------
const STREAM_POINTS = { easy: 15, medium: 20, hard: 25 } as const;

export async function seedStream(db: Db, slug: string, userId: string, count: number): Promise<{ correct: number; total: number }> {
  const rng = rngFor("stream", slug);
  await db.from("arena_challenge_completions").delete().eq("user_id", userId).eq("track", "stream");
  const pick = async (difficulty: keyof typeof STREAM_POINTS, n: number) => {
    const { data } = await db.from("arena_challenges").select("id, category").eq("track", "stream").eq("scope_key", "it-cluster").eq("difficulty", difficulty).eq("active", true).limit(900);
    const rows = [...(data ?? [])] as { id: string; category: string }[];
    rows.sort(() => rng() - 0.5);
    const seen = new Set<string>();
    const out: { id: string; difficulty: keyof typeof STREAM_POINTS }[] = [];
    for (const r of rows) {
      if (out.length >= n) break;
      if (seen.has(r.category)) continue;
      seen.add(r.category);
      out.push({ id: r.id, difficulty });
    }
    return out;
  };
  const chosen = [...(await pick("easy", Math.round(count * 0.38))), ...(await pick("medium", Math.round(count * 0.42))), ...(await pick("hard", count - Math.round(count * 0.38) - Math.round(count * 0.42)))];
  chosen.sort(() => rng() - 0.5);
  const now = Date.now();
  let correct = 0;
  const rows = chosen.map((c, i) => {
    // difficulty and accuracy both improve with time, so older entries are easier and more often missed
    const progress = i / Math.max(1, chosen.length - 1);
    const ok = rng() < 0.62 + progress * 0.25 - (c.difficulty === "hard" ? 0.15 : 0);
    if (ok) correct++;
    const daysAgo = Math.round((1 - progress) * 66) + 1;
    return { user_id: userId, challenge_id: c.id, track: "stream", scope_key: "it-cluster", code_submitted: null, is_correct: ok, elo_delta: ok ? STREAM_POINTS[c.difficulty] : 0, completed_at: iso(now - daysAgo * DAY - Math.round(rng() * 8) * 3600e3) };
  });
  const { error } = await db.from("arena_challenge_completions").insert(rows);
  if (error) throw error;
  const week = new Date(); week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  await db.from("arena_stream_stats").upsert({ user_id: userId, points: rows.reduce((n, r) => n + r.elo_delta, 0), tasks_completed: correct, current_streak: 6, longest_streak: 9, last_completed_week: week.toISOString().slice(0, 10), updated_at: iso(now) }, { onConflict: "user_id" });
  return { correct, total: rows.length };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// GitHub: fictional account and repositories; the score is computed by the product's own scoring function from them
// ---------------------------------------------------------------------------------------------------------------------------------------------------
interface RepoSeed { name: string; description: string; language: string; langs: [string, number][]; topics: string[]; commits: number; prs: number; merged: number; months: number; stars: number; hasTests: boolean; hasCi: boolean; sizeKb: number }
const REPOS: Record<string, RepoSeed[]> = {
  "data-scientist": [
    { name: "customer-churn-prediction", description: "Churn model with a baseline, cross-validation and a cost-based decision threshold", language: "Python", langs: [["Python", 82], ["Jupyter Notebook", 18]], topics: ["machine-learning", "scikit-learn", "churn"], commits: 74, prs: 6, merged: 6, months: 5, stars: 7, hasTests: true, hasCi: true, sizeKb: 1900 },
    { name: "retail-demand-forecasting", description: "Weekly demand forecast with time-aware validation", language: "Python", langs: [["Python", 90], ["SQL", 10]], topics: ["forecasting", "time-series"], commits: 58, prs: 4, merged: 4, months: 4, stars: 5, hasTests: true, hasCi: false, sizeKb: 1400 },
    { name: "ab-test-sample-size", description: "Small tool to size A/B tests and read the result honestly", language: "Python", langs: [["Python", 100]], topics: ["statistics", "experiments"], commits: 31, prs: 2, merged: 2, months: 3, stars: 3, hasTests: true, hasCi: true, sizeKb: 420 },
    { name: "sql-analytics-practice", description: "Window functions, cohorts and retention queries on a sample warehouse", language: "SQL", langs: [["SQL", 88], ["Python", 12]], topics: ["sql", "analytics"], commits: 44, prs: 1, merged: 1, months: 6, stars: 4, hasTests: false, hasCi: false, sizeKb: 640 },
  ],
  "ai-ml-engineer": [
    { name: "leaf-disease-classifier", description: "Transfer-learning image classifier with augmentation and early stopping", language: "Python", langs: [["Python", 88], ["Jupyter Notebook", 12]], topics: ["pytorch", "computer-vision"], commits: 81, prs: 7, merged: 7, months: 6, stars: 9, hasTests: true, hasCi: true, sizeKb: 2300 },
    { name: "model-serving-fastapi", description: "Serving a scikit-learn pipeline behind FastAPI with validation and a version header", language: "Python", langs: [["Python", 93], ["Dockerfile", 7]], topics: ["mlops", "fastapi", "docker"], commits: 52, prs: 5, merged: 5, months: 4, stars: 6, hasTests: true, hasCi: true, sizeKb: 880 },
    { name: "drift-monitor-psi", description: "Population stability index checks for model inputs, with alert levels", language: "Python", langs: [["Python", 100]], topics: ["monitoring", "drift"], commits: 29, prs: 2, merged: 2, months: 3, stars: 4, hasTests: true, hasCi: true, sizeKb: 360 },
    { name: "text-classifier-transformers", description: "Fine-tuning a small transformer for ticket classification, with an error analysis notebook", language: "Python", langs: [["Python", 79], ["Jupyter Notebook", 21]], topics: ["nlp", "transformers"], commits: 46, prs: 3, merged: 3, months: 5, stars: 5, hasTests: false, hasCi: false, sizeKb: 1700 },
  ],
};

export async function seedGithub(db: Db, d: { slug: string; name: string; careerKey: string }, userId: string): Promise<number> {
  const rng = rngFor("github", d.slug);
  const login = d.slug;
  const now = Date.now();
  const repoRows = (REPOS[d.careerKey] ?? []).map((r) => {
    const created = now - r.months * 30 * DAY - Math.round(rng() * 20) * DAY;
    return {
      user_id: userId, name: r.name, full_name: `${login}/${r.name}`, html_url: `https://github.com/${login}/${r.name}`, description: r.description, is_fork: false, fork_source_full_name: null, fork_source_url: null,
      primary_language: r.language, topics: r.topics, license: "MIT", stars: r.stars, forks_count: Math.round(r.stars / 3), is_archived: false, size_kb: r.sizeKb,
      repo_created_at: iso(created), repo_updated_at: iso(now - Math.round(rng() * 25) * DAY), candidate_commit_count: r.commits, candidate_pr_count: r.prs, candidate_pr_merged_count: r.merged,
      first_candidate_commit_at: iso(created + DAY), last_candidate_commit_at: iso(now - Math.round(rng() * 25) * DAY), tech_signals: r.topics, has_tests: r.hasTests, has_ci: r.hasCi, has_readme: true,
      has_dependencies: true, has_database_signal: r.language === "SQL", has_auth_signal: false, contributors_count: 1 + Math.round(rng() * 2), scan_status: "ok", scan_error: null, scanned_at: iso(now - 2 * DAY),
      languages: r.langs.map(([name, percentage]) => ({ name, percentage })), top_contributors: [{ login, contributions: r.commits }], commit_signals: [],
    };
  });
  // a year of daily contributions: busier on weekdays, with quiet weeks (exams) and a steady recent stretch
  const calendar: number[] = [];
  const start = new Date(now - 370 * DAY); start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  for (let i = 0; i < 371; i++) {
    const day = new Date(start.getTime() + i * DAY).getUTCDay();
    const quiet = Math.floor(i / 7) % 9 === 5;
    const base = day === 0 || day === 6 ? 0.35 : 0.62;
    const recent = i > 280 ? 1.25 : 1;
    calendar.push(!quiet && rng() < base * recent ? 1 + Math.round(rng() * 5) : 0);
  }
  const total = calendar.reduce((a, b) => a + b, 0);
  const cal = summarizeCalendar(calendar);
  const activity: ActivitySummary = {
    windowFrom: start.toISOString().slice(0, 10), windowTo: iso(now).slice(0, 10), totalContributions: total, commits: Math.round(total * 0.72), pullRequests: repoRows.reduce((n, r) => n + r.candidate_pr_count, 0),
    reviews: 9, issues: 5, privateContributions: 0, ...cal, calendar, calendarStart: start.toISOString().slice(0, 10), externalPullRequests: { opened: 3, merged: 2, repositories: 2 },
  };
  const account: AccountFacts = { login, name: d.name, avatarUrl: `https://github.com/identicons/${login}.png`, createdAt: iso(now - 3.4 * 365 * DAY), followers: 21 + Math.round(rng() * 20), following: 18, publicRepos: repoRows.length + 3, company: null, location: null };
  const originality = { status: "checked" as const, eligibleRepos: repoRows.length, checkedRepos: repoRows.length, matches: [], copiedByOthers: [], ranAt: iso(now - 2 * DAY) };
  const repos = repoRows.map((r) => rowToFullRepoAnalysis(r as never));
  const breakdown = deriveScoreBreakdown({ repos, account, activity, forensics: [], originality, now });
  await db.from("github_repo_defenses").delete().eq("user_id", userId);
  await db.from("github_repositories").delete().eq("user_id", userId);
  await db.from("github_connections").delete().eq("user_id", userId);
  const { error: connError } = await db.from("github_connections").insert({
    user_id: userId, username: login, profile_url: `https://github.com/${login}`, verification_state: "verified", verification_code: "demo-account", scan_status: "idle", code_dna_score: breakdown.overall,
    confidence_level: "high", repositories_analyzed: repoRows.length, analysis: null, last_scanned_at: iso(now - 2 * DAY), next_scan_at: iso(now + 5 * DAY), consecutive_failures: 0,
    recruiter_summary: `${d.name} has ${repoRows.length} original repositories with ${repoRows.reduce((n, r) => n + r.candidate_commit_count, 0)} commits spread over the last year, steady weekly activity and tests or CI in most projects. The work is a mix of modelling, evaluation and delivery rather than tutorials, and the two largest projects were explained in the student's own words.`,
    account_facts: account, activity, score_breakdown: breakdown, originality, created_at: iso(now - 80 * DAY), updated_at: iso(now - 2 * DAY),
  });
  if (connError) throw connError;
  const { error: repoError } = await db.from("github_repositories").insert(repoRows);
  if (repoError) throw repoError;
  const defended = repoRows.slice(0, 2).map((r, i) => ({
    user_id: userId, full_name: r.full_name, attempts: 1, score: 78 - i * 8, updated_at: iso(now - (20 + i * 9) * DAY),
    questions: ["Why did you choose this approach?", "What would you change with more time?", "What was the hardest bug?"], asked: ["Why did you choose this approach?", "What would you change with more time?", "What was the hardest bug?"],
    feedback: { strengths: ["Explained the design choices clearly", "Knew where the weak points of the project are"], improvements: ["Mention how the results were validated"], notes: ["Clear", "Honest and specific", "Good example"] },
  }));
  await db.from("github_repo_defenses").insert(defended);
  return breakdown.overall;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Launchpad: fictional companies visiting the college, the student's registrations and the outcomes
// ---------------------------------------------------------------------------------------------------------------------------------------------------
interface Visit { company: string; slug: string; role: string; type: "job" | "internship"; location: string; ctc: string; status: "planned" | "registration_open" | "completed"; daysFromNow: number; skills: string[]; branches: string[]; outcome?: Partial<Record<string, "submitted" | "shortlisted" | "accepted" | "rejected">> }
const VISITS = (roleName: string): Visit[] => ([
  { company: "Northwind Analytics", slug: "northwind-analytics", role: "Associate Data Scientist", type: "job", location: "Hyderabad", ctc: "6 to 8 LPA", status: "registration_open", daysFromNow: 12, skills: ["Python", "SQL", "Statistics", "Machine Learning"], branches: ["CSE", "IT"], outcome: { "Data Scientist": "shortlisted" } },
  { company: "Lumen Systems", slug: "lumen-systems", role: "Machine Learning Engineer", type: "job", location: "Bengaluru", ctc: "7 to 10 LPA", status: "registration_open", daysFromNow: 19, skills: ["Python", "Machine Learning", "Model Deployment Basics", "Software Engineering"], branches: ["CSE", "IT", "ECE"], outcome: { "AI/ML Engineer": "shortlisted" } },
  { company: "Orbit Data Labs", slug: "orbit-data-labs", role: "Data Analyst Intern", type: "internship", location: "Remote", ctc: "25,000 per month stipend", status: "planned", daysFromNow: 33, skills: ["SQL", "Python", "Data Storytelling"], branches: ["CSE", "IT"], outcome: {} },
  { company: "GreenGrid Energy Tech", slug: "greengrid-energy", role: "Junior Data Scientist", type: "job", location: "Pune", ctc: "5 to 7 LPA", status: "completed", daysFromNow: -24, skills: ["Python", "Statistics", "Exploratory Data Analysis"], branches: ["CSE", "IT", "EEE"], outcome: { "Data Scientist": "rejected", "AI/ML Engineer": "submitted" } },
  { company: "Vista Cloud Services", slug: "vista-cloud", role: "AI Engineer Trainee", type: "job", location: "Chennai", ctc: "6 to 8 LPA", status: "completed", daysFromNow: -41, skills: ["Python", "Machine Learning", "Neural Network Fundamentals"], branches: ["CSE", "IT"], outcome: { "Data Scientist": "shortlisted", "AI/ML Engineer": "accepted" } },
  { company: "Atlas Insight", slug: "atlas-insight", role: "Data Science Intern", type: "internship", location: "Mumbai", ctc: "30,000 per month stipend", status: "completed", daysFromNow: -58, skills: ["Python", "Statistics", "SQL"], branches: ["CSE", "IT"], outcome: { "Data Scientist": "accepted", "AI/ML Engineer": "shortlisted" } },
] as Visit[]).map((v) => ({ ...v, role: v.role.replace("{role}", roleName) }));

/** The college's visits are shared by both demo students; each student's registrations differ. Rewritten on every run. */
export async function seedLaunchpad(db: Db, institutionId: string, demos: { userId: string; careerName: string }[]): Promise<number> {
  const { data: old } = await db.from("opportunities").select("id").eq("institution_id", institutionId).like("company_website", "%.example%");
  const oldIds = ((old ?? []) as { id: string }[]).map((o) => o.id);
  if (oldIds.length) {
    await db.from("applications").delete().in("opportunity_id", oldIds);
    await db.from("opportunities").delete().in("id", oldIds);
  }
  const today = Date.now();
  let made = 0;
  for (const v of VISITS("")) {
    const drive = new Date(today + v.daysFromNow * DAY).toISOString().slice(0, 10);
    const { data: opp, error } = await db.from("opportunities").insert({
      institution_id: institutionId, role: v.role, company: v.company, location: v.location, opportunity_type: v.type, skills: v.skills,
      eligibility: "Final-year students with no active backlogs", deadline: v.status === "completed" ? null : new Date(today + (v.daysFromNow - 3) * DAY).toISOString().slice(0, 10), drive_date: drive, drive_status: v.status,
      ctc_offered: v.ctc, eligible_branches: v.branches, company_website: `https://${v.slug}.example`, created_at: iso(today - (Math.abs(v.daysFromNow) + 20) * DAY),
    }).select("id").single();
    if (error) throw error;
    made++;
    for (const demo of demos) {
      const status = v.outcome?.[demo.careerName];
      if (status) await db.from("applications").insert({ opportunity_id: opp.id, user_id: demo.userId, status, applied_at: iso(today - (Math.abs(v.daysFromNow) + 10) * DAY) });
    }
  }
  return made;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// CRT: two college assessments, scored by the real CRT scorer from real questions, improving from the first to the second
// ---------------------------------------------------------------------------------------------------------------------------------------------------
export async function seedCrt(db: Db, d: { slug: string }, userId: string, institutionId: string, branch: string): Promise<number[]> {
  const rng = rngFor("crt", d.slug);
  const { data: qs } = await db.from("crt_questions").select("id, module, options").eq("status", "published").limit(5000);
  const all = (qs ?? []) as CrtQuestion[];
  const byModule = new Map(CRT_MODULES.map((m) => [m, all.filter((q) => q.module === m)]));
  const plan = [{ title: "CRT Assessment 1: Foundations", daysAgo: 96, p: 0.56 }, { title: "CRT Assessment 2: Placement readiness", daysAgo: 24, p: 0.74 }];
  const results: number[] = [];
  for (const [i, c] of plan.entries()) {
    const { data: old } = await db.from("crt_cycles").select("id").eq("college_id", institutionId).eq("title", c.title).maybeSingle();
    if (old) { await db.from("crt_attempts").delete().eq("cycle_id", old.id); await db.from("crt_cycles").delete().eq("id", old.id); }
    const opens = new Date(Date.now() - (c.daysAgo + 7) * DAY);
    const closes = new Date(Date.now() - (c.daysAgo - 7) * DAY);
    const { data: cycle, error } = await db.from("crt_cycles").insert({ college_id: institutionId, title: c.title, opens_on: opens.toISOString().slice(0, 10), closes_on: closes.toISOString().slice(0, 10), opens_at: opens.toISOString(), closes_at: closes.toISOString(), duration_minutes: 60, kind: "assessment", branches: [branch], years: [4] }).select("id").single();
    if (error) throw error;
    const served = CRT_MODULES.flatMap((m) => [...(byModule.get(m) ?? [])].sort(() => rng() - 0.5).slice(0, 12));
    const answers: Record<string, string> = {};
    for (const q of served) {
      const best = [...q.options].sort((a, b) => b.points - a.points)[0];
      const wrong = q.options.filter((o) => o.key !== best?.key);
      const strongModule = q.module === "aptitude" || q.module === "reasoning" ? 0.06 : -0.04;
      const roll = rng();
      if (roll < c.p + strongModule && best) answers[q.id] = best.key;
      else if (roll < c.p + strongModule + 0.2 && wrong.length) answers[q.id] = wrong[Math.floor(rng() * wrong.length)].key;
    }
    const { moduleScores, totalPct } = scoreAttempt(served, answers);
    const started = new Date(opens.getTime() + 2 * DAY + Math.round(rng() * 36) * 3600e3);
    const { error: attemptError } = await db.from("crt_attempts").insert({ cycle_id: cycle.id, user_id: userId, college_id: institutionId, branch, year_of_study: 4, started_at: started.toISOString(), deadline_at: new Date(started.getTime() + 60 * 60e3).toISOString(), submitted_at: new Date(started.getTime() + (44 + Math.round(rng() * 12)) * 60e3).toISOString(), question_ids: served.map((q) => q.id), answers, module_scores: moduleScores, total_pct: totalPct });
    if (attemptError) throw attemptError;
    results.push(totalPct);
    void i;
  }
  return results;
}

export { randomUUID };

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Roadmap: progress through the role's published roadmap, in order, with a few topics still being learned
// ---------------------------------------------------------------------------------------------------------------------------------------------------
export async function seedRoadmap(db: Db, d: { slug: string }, userId: string, careerId: string): Promise<{ done: number; total: number }> {
  const { data: template } = await db.from("roadmap_templates").select("id").eq("career_id", careerId).eq("status", "PUBLISHED").order("version", { ascending: false }).limit(1).maybeSingle();
  if (!template) return { done: 0, total: 0 };
  const { data: nodes } = await db.from("roadmap_nodes").select("id, stage, sort_order").eq("template_id", template.id).eq("type", "TOPIC").order("sort_order");
  const topics = (nodes ?? []) as { id: string; stage: string | null; sort_order: number }[];
  const rng = rngFor("roadmap", d.slug);
  const ids = topics.map((t) => t.id);
  if (ids.length) await db.from("roadmap_node_state").delete().eq("student_id", userId).in("node_id", ids);
  const doneCount = Math.round(topics.length * 0.58);
  const now = Date.now();
  const rows = topics.slice(0, doneCount + 3).map((t, i) => ({
    student_id: userId, node_id: t.id, status: i < doneCount ? "DONE" : "LEARNING",
    updated_at: iso(now - Math.round((1 - i / Math.max(1, doneCount)) * 80 * DAY) - Math.round(rng() * 5) * 3600e3),
  }));
  if (rows.length) { const { error } = await db.from("roadmap_node_state").insert(rows); if (error) throw error; }
  return { done: doneCount, total: topics.length };
}

// The IT bank of LeetCode-style problems (cap STREAM_BANK_CAP) grows only on demand: when a student's wheel number is larger than the
// unsolved problems the bank can give them, exactly the shortfall is generated. A run claims a row in arena_weekly_generation so two
// students never trigger two runs at once. Problems can also be authored elsewhere and imported (importProblems), which costs no AI calls.
import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { IT_CLUSTER_SCOPE_KEY } from "../branch-clusters";
import { currentStreamWeek } from "../week";
import { generateAndVerify, verifyProblem, type VerifiedProblem } from "./generate";
import { GeneratedProblemSchema, STREAM_BANK_CAP, TARGET_BY_DIFFICULTY } from "./problem";

const STALE_AFTER_MS = 6 * 60_000;
/** after a run ends short (quota, outage) automatic triggers wait this long before spending AI calls again */
const RETRY_COOLDOWN_MS = 15 * 60_000;
const TOPICS = ["Arrays", "Strings", "Hashing", "Two Pointers", "Sorting", "Stack", "Recursion", "Math", "Matrix", "Greedy", "Binary Search", "Prefix Sums", "Simulation", "Dynamic Programming"];
type Difficulty = keyof typeof TARGET_BY_DIFFICULTY;

/** How many LeetCode-style problems are stored in total (every week). */
export async function bankSize(service: SupabaseClient): Promise<number> {
  const { count } = await untyped(service).from("arena_challenges").select("id", { count: "exact", head: true }).eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "leetcode").eq("status", "PUBLISHED");
  return count ?? 0;
}

export interface WeeklyPool { weekStart: string; counts: Record<Difficulty, number>; total: number; generating: boolean }

/** Pure. Topics for a week: a rotating window, so consecutive weeks do not repeat the same mix. */
export function topicsFor(weekStart: string, take = 5): string[] {
  const n = Math.floor(new Date(`${weekStart}T00:00:00Z`).getTime() / (7 * 86_400_000));
  return Array.from({ length: take }, (_, i) => TOPICS[(n * 3 + i) % TOPICS.length]);
}

export async function weeklyPool(service: SupabaseClient): Promise<WeeklyPool> {
  const weekStart = currentStreamWeek();
  const db = untyped(service);
  const [{ data: rows }, { data: gen }] = await Promise.all([
    db.from("arena_challenges").select("difficulty").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "leetcode").eq("week_start", weekStart).eq("status", "PUBLISHED"),
    db.from("arena_weekly_generation").select("status, started_at").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("week_start", weekStart).maybeSingle(),
  ]);
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const r of (rows ?? []) as { difficulty: Difficulty }[]) counts[r.difficulty]++;
  const generating = gen?.status === "RUNNING" && Date.now() - new Date(gen.started_at).getTime() < STALE_AFTER_MS;
  return { weekStart, counts, total: counts.easy + counts.medium + counts.hard, generating };
}

async function claim(service: SupabaseClient, weekStart: string, force: boolean): Promise<boolean> {
  const db = untyped(service);
  const row = { scope_key: IT_CLUSTER_SCOPE_KEY, week_start: weekStart, status: "RUNNING", started_at: new Date().toISOString() };
  const ins = await db.from("arena_weekly_generation").insert(row);
  if (!ins.error) return true;
  const { data: cur } = await db.from("arena_weekly_generation").select("status, started_at").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("week_start", weekStart).maybeSingle();
  if (!cur) return false;
  if (cur.status === "RUNNING" && Date.now() - new Date(cur.started_at).getTime() < STALE_AFTER_MS) return false;
  if (cur.status === "FAILED" && !force && Date.now() - new Date(cur.started_at).getTime() < RETRY_COOLDOWN_MS) return false;
  // FAILED or stale: take it over, but only if nobody else did in the meantime (compare-and-set on started_at)
  const { data: won } = await db.from("arena_weekly_generation").update({ status: "RUNNING", started_at: row.started_at }).eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("week_start", weekStart).eq("started_at", cur.started_at).select("week_start");
  return (won?.length ?? 0) > 0;
}

export async function store(service: SupabaseClient, weekStart: string | null, v: VerifiedProblem): Promise<boolean> {
  const db = untyped(service);
  const p = v.problem;
  const { data, error } = await db.from("arena_challenges").insert({
    track: "stream", scope_key: IT_CLUSTER_SCOPE_KEY, kind: "leetcode", title: p.title, category: p.category, difficulty: p.difficulty,
    scenario: p.statement.slice(0, 400), objective: p.output_format, language: "python", starter_code: p.starter_python,
    stdin: v.tests[0].input, expected_output: v.tests[0].output, skill_tags: p.skill_tags,
    status: "PUBLISHED", source: "AI_WEEKLY", week_start: weekStart, problem: v.publicProblem, est_minutes: p.difficulty === "easy" ? 20 : p.difficulty === "medium" ? 30 : 40,
  }).select("id").single();
  if (error || !data) { console.error("[leetcode/weekly] insert failed", error?.message); return false; }
  const t = await db.from("arena_challenge_tests").insert({ challenge_id: data.id, tests: v.tests, sample_count: v.sampleCount, reference_solution: p.reference_solution });
  if (t.error) { await db.from("arena_challenges").delete().eq("id", data.id); console.error("[leetcode/weekly] tests insert failed", t.error.message); return false; }
  return true;
}

/**
 * Generates `need` more problems because a student's wheel number outran what the bank can give them. Safe to call from any request:
 * a second call while one is running (or right after a failed one) does nothing. Returns how many were added.
 */
export async function generateOnDemand(service: SupabaseClient, need: number, budgetMs = 240_000): Promise<{ added: number; claimed: boolean }> {
  const room = STREAM_BANK_CAP - (await bankSize(service));
  if (room <= 0 || need <= 0) return { added: 0, claimed: false }; // bank full: served from the database, no AI call
  const weekStart = currentStreamWeek();
  if (!(await claim(service, weekStart, false))) return { added: 0, claimed: false };
  const goal = Math.min(need, room, 9);
  let note = "";
  const added = await generateBulk(service, goal, (_a, n) => { if (n) note = n; }, Date.now() + budgetMs);
  await untyped(service).from("arena_weekly_generation").update({ status: added >= goal ? "DONE" : "FAILED", note }).eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("week_start", weekStart);
  return { added, claimed: true };
}

/**
 * Fills the bank outside the weekly run (a script, a long job): `count` more problems with the usual mix, no weekly target, stopping at the
 * bank cap, on a provider error, or when `shouldStop` says so. Returns how many were added.
 */
export async function generateBulk(service: SupabaseClient, count: number, onProgress: (added: number, note: string) => void = () => {}, deadline = Infinity): Promise<number> {
  const room = Math.max(0, STREAM_BANK_CAP - (await bankSize(service)));
  const goal = Math.min(count, room);
  const { data: titles } = await untyped(service).from("arena_challenges").select("title").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "leetcode").limit(1500);
  const avoid = ((titles ?? []) as { title: string }[]).map((t) => t.title);
  const mix: Difficulty[] = ["easy", "easy", "medium", "medium", "medium", "hard"]; // 1/3 easy, 1/2 medium, 1/6 hard
  let added = 0;
  let failures = 0;
  for (let i = 0; added < goal && failures < 5 && Date.now() < deadline; i++) {
    const d = mix[i % mix.length];
    try {
      const out = await generateAndVerify({ difficulty: d, count: 2, topics: topicsFor(new Date(Date.now() + i * 7 * 86_400_000).toISOString().slice(0, 10), 6), avoidTitles: avoid.slice(-120) });
      for (const v of out.verified) if (added < goal && (await store(service, null, v))) { added++; avoid.push(v.problem.title); }
      failures = out.verified.length === 0 ? failures + 1 : 0;
      onProgress(added, out.rejected.slice(0, 2).join(" | "));
    } catch (e) {
      failures++;
      onProgress(added, (e as Error).message.slice(0, 120));
    }
  }
  return added;
}

export interface ImportReport { title: string; ok: boolean; reason?: string }

/**
 * Stores problems written outside the app (for example in a chat). Each one still has to prove itself: its reference and its
 * brute-force solution are RUN on every test input and must agree, the starter must not already solve it, and the outputs stored are the
 * ones the reference produced. No AI call is made. Already stored titles are skipped.
 */
export async function importProblems(service: SupabaseClient, items: readonly unknown[]): Promise<ImportReport[]> {
  const { data: have } = await untyped(service).from("arena_challenges").select("title").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "leetcode").limit(2000);
  const titles = new Set(((have ?? []) as { title: string }[]).map((t) => t.title.toLowerCase()));
  const reports: ImportReport[] = [];
  for (const raw of items) {
    const parsed = GeneratedProblemSchema.safeParse(raw);
    const brute = (raw as { brute_solution?: unknown })?.brute_solution;
    const name = (raw as { title?: string })?.title ?? "(untitled)";
    if (!parsed.success) { reports.push({ title: name, ok: false, reason: `schema: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}` }); continue; }
    if (typeof brute !== "string" || brute.length < 5) { reports.push({ title: name, ok: false, reason: "brute_solution missing" }); continue; }
    if (titles.has(parsed.data.title.toLowerCase())) { reports.push({ title: name, ok: false, reason: "already stored" }); continue; }
    if ((await bankSize(service)) >= STREAM_BANK_CAP) { reports.push({ title: name, ok: false, reason: "bank is full" }); continue; }
    const v = await verifyProblem(parsed.data, {}, undefined, brute);
    if (!v.ok) { reports.push({ title: name, ok: false, reason: v.reason }); continue; }
    const stored = await store(service, null, v.value);
    if (stored) titles.add(parsed.data.title.toLowerCase());
    reports.push({ title: name, ok: stored, reason: stored ? undefined : "insert failed" });
  }
  return reports;
}

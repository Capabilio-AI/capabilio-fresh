// Once per Sunday-IST week, the IT cluster gets TARGET problems from the AI. A run claims a row in arena_weekly_generation so two
// requests (or a cron and a student) never generate twice; a run that stops early is continued by the next trigger.
import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { IT_CLUSTER_SCOPE_KEY } from "../branch-clusters";
import { currentStreamWeek } from "../week";
import { generateAndVerify, type VerifiedProblem } from "./generate";
import { TARGET_BY_DIFFICULTY, WEEKLY_TARGET } from "./problem";

const STALE_AFTER_MS = 6 * 60_000;
/** after a run ends short (quota, outage) automatic triggers wait this long before spending AI calls again */
const RETRY_COOLDOWN_MS = 15 * 60_000;
const TOPICS = ["Arrays", "Strings", "Hashing", "Two Pointers", "Sorting", "Stack", "Recursion", "Math", "Matrix", "Greedy", "Binary Search", "Prefix Sums", "Simulation", "Dynamic Programming"];
const MAX_CALLS = 10;
type Difficulty = keyof typeof TARGET_BY_DIFFICULTY;

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
  if (!cur || cur.status === "DONE") return false;
  if (cur.status === "RUNNING" && Date.now() - new Date(cur.started_at).getTime() < STALE_AFTER_MS) return false;
  if (cur.status === "FAILED" && !force && Date.now() - new Date(cur.started_at).getTime() < RETRY_COOLDOWN_MS) return false;
  // FAILED or stale: take it over, but only if nobody else did in the meantime (compare-and-set on started_at)
  const { data: won } = await db.from("arena_weekly_generation").update({ status: "RUNNING", started_at: row.started_at }).eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("week_start", weekStart).eq("started_at", cur.started_at).select("week_start");
  return (won?.length ?? 0) > 0;
}

async function store(service: SupabaseClient, weekStart: string, v: VerifiedProblem): Promise<boolean> {
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

/** Fills this week's pool up to the targets. Safe to call from anywhere, any number of times. Returns how many problems it added. */
export async function generateWeeklyChallenges(service: SupabaseClient, budgetMs = 240_000, force = false): Promise<{ added: number; claimed: boolean }> {
  const weekStart = currentStreamWeek();
  if (!(await claim(service, weekStart, force))) return { added: 0, claimed: false };
  const started = Date.now();
  let added = 0;
  let note = "";
  try {
    const { counts } = await weeklyPool(service);
    const { data: titles } = await untyped(service).from("arena_challenges").select("title").eq("track", "stream").eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("kind", "leetcode").limit(200);
    const avoid = ((titles ?? []) as { title: string }[]).map((t) => t.title);
    let calls = 0;
    for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
      while (counts[d] < TARGET_BY_DIFFICULTY[d] && calls < MAX_CALLS && Date.now() - started < budgetMs) {
        calls++;
        const need = TARGET_BY_DIFFICULTY[d] - counts[d];
        const out = await generateAndVerify({ difficulty: d, count: Math.min(2, need + 1), topics: topicsFor(weekStart), avoidTitles: avoid });
        for (const v of out.verified.slice(0, need)) {
          if (await store(service, weekStart, v)) { counts[d]++; added++; avoid.push(v.problem.title); }
        }
        if (out.rejected.length) note = out.rejected.slice(0, 3).join(" | ").slice(0, 400);
      }
    }
  } catch (e) {
    note = e instanceof Error ? e.message.slice(0, 300) : "unknown error";
  }
  const { total } = await weeklyPool(service);
  await untyped(service).from("arena_weekly_generation").update({ status: total >= WEEKLY_TARGET ? "DONE" : "FAILED", note }).eq("scope_key", IT_CLUSTER_SCOPE_KEY).eq("week_start", weekStart);
  return { added, claimed: true };
}

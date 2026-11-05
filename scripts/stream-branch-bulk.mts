// Fills the shared Stream bank of the lab branches (ECE, EEE, Mechanical, Civil and their kin) with hands-on missions only, ahead of time,
// so students are served from the database, not the AI.
//   npm run stream:branch-bulk -- 1000                  (top every lab branch up to 1000 missions)
//   npm run stream:branch-bulk -- 1000 civil mechanical (only branches whose name contains one of these words)
//   add --ai to have the model write each story (slow); the default uses each lab's own story, with the same numbers and the same checks.
// IT branches are skipped: their bank is code, SQL and debugging tasks (npm run it:workbench, it:debug), never simulations.
// Every mission is validated before it is stored (some settings win, the starting ones do not) and no lab set-up is stored twice.
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { BRANCH_CATALOG } from "@/lib/branch-catalog";
import { clusterKeyForBranch, IT_CLUSTER_SCOPE_KEY, promptLabelForBranch } from "@/lib/arena-challenges/branch-clusters";
import { BRANCH_BANK_CAP, branchRunKey, generatePersonal } from "@/lib/arena-challenges/stream-ai/personal";
import { labFamily, labsFor } from "@/lib/arena-challenges/missions/registry";
import { realStoryDeps, type StoryDeps } from "@/lib/arena-challenges/missions/story";
import type { StreamScope } from "@/lib/arena-challenges/resolve-scope";
import { planDifficulties } from "@/lib/arena-challenges/stream-ai/plan";

const args = process.argv.slice(2);
const useAi = args.includes("--ai");
const [first, ...rest] = args.filter((a) => a !== "--ai");
const target = Number(first);
const words = rest.map((w) => w.toLowerCase());
if (!Number.isInteger(target) || target < 1 || target > BRANCH_BANK_CAP) throw new Error(`Usage: npm run stream:branch-bulk -- <missions per branch, max ${BRANCH_BANK_CAP}> [branch words...] [--ai]`);

const service = createServiceClient();
const CHUNK = 9; // one generation run is capped at a week's largest batch
const noAi: StoryDeps = { llm: async () => { throw new Error("templated story"); } };
// one entry per shared bank: every IT-related branch uses the single it-cluster bank
const seenScopes = new Set<string>();
const branches = BRANCH_CATALOG.map((b) => b.name).filter((name) => {
  if (labFamily(name) === null || labFamily(name) === "it" || !(words.length === 0 || words.some((w) => name.toLowerCase().includes(w)))) return false;
  const key = clusterKeyForBranch(name);
  if (seenScopes.has(key)) return false;
  seenScopes.add(key);
  return true;
});

for (const branch of branches) {
  const scopeKey = clusterKeyForBranch(branch);
  const scope: StreamScope = { scopeKey, promptLabel: promptLabelForBranch(branch), branch, branchKey: scopeKey === IT_CLUSTER_SCOPE_KEY ? IT_CLUSTER_SCOPE_KEY : branch.trim().toLowerCase() };
  const count = async () => (await untyped(service).from("arena_challenges").select("id", { count: "exact", head: true }).eq("track", "stream").eq("scope_key", scope.scopeKey).is("user_id", null).eq("kind", "mission").eq("source", "AI_WEEKLY")).count ?? 0;
  // the branch's published curriculum courses that a lab actually teaches: each mission is tagged with one, so it reaches students who take that course
  const family = labFamily(branch)!;
  const keywords = labsFor(family).flatMap((l) => l.keywords);
  const { data: imp } = await untyped(service).from("curriculum_imports").select("id").eq("branch_key", scope.branchKey).eq("status", "PUBLISHED").is("deleted_at", null).order("published_at", { ascending: false }).limit(1);
  const { data: rows } = imp?.[0] ? await untyped(service).from("courses").select("title, year").eq("import_id", imp[0].id).is("deleted_at", null) : { data: [] };
  const courses = ((rows ?? []) as { title: string; year: number }[]).filter((c) => keywords.some((k) => c.title.toLowerCase().includes(k)) && !/\blab\b/i.test(c.title)).map((c) => ({ title: c.title, year: c.year }));
  console.log(`${branch}: ${courses.length} curriculum courses with a matching lab`);
  const before = await count();
  let stalled = 0;
  for (let have = before; have < target && stalled < 3; have = await count()) {
    const k = Math.min(CHUNK, target - have);
    const e = Math.round(k / 3), m = Math.round(k / 2);
    const plan = planDifficulties({ easy: e, medium: m, hard: Math.max(0, k - e - m) });
    // a manual bulk run owns the branch: clear a lock left by a killed run or the cool-down after a short round
    await untyped(service).from("arena_weekly_generation").delete().eq("scope_key", branchRunKey(scope.scopeKey));
    const got = await generatePersonal(service, { userId: null, scope, student: { currentYear: null, courses }, count: k, points: 0 }, plan, undefined, undefined, useAi ? realStoryDeps : noAi);
    stalled = got === 0 ? stalled + 1 : 0; // a claimed run, an outage or an exhausted lab: give up on this branch after three empty rounds
    if (have % 90 < CHUNK) console.log(`  ${branch}: ${have + got}`);
  }
  console.log(`${branch}: ${before} -> ${await count()}`);
}

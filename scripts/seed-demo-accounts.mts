// DEMO DATA, NOT REAL EVIDENCE. Creates (or refreshes) two final-year demo students for presentations: a Data Scientist and an AI/ML Engineer,
// both in "Capabilio Test College", with an assessed profile and the layers added by seed-demo/*. Every account is @capabilio.test.
// Re-running refreshes the accounts and adds nothing twice (demo rows are keyed by deterministic ids and replaced).
//   node --env-file=.env.local --import tsx scripts/seed-demo-accounts.mts
// The password is DEMO_ACCOUNTS_PASSWORD when set, otherwise generated and printed once.
import { randomBytes, randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { loadCareerSkills, type Db } from "@/lib/assess/db";
import { computeSkillGraph } from "@/lib/assess/finalize";
import { nextBestAction } from "@/lib/assess/scoring";
import { DEMOS, type Demo } from "./seed-demo/people";
import { rngFor } from "./seed-demo/rng";
import { seedArena } from "./seed-demo/arena";
import { seedInterviews } from "./seed-demo/interviews";
import { seedCrt, seedGithub, seedLaunchpad, seedRoadmap, seedStream } from "./seed-demo/extras";

// ONLY=<slug> runs one account; ARENA=<n> sets how many Arena tickets (default 28)
const only = process.env.ONLY;
const ARENA_TICKETS = Number(process.env.ARENA ?? 28);

const COLLEGE = "Capabilio Test College";
const BRANCH = "Computer Science and Engineering (CSE)";
const PROGRAM_YEARS = 4;
const db = createServiceClient() as any;
const password = process.env.DEMO_ACCOUNTS_PASSWORD || randomBytes(12).toString("base64url") + "!9a";

const now = new Date();
const batchYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
const FINAL_YEAR_START = batchYear - (PROGRAM_YEARS - 1);

const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const findUser = (email: string) => list?.users?.find((u: { email?: string }) => u.email === email);

async function ensureUser(d: Demo): Promise<string> {
  const existing = findUser(d.email);
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { full_name: d.name } });
    return existing.id as string;
  }
  const { data, error } = await db.auth.admin.createUser({ email: d.email, password, email_confirm: true, user_metadata: { full_name: d.name, college_name: COLLEGE, branch: BRANCH, start_year: String(FINAL_YEAR_START), end_year: String(FINAL_YEAR_START + PROGRAM_YEARS) } });
  if (error) throw error;
  return data.user.id as string;
}

const { data: inst } = await db.from("institutions").select("id").eq("name", COLLEGE).single();
const { data: careers } = await db.from("careers").select("id, key");
const careerOf = (key: string) => careers.find((c: { key: string }) => c.key === key)?.id as string;

async function seedAccount(d: Demo) {
  const id = await ensureUser(d);
  const stamp = now.toISOString();
  await db.from("profiles").update({
    full_name: d.name, headline: d.headline, bio: d.bio, location: d.location, has_seen_career_direction_intro: true,
    portfolio_slug: d.slug, portfolio_public: true, pulse_discoverable: true, pulse_show_career: true, passport_public: true,
  }).eq("id", id);

  const row = { institution_id: inst.id, status: "active", branch: BRANCH, start_year: FINAL_YEAR_START, end_year: FINAL_YEAR_START + PROGRAM_YEARS, year_confirmed_at: stamp, current_semester: now.getMonth() >= 6 ? 1 : 2, semester_confirmed_at: stamp, goal_state: "job", goal_state_updated_at: stamp, roll_number: d.roll };
  const { data: have } = await db.from("institution_memberships").select("id").eq("user_id", id).eq("role", "student").maybeSingle();
  const { error: memError } = have ? await db.from("institution_memberships").update(row).eq("id", have.id) : await db.from("institution_memberships").insert({ ...row, user_id: id, role: "student" });
  if (memError) throw memError;

  await db.from("student_onboarding").upsert({ student_id: id, status: "PROFILE_READY", updated_at: stamp }, { onConflict: "student_id" });
  const careerId = careerOf(d.careerKey);
  await db.from("student_career_intent").delete().eq("student_id", id);
  const { error: intentError } = await db.from("student_career_intent").insert({ student_id: id, primary_career_id: careerId, plan_b_kind: "same_role", plan_b_decided_at: stamp });
  if (intentError) throw intentError;
  return { id, careerId };
}

/**
 * The role assessment, the way the engine records one: a screening answer per question as evidence, the graph computed from that evidence (so no skill can
 * pass the screening ceiling without practical work), then the session result, the ELO event and the first snapshot. Arena work is added afterwards.
 */
async function seedAssessment(d: Demo, userId: string, careerId: string) {
  const skills = await loadCareerSkills(db as Db, careerId);
  const rng = rngFor(d.slug, "assessment");
  const completedAt = new Date(now.getTime() - 83 * 864e5).toISOString();
  await db.from("student_skill_evidence").delete().eq("student_id", userId).eq("career_id", careerId).eq("source", "ASSESSMENT_CAREER");
  const DIFFS = ["EASY", "MEDIUM", "HARD"];
  const rows: Record<string, unknown>[] = [];
  let correct = 0;
  skills.forEach((k, i) => {
    const n = Math.max(1, Math.min(k.max, k.min + (rng() < 0.5 ? 1 : 0)));
    for (let j = 0; j < n; j++) {
      const isCorrect = rng() < 0.52 + d.strength * 0.3;
      if (isCorrect) correct++;
      rows.push({ student_id: userId, career_id: careerId, skill_id: k.skillId, skill_label: k.name, source: "ASSESSMENT_CAREER", source_id: randomUUID(), correct: isCorrect, difficulty: DIFFS[(i + j) % 3], response_ms: 16000 + Math.round(rng() * 40000), created_at: completedAt });
    }
  });
  const { error: evError } = await db.from("student_skill_evidence").insert(rows);
  if (evError) throw evError;
  const graph = await computeSkillGraph(db as Db, userId, careerId);
  const answered = rows.length;
  const incorrect = answered - correct;
  const startingElo = 400;
  const gained = correct * 9;
  const lost = incorrect * 5;
  const net = gained - lost;
  const result = {
    layer: "CAREER", completedAt, career: { id: careerId, key: d.careerKey, name: d.careerName },
    elo: { net, lost, gained, newElo: startingElo + net, correct, answered, incorrect, startingElo },
    readiness: graph.readiness, coverage: graph.coverage, skills: graph.results, strongest: graph.highlights.strongest, focusAreas: graph.highlights.focusAreas, notYetMeasured: graph.highlights.notYetMeasured,
    nextBestAction: nextBestAction(graph.highlights), general: null,
  };
  const sessionId = randomUUID();
  await db.from("assess_sessions").delete().eq("student_id", userId).eq("layer", "CAREER").eq("career_id", careerId);
  const { error } = await db.from("assess_sessions").insert({ id: sessionId, student_id: userId, layer: "CAREER", career_id: careerId, status: "COMPLETED", total_questions: answered, starting_elo: startingElo, started_at: new Date(new Date(completedAt).getTime() - 31 * 60e3).toISOString(), completed_at: completedAt, result });
  if (error) throw error;
  await db.from("elo_events").delete().eq("student_id", userId).eq("career_id", careerId).eq("source", "ASSESSMENT_CAREER");
  await db.from("elo_events").insert({ student_id: userId, career_id: careerId, source: "ASSESSMENT", source_id: sessionId, previous_rating: startingElo, change: net, new_rating: startingElo + net, reason: "demo account: role assessment", created_at: completedAt });
  await db.from("student_career_elo").upsert({ student_id: userId, career_id: careerId, rating: startingElo + net }, { onConflict: "student_id,career_id" });
  await db.from("student_skill_scores").upsert(graph.results.map((r) => ({ student_id: userId, skill_id: r.skillId, score: r.score, confidence: r.confidence, evidence_count: r.evidenceCount, updated_at: completedAt })), { onConflict: "student_id,skill_id" });
  const { count } = await db.from("career_skill_graph_snapshots").select("id", { count: "exact", head: true }).eq("student_id", userId).eq("career_id", careerId).eq("session_id", sessionId);
  if (!count) {
    const { error: snapError } = await db.from("career_skill_graph_snapshots").insert({ student_id: userId, career_id: careerId, session_id: sessionId, trigger: "ASSESSMENT", elo: startingElo + net, readiness: graph.readiness, skills: graph.results.map((s) => ({ skillId: s.skillId, key: s.key, name: s.name, score: s.score, confidence: s.confidence, evidenceCount: s.evidenceCount, proof: s.proof, importance: s.importance, targetLevel: s.targetLevel })), created_at: completedAt });
    if (snapError) throw snapError;
  }
  return { sessionId, readiness: graph.readiness };
}

console.log(`\nCollege: ${COLLEGE}\nPassword for the demo accounts: ${password}\n`);
// LAYERS picks what to (re)write, so a layer can be added without repeating the others: assessment and arena append skill-graph snapshots that cannot be removed.
const layers = new Set((process.env.LAYERS ?? "assessment,arena,interviews,stream,github,crt,launchpad,roadmap").split(","));
const seeded: { userId: string; careerName: string }[] = [];
for (const d of DEMOS.filter((x) => !only || x.slug === only)) {
  const { id, careerId } = await seedAccount(d);
  console.log(`${d.name}  <${d.email}>  user ${id}  career ${d.careerName}`);
  const roleKey = d.careerKey as "data-scientist" | "ai-ml-engineer";
  if (layers.has("assessment")) {
    const a = await seedAssessment(d, id, careerId);
    console.log(`  assessment readiness ${a.readiness}%`);
  }
  if (layers.has("arena")) {
    const { data: elo } = await db.from("elo_events").select("new_rating").eq("student_id", id).eq("career_id", careerId).eq("source", "ASSESSMENT").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const arena = await seedArena(db, { slug: d.slug, roleKey }, id, careerId, elo?.new_rating ?? 400, ARENA_TICKETS);
    console.log(`  Arena: ${arena.passed} passed, ${arena.missed} missed`);
  }
  if (layers.has("interviews")) console.log(`  AI interviews: ${await seedInterviews(db, id, roleKey, d.careerName)}`);
  if (layers.has("stream")) { const st = await seedStream(db, d.slug, id, Number(process.env.STREAM ?? 26)); console.log(`  Common challenges: ${st.total} (${st.correct} correct)`); }
  if (layers.has("github")) console.log(`  GitHub score: ${await seedGithub(db, { slug: d.slug, name: d.name, careerKey: d.careerKey }, id)}`);
  if (layers.has("crt")) console.log(`  CRT results: ${(await seedCrt(db, { slug: d.slug }, id, inst.id, BRANCH)).join("% then ")}%`);
  if (layers.has("roadmap")) { const r = await seedRoadmap(db, { slug: d.slug }, id, careerId); console.log(`  Roadmap: ${r.done} of ${r.total} topics done`); }
  seeded.push({ userId: id, careerName: d.careerName });
}
if (layers.has("launchpad")) console.log(`Launchpad: ${await seedLaunchpad(db, inst.id, seeded)} company visits`);

// Server side of a mission: the only place a test result, a hint or points are produced. The client sends settings, never results.
import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { addChallengePoints } from "../award";
import { activeControls, defaultSettings, normalizeSettings } from "./grid";
import { hintFor } from "./hints";
import { labByKey } from "./registry";
import { MAX_HINTS, missionScore, type MissionScore } from "./score";
import { hashSeed } from "@/lib/workplace/rng";
import { assumptionsFor } from "./notes";
import { sceneFor } from "./scenes";
import type { AnyLab, Control, Difficulty, HistoryEntry, MissionFormat, Outcome, Scene, Settings } from "./types";

const MAX_TRIED = 60;
const MAX_HISTORY = 12;

export interface MissionSpec { v: 1; lab: string; scenario: unknown }

interface Loaded {
  id: string;
  difficulty: Difficulty;
  scopeKey: string;
  title: string;
  lab: AnyLab;
  scenario: unknown;
}

interface AttemptRow {
  runs: number;
  hints: number;
  tried: string[];
  hint_log: string[];
  last_settings: Settings | null;
  history: HistoryEntry[] | null;
  passed: boolean;
  points: number | null;
}

export interface MissionView {
  challengeId: string;
  lab: { name: string; topic: string; format: MissionFormat; tools: string[]; assumptions: string };
  /** a drawing of the set-up as currently configured (the last tested settings), or null for labs without one */
  scene: Scene | null;
  /** the student's recent experiments, oldest first */
  history: HistoryEntry[];
  given: { label: string; value: string }[];
  mission: string;
  controls: Control[];
  settings: Settings;
  /** null until the first test: the starting settings are never judged */
  outcome: Outcome | null;
  /** the requirements, before any test, with no verdict */
  requirements: { id: string; label: string }[];
  runs: number;
  distinctRuns: number;
  hintsUsed: number;
  maxHints: number;
  hintLog: string[];
  passed: boolean;
  score: MissionScore | null;
  explanation: string | null;
}

export type MissionError = { error: string; status: number };
const fail = (error: string, status: number): MissionError => ({ error, status });

export async function loadMission(service: SupabaseClient, userId: string, challengeId: string): Promise<Loaded | MissionError> {
  const { data } = await untyped(service)
    .from("arena_challenges")
    .select("id, title, difficulty, scope_key, problem")
    .eq("id", challengeId)
    .eq("track", "stream")
    .eq("kind", "mission")
    .eq("active", true)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .maybeSingle();
  const row = data as { id: string; title: string; difficulty: Difficulty; scope_key: string; problem: MissionSpec | null } | null;
  if (!row?.problem) return fail("Mission not found.", 404);
  const lab = labByKey(row.problem.lab);
  if (!lab) return fail("This mission's lab is not available.", 404);
  return { id: row.id, difficulty: row.difficulty, scopeKey: row.scope_key, title: row.title, lab, scenario: row.problem.scenario };
}

async function getAttempt(service: SupabaseClient, userId: string, challengeId: string): Promise<AttemptRow> {
  const db = untyped(service);
  await db.from("arena_mission_attempts").upsert({ user_id: userId, challenge_id: challengeId }, { onConflict: "user_id,challenge_id", ignoreDuplicates: true });
  const { data } = await db.from("arena_mission_attempts").select("runs, hints, tried, hint_log, last_settings, history, passed, points").eq("user_id", userId).eq("challenge_id", challengeId).single();
  return data as AttemptRow;
}

/** inactive controls never count as a different experiment */
function fingerprint(controls: Control[], settings: Settings): string {
  const live = new Set(activeControls(controls, settings).map((c) => c.id));
  return String(hashSeed(...controls.map((c) => `${c.id}=${live.has(c.id) ? settings[c.id] : "-"}`)));
}

function view(m: Loaded, a: AttemptRow, score: MissionScore | null): MissionView {
  const controls = m.lab.controls(m.scenario);
  const norm = a.last_settings ? normalizeSettings(controls, a.last_settings) : null;
  const settings = norm?.ok ? norm.settings : defaultSettings(controls);
  const outcome = a.runs > 0 ? m.lab.evaluate(m.scenario, settings) : null;
  return {
    challengeId: m.id,
    lab: { name: m.lab.name, topic: m.lab.topic, format: m.lab.format, tools: m.lab.tools, assumptions: assumptionsFor(m.lab.key, m.lab.family) },
    scene: sceneFor(m.lab.key, m.scenario, settings),
    history: (a.history ?? []).slice(-MAX_HISTORY),
    given: m.lab.given(m.scenario),
    mission: m.lab.mission(m.scenario),
    controls,
    settings,
    outcome,
    requirements: m.lab.evaluate(m.scenario, defaultSettings(controls)).objectives.map((o) => ({ id: o.id, label: o.label })),
    runs: a.runs,
    distinctRuns: a.tried.length,
    hintsUsed: a.hints,
    maxHints: MAX_HINTS,
    hintLog: a.hint_log,
    passed: a.passed,
    score,
    explanation: a.passed && outcome ? m.lab.explain(m.scenario, settings, outcome) : null,
  };
}

const savedScore = (m: Loaded, a: AttemptRow): MissionScore | null => (a.passed ? missionScore(m.difficulty, a.hints, a.tried.length) : null);

export async function getMissionState(service: SupabaseClient, userId: string, challengeId: string): Promise<MissionView | MissionError> {
  const m = await loadMission(service, userId, challengeId);
  if ("error" in m) return m;
  const a = await getAttempt(service, userId, challengeId);
  const v = view(m, a, savedScore(m, a));
  return a.passed && a.points !== null && v.score ? { ...v, score: { ...v.score, total: a.points } } : v;
}

/** Runs one test. A passing test completes the mission and awards its points exactly once. */
export async function runMissionTest(service: SupabaseClient, userId: string, challengeId: string, rawSettings: unknown): Promise<MissionView | MissionError> {
  const m = await loadMission(service, userId, challengeId);
  if ("error" in m) return m;
  const controls = m.lab.controls(m.scenario);
  const norm = normalizeSettings(controls, rawSettings);
  if (!norm.ok) return fail(norm.error, 400);
  const a = await getAttempt(service, userId, challengeId);
  if (a.passed) return fail("You have already completed this mission.", 409);

  const outcome = m.lab.evaluate(m.scenario, norm.settings);
  const print = fingerprint(controls, norm.settings);
  const tried = a.tried.includes(print) || a.tried.length >= MAX_TRIED ? a.tried : [...a.tried, print];
  const db = untyped(service);
  const entry: HistoryEntry = { settings: norm.settings, met: outcome.objectives.filter((o) => o.ok).length, total: outcome.objectives.length };
  const history = [...(a.history ?? []), entry].slice(-MAX_HISTORY);
  const next: AttemptRow = { ...a, runs: a.runs + 1, tried, last_settings: norm.settings, history };
  const { error } = await db.from("arena_mission_attempts").update({ runs: next.runs, tried, last_settings: norm.settings, history }).eq("user_id", userId).eq("challenge_id", challengeId);
  if (error) return fail("Could not record the test. Try again.", 500);

  if (!outcome.passed) return view(m, next, null);

  // the guard `passed = false` means a double click or a second tab can only complete the mission once
  const score = missionScore(m.difficulty, a.hints, tried.length);
  const nowIso = new Date().toISOString();
  const { data: won } = await db.from("arena_mission_attempts").update({ passed: true, points: score.total, completed_at: nowIso }).eq("user_id", userId).eq("challenge_id", challengeId).eq("passed", false).select("user_id");
  if (!won || won.length === 0) return fail("You have already completed this mission.", 409);
  try {
    const { error: completionError } = await db.from("arena_challenge_completions").upsert(
      { user_id: userId, challenge_id: challengeId, track: "stream", scope_key: m.scopeKey, code_submitted: `Mission ${m.lab.key}: ${JSON.stringify(norm.settings)}`, is_correct: true, elo_delta: score.total, completed_at: nowIso },
      { onConflict: "user_id,challenge_id" }
    );
    if (completionError) throw completionError;
    await addChallengePoints(service as never, userId, score.total, nowIso);
  } catch (e) {
    console.error("[arena/missions] completion failed, reopening the mission:", e);
    await db.from("arena_mission_attempts").update({ passed: false, points: null, completed_at: null }).eq("user_id", userId).eq("challenge_id", challengeId);
    return fail("The mission passed but your points could not be saved. Run the test again.", 500);
  }
  return view(m, { ...next, passed: true, points: score.total }, score);
}

export async function takeMissionHint(service: SupabaseClient, userId: string, challengeId: string, rawSettings: unknown): Promise<MissionView | MissionError> {
  const m = await loadMission(service, userId, challengeId);
  if ("error" in m) return m;
  const controls = m.lab.controls(m.scenario);
  const norm = normalizeSettings(controls, rawSettings ?? {});
  if (!norm.ok) return fail(norm.error, 400);
  const a = await getAttempt(service, userId, challengeId);
  if (a.passed) return fail("You have already completed this mission.", 409);
  if (a.hints >= MAX_HINTS) return fail("You have used all the hints for this mission.", 409);

  const level = (a.hints + 1) as 1 | 2 | 3;
  const text = hintFor(m.lab, m.scenario, norm.settings, m.lab.evaluate(m.scenario, norm.settings), level);
  const next: AttemptRow = { ...a, hints: level, hint_log: [...a.hint_log, text] };
  // the compare on `hints` stops two quick clicks from spending two hints on one request
  const { data: ok } = await untyped(service).from("arena_mission_attempts").update({ hints: level, hint_log: next.hint_log }).eq("user_id", userId).eq("challenge_id", challengeId).eq("hints", a.hints).select("user_id");
  if (!ok || ok.length === 0) return fail("Try again.", 409);
  return view(m, next, null);
}

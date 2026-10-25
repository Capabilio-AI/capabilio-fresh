import { appendFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { afterAll, describe, expect, it } from "vitest";
import { completeJson } from "@/lib/ai/groq";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { referenceSubmission } from "@/lib/arena-workstations/reference-submission";

/**
 * The Proof Session through the REAL running app: every call is an HTTP request to the built server with a signed-in student's session cookie, so
 * authentication, the proxy, rate limits, route handlers and the database are all exercised together.
 *
 *   LIVE_BASE_URL=http://localhost:3100 npm run test:live -- lib/arena-roles/session/session.http.live.test.ts
 *
 * Skipped unless LIVE_BASE_URL is set. Uses throwaway students that are deleted afterwards.
 */
const BASE = process.env.LIVE_BASE_URL;
const service = liveServiceClient();
const users: string[] = [];
/** Observations worth reading afterwards (vitest swallows console output); written to LIVE_NOTES when set. */
const note = (line: string) => process.env.LIVE_NOTES && appendFileSync(process.env.LIVE_NOTES, `${line}\n`);

/** A student's browser, as far as the server can tell: a cookie jar filled by the real Supabase sign-in, in the real cookie format. */
async function signIn(login: { email: string; password: string }) {
  const jar = new Map<string, string>();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (all) => all.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword(login);
  if (error) throw error;
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  return async (method: "GET" | "POST", path: string, body?: unknown) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: { cookie, "content-type": "application/json", origin: BASE! }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    const text = await res.text();
    let json: Record<string, any> | null = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, json, text, location: res.headers.get("location") };
  };
}
type Api = Awaited<ReturnType<typeof signIn>>;

/** What each role's session should look like. Dimensions are what the test's own behaviour (a plan and the brief before each stage, a miss then a fix) must produce. */
interface RoleCase {
  label: string;
  careerKey: string;
  firstStage: string;
  areas: string[];
  titleRe: RegExp;
  claimRe: RegExp;
  persona: string;
  dims: Record<string, number | null>;
}
const ROLES: RoleCase[] = [
  {
    label: "IT-01 Data Analyst", careerKey: "data-analyst", firstStage: "prepare", areas: ["data_cleaning", "sql", "spreadsheet", "dashboard", "statistics"], titleRe: /evidence-backed recommendation/,
    claimRe: /^Completed 5 of 5 stage\(s\) of a simulated BrightCart analysis; passed \d+ of \d+ assessment checks\.$/, persona: "a data analyst candidate who just finished a five-stage analysis",
    dims: { planning: 3, analysis: 1, discovery: 1, judgement: 3, execution: 3, aiCollaboration: null },
  },
  {
    label: "IT-02 Backend Developer", careerKey: "backend-developer", firstStage: "build", areas: ["rest-api", "auth-and-security", "data-and-state", "error-handling", "backend-debugging"], titleRe: /Build, secure, harden and debug a small API/,
    claimRe: /^Completed 5 of 5 stage\(s\) of a simulated backend API work session; passed \d+ of \d+ assessment checks\.$/, persona: "a backend developer candidate who just finished a five-stage API exercise",
    // no stage of the code workstation reports exploration, so Discovery is not assessed
    dims: { planning: 3, analysis: 1, discovery: null, judgement: 3, execution: 3, aiCollaboration: null },
  },
];

const newStudent = async (label: string, role: string | null) => {
  const login = await createThrowawayUserWithLogin(service, label);
  users.push(login.userId);
  if (role) {
    const { data: career } = await service.from("careers").select("id").eq("key", role).single();
    const { error } = await service.from("student_career_intent").upsert({ student_id: login.userId, primary_career_id: career!.id });
    if (error) throw error;
  }
  return { ...login, api: await signIn(login) };
};

async function referenceFor(challengeId: string) {
  const { data } = await service.from("arena_challenges").select("answer_key, content, tool_type").eq("id", challengeId).single();
  return data!;
}

afterAll(async () => {
  for (const id of users) await deleteThrowawayUser(service, id);
});

describe.skipIf(!BASE).each(ROLES)("Proof Session over HTTP: $label", (cfg) => {
  let api: Api;
  let userId: string;
  let sessionId: string;
  let anchorAttemptId: string;
  const attempts: string[] = [];

  it("refuses a visitor with no session", async () => {
    for (const [method, path] of [["GET", "/api/arena/sessions"], ["POST", "/api/arena/sessions"], ["POST", "/api/arena/sessions/x/stage"], ["POST", "/api/arena/sessions/x/events"], ["GET", "/api/arena/sessions/x/report"]] as const) {
      const res = await fetch(`${BASE}${path}`, { method, redirect: "manual" });
      expect([401, 307, 308], `${method} ${path} -> ${res.status}`).toContain(res.status);
    }
  });

  it("says there is no Proof Session for a student whose career has no workstation, and will not start one", async () => {
    const nobody = await newStudent("http-norole", null);
    const get = await nobody.api("GET", "/api/arena/sessions");
    expect(get.status).toBe(200);
    expect(get.json).toMatchObject({ available: false, session: null });
    const start = await nobody.api("POST", "/api/arena/sessions");
    expect(start.status).toBe(409);
    expect(start.json?.reason).toBe("no_role");
    // and the daily ticket is not silently given to another role
    const daily = await nobody.api("POST", "/api/arena/domain/attempts", {});
    expect(daily.status).toBe(409);
    expect(daily.json?.reason).toBe("no_role");
  });

  it("starts a Proof Session for a student of this role", async () => {
    const s = await newStudent("http-role", cfg.careerKey);
    api = s.api;
    userId = s.userId;
    const before = await api("GET", "/api/arena/sessions");
    expect(before.json).toMatchObject({ available: true, session: null });
    const start = await api("POST", "/api/arena/sessions");
    expect(start.status).toBe(200);
    const session = start.json!.session;
    sessionId = session.session.id;
    expect(session.stages.map((x: { areaKey: string }) => x.areaKey)).toEqual(cfg.areas);
    expect(session.current).toBe(cfg.firstStage);
    expect((await api("POST", "/api/arena/sessions")).json!.session.session.id).toBe(sessionId); // asking again returns the same one
  });

  it("holds the daily ticket back while the session is open", async () => {
    const state = await api("GET", "/api/arena/domain");
    expect(state.status).toBe(200);
    expect(state.json?.state).toBe("in_session");
    const daily = await api("POST", "/api/arena/domain/attempts", {});
    expect(daily.status).toBe(409);
    expect(daily.json?.reason).toBe("session_open");
  });

  it("accepts only what a browser may report, and keeps the answer key out of every response", async () => {
    expect((await api("POST", `/api/arena/sessions/${sessionId}/events`, { kind: "brief_viewed" })).status).toBe(200);
    expect((await api("POST", `/api/arena/sessions/${sessionId}/events`, { kind: "plan_note", words: 12 })).status).toBe(200);
    for (const forged of [{ kind: "submitted", passed: true }, { kind: "check_run", passed: 9, total: 9 }, { kind: "query_run", sqlHash: "x", ok: true }]) {
      expect((await api("POST", `/api/arena/sessions/${sessionId}/events`, forged)).status, JSON.stringify(forged)).toBe(400);
    }
  });

  it("works through the five stages: wrong answers fail, the reference answer passes, nothing is rated or put on cooldown", async () => {
    for (let i = 0; i < 5; i++) {
      // what the screen does before it opens a stage: report the plan's length (never its text) and that the brief was shown
      expect((await api("POST", `/api/arena/sessions/${sessionId}/events`, { kind: "plan_note", words: 12 })).status).toBe(200);
      expect((await api("POST", `/api/arena/sessions/${sessionId}/events`, { kind: "brief_viewed" })).status).toBe(200);
      const startedAt = Date.now();
      const stage = await api("POST", `/api/arena/sessions/${sessionId}/stage`);
      note(`${cfg.label} stage ${i + 1} generated in ${Math.round((Date.now() - startedAt) / 1000)}s (${stage.json?.attempt?.challenge?.tool_type ?? "?"}, ${stage.json?.attempt?.challenge?.title ?? ""})`);
      expect(stage.status, stage.text.slice(0, 200)).toBe(200);
      expect(stage.text).not.toContain("answer_key");
      const attempt = stage.json!.attempt;
      attempts.push(attempt.attemptId);
      expect((await api("POST", `/api/arena/sessions/${sessionId}/stage`)).json!.attempt.attemptId).toBe(attempt.attemptId); // the same stage again

      const inst = await referenceFor(attempt.challenge.id);
      if (inst.tool_type === "sql_workspace") {
        const run = await api("POST", `/api/arena/domain/attempts/${attempt.attemptId}/run`, { query: "SELECT 1 AS one", explore: true });
        expect(run.status).toBe(200);
      }
      // a well-formed but wrong answer for this tool, so the grader really marks a miss (the stage must stay open)
      const wrongAnswer: Record<string, unknown> = {
        code_workspace: { language: "javascript", outputs: [] }, sql_workspace: { query: "SELECT 1" }, cleaning_workspace: { steps: [] }, spreadsheet_workspace: { cells: {} }, statistics_workspace: { answers: {} },
        dashboard_workspace: { spec: { chart_type: "pie", dimension: "nope", measure: null, aggregation: "count", filters: [], sort: "dimension_asc", limit: null, dimension_grain: "value" } },
      };
      const wrong = await api("POST", `/api/arena/domain/attempts/${attempt.attemptId}/submit`, { submission: wrongAnswer[inst.tool_type!] });
      expect(wrong.status, `${inst.tool_type}: ${wrong.text.slice(0, 200)}`).toBe(200);
      expect(wrong.json?.passed).toBe(false);

      const right = await api("POST", `/api/arena/domain/attempts/${attempt.attemptId}/submit`, { submission: referenceSubmission(inst.tool_type!, inst.content, inst.answer_key) });
      expect(right.status, right.text.slice(0, 300)).toBe(200);
      expect(right.json).toMatchObject({ passed: true, session: true });
    }
    anchorAttemptId = attempts[4];

    const { data: rows } = await service.from("arena_domain_assignments").select("status, completed_at, next_available_at").eq("user_id", userId);
    expect(rows).toHaveLength(5);
    expect(rows!.every((r) => r.status === "explaining" && r.completed_at === null && r.next_available_at === null)).toBe(true);
    const { data: done } = await service.from("arena_attempt_completions").select("attempt_id").eq("user_id", userId);
    expect(done).toHaveLength(0);

    const state = await api("GET", "/api/arena/sessions");
    expect(state.json!.session.current).toBeNull();
    expect(state.json!.anchorAttempt.attemptId).toBe(anchorAttemptId);
    expect((await api("POST", `/api/arena/sessions/${sessionId}/stage`)).status).toBe(409);
  }, 900_000); // each stage can wait on AI-written tickets

  it("will not interview from a middle stage", async () => {
    const early = await api("POST", `/api/arena/domain/attempts/${attempts[0]}/explain`, { action: "start" });
    expect(early.status).toBe(409);
    expect(early.json?.reason).toBe("not_anchor");
  });

  it("interviews on the whole session with real AI, scores it, and rates every stage on a good explanation", async () => {
    const start = await api("POST", `/api/arena/domain/attempts/${anchorAttemptId}/explain`, { action: "start" });
    expect(start.status, start.text.slice(0, 300)).toBe(200);
    expect(start.json!.questions).toHaveLength(4);
    expect(start.json!.task.title).toMatch(cfg.titleRe);

    // a candidate who really did this work: the answers are written from the real submission summary the interview itself shows
    const answerFor = async (questions: string[], task: { submission: string; checks: string[] }) =>
      (await completeJson(
        `You are ${cfg.persona} and are being interviewed about it. Answer each question in 2-4 specific sentences, honestly and concretely, using only what you actually did below. Mention your checks, your assumptions and one thing you would do differently.\n\nWhat you submitted:\n${task.submission}\n\nChecks you passed: ${task.checks.join("; ")}\n\nQuestions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nRespond with JSON only: {"answers": [string, string, string, string]}`,
        "You write the candidate's interview answers.",
        z.object({ answers: z.array(z.string().min(20)).length(4) }),
        { task: "arena_task" }
      )).answers;

    let result = await api("POST", `/api/arena/domain/attempts/${anchorAttemptId}/explain`, { action: "submit", answers: await answerFor(start.json!.questions, start.json!.task) });
    expect(result.status, result.text.slice(0, 300)).toBe(200);
    if (result.json!.outcome === "retry") {
      const again = await api("POST", `/api/arena/domain/attempts/${anchorAttemptId}/explain`, { action: "start" });
      result = await api("POST", `/api/arena/domain/attempts/${anchorAttemptId}/explain`, { action: "submit", answers: await answerFor(again.json!.questions, again.json!.task) });
    }
    note(`interview outcome: ${result.json!.outcome}, score ${result.json!.score}, points ${result.json!.points}`);
    expect(result.json!.outcome).toBe("award");
    expect(result.json!.points).toBeGreaterThan(0);
  });

  it("leaves five ratings, five pieces of evidence, no cooldown and a finished session", async () => {
    const { data: completions } = await service.from("arena_attempt_completions").select("skill_area_key").eq("user_id", userId);
    expect(completions!.map((c) => c.skill_area_key).sort()).toEqual([...cfg.areas].sort());
    const { data: evidence } = await service.from("evidence").select("metadata").eq("user_id", userId);
    expect(evidence).toHaveLength(5);
    expect(evidence!.every((e) => typeof (e.metadata as { explanationScore?: number }).explanationScore === "number")).toBe(true);
    const state = await api("GET", "/api/arena/sessions");
    expect(state.json!.session).toBeNull();
    expect(state.json!.latestFinishedSessionId).toBe(sessionId);
    expect((await api("GET", "/api/arena/domain")).json?.state).toBe("ready"); // no cooldown from the session
  });

  it("gives the student their report", async () => {
    const res = await api("GET", `/api/arena/sessions/${sessionId}/report`);
    expect(res.status).toBe(200);
    const report = res.json!.report;
    expect(report.claim).toMatch(cfg.claimRe);
    expect(report.stages).toHaveLength(5);
    note("report dimensions: " + JSON.stringify(Object.fromEntries(Object.entries(report.dimensions).map(([k, v]) => [k, `${(v as { level: number | null }).level} (${(v as { basis: string }).basis})`]))));
    // read from what really happened in this session: a plan before every stage, the brief shown, one query run in the SQL stage, a miss then a fix on every stage
    const level = (d: string) => report.dimensions[d].level;
    expect({ planning: level("planning"), analysis: level("analysis"), discovery: level("discovery"), judgement: level("judgement"), execution: level("execution"), aiCollaboration: level("aiCollaboration") }).toEqual(cfg.dims);
    expect(report.dimensions.analysis.trusted).toBe(false);
    expect(report.dimensions.planning.trusted).toBe(false); // the plan's length comes from the browser
    expect(report.dimensions.judgement.trusted).toBe(true); // judgement comes from checks the server ran
    expect(res.text).not.toContain("answer_key");
    note("report dimensions: " + JSON.stringify(Object.fromEntries(Object.entries(report.dimensions).map(([k, v]) => [k, (v as { level: number | null }).level]))));
  });

  it("keeps another student out of this session over HTTP", async () => {
    const other = await newStudent("http-other", cfg.careerKey);
    for (const [method, path, body] of [["GET", `/api/arena/sessions/${sessionId}/report`], ["POST", `/api/arena/sessions/${sessionId}/stage`], ["POST", `/api/arena/sessions/${sessionId}/events`, { kind: "brief_viewed" }]] as const) {
      const res = await other.api(method, path, body);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    expect((await other.api("POST", `/api/arena/domain/attempts/${anchorAttemptId}/explain`, { action: "start" })).status).toBe(404);
    expect((await other.api("POST", `/api/arena/domain/attempts/${anchorAttemptId}/submit`, { submission: { query: "select 1" } })).status).toBe(404);
  });

  it("serves the Domain page to a signed-in student", async () => {
    const res = await api("GET", "/arena/challenges/domain");
    note(`domain page: ${res.status} ${res.status >= 300 ? `-> ${res.location ?? res.text.slice(0, 120)}` : `html ${res.text.length} bytes`}`);
    expect(res.status).toBeLessThan(500);
  });
});

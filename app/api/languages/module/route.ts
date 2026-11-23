import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { findTrack } from "@/lib/languages";
import { loadProgress } from "@/lib/languages/progress";
import { currentAssessment, emptyProof, loadModuleProofs, ProofConflict, publicChallenge, publicHtmlChallenge, publicSqlChallenge, recordProblem, submitAssessment } from "@/lib/languages/module-proof";
import { moduleStatuses, needsProblem, publicQuestion, unfinishedLessons } from "@/lib/languages/module-gate";
import { judge } from "@/lib/arena-challenges/leetcode/judge";
import { judgeSqlChallenge, MAX_SQL_CHARS } from "@/lib/languages/sql-judge";
import { judgePage } from "@/lib/languages/html-judge";
import { isHtmlChallenge, isSqlChallenge, type ModuleChallenge, type Track, type TrackModule } from "@/lib/languages/types";

export const maxDuration = 120;

const Get = z.object({ track: z.string().max(20), module: z.string().max(80) });
const Post = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assessment"), track: z.string().max(20), module: z.string().max(80), answers: z.record(z.string().max(120), z.number().int().min(0).max(3)) }),
  z.object({ action: z.enum(["run", "submit"]), track: z.string().max(20), module: z.string().max(80), code: z.string().min(1).max(20000) }),
]);

type Ctx = { track: Track; m: TrackModule; row: ReturnType<typeof emptyProof>; service: ReturnType<typeof createServiceClient> };

/** Everything the module routes need, or the response to return: a real track and module, an open module, every lesson finished. */
async function context(userId: string, trackKey: string, moduleKey: string): Promise<{ error: NextResponse } | Ctx> {
  const track = findTrack(trackKey);
  const m = track?.modules.find((x) => x.key === moduleKey);
  if (!track || !m) return { error: NextResponse.json({ error: "That module does not exist." }, { status: 404 }) };
  const service = createServiceClient();
  const [proofs, done] = await Promise.all([loadModuleProofs(service, userId, track.key), loadProgress(service, userId, track.key)]);
  const status = moduleStatuses(track, proofs)[track.modules.indexOf(m)];
  if (status === "locked") return { error: NextResponse.json({ error: "Prove the module before this one first." }, { status: 403 }) };
  const left = unfinishedLessons(m, done);
  if (left.length > 0) return { error: NextResponse.json({ error: "Finish every lesson of this module first.", unfinished: left }, { status: 409 }) };
  return { track, m, row: proofs[m.key] ?? emptyProof(), service };
}

async function signedIn(): Promise<{ error: NextResponse } | { userId: string }> {
  const auth = await requireUser(await createClient());
  return "error" in auth ? { error: auth.error } : { userId: auth.userId };
}

/** The module test: this attempt's assessment questions (no answers), the problem if the module has one, and where the student stands. */
export async function GET(request: Request) {
  const a = await signedIn();
  if ("error" in a) return a.error;
  const limit = await checkRateLimit(a.userId, { bucket: "module_get", maxRequests: 240, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const q = Get.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "Choose a track and a module." }, { status: 400 });
  const c = await context(a.userId, q.data.track, q.data.module);
  if ("error" in c) return c.error;
  return NextResponse.json({
    language: c.track.runnerLanguage,
    state: c.row,
    questions: c.row.assessmentPassedAt ? [] : currentAssessment(c.m, a.userId, c.row).map(publicQuestion),
    problem: needsProblem(c.track, c.m) ? (isSqlChallenge(c.m.challenge!) ? publicSqlChallenge(c.m.challenge) : isHtmlChallenge(c.m.challenge!) ? publicHtmlChallenge(c.m.challenge) : { kind: "stdin" as const, title: (c.m.challenge as ModuleChallenge).title, ...publicChallenge(c.m.challenge as ModuleChallenge) }) : null,
    problemNote: c.m.challenge && !needsProblem(c.track, c.m) ? "This module's problem needs a code runner for this language that is not available yet, so it is proven by the assessment alone." : null,
  });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (e) {
    // a submission for this module was saved at the same moment: nothing was written, so asking again is safe
    if (e instanceof ProofConflict) return NextResponse.json({ error: "Another submission for this module was saved at the same time. Try again." }, { status: 409 });
    throw e;
  }
}

async function handlePost(request: Request): Promise<NextResponse> {
  const a = await signedIn();
  if ("error" in a) return a.error;
  const body = Post.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "That submission is not valid." }, { status: 400 });
  const kind = body.data.action;
  const limit = await checkRateLimit(a.userId, { bucket: `module_${kind}`, maxRequests: kind === "run" ? 60 : 20, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const c = await context(a.userId, body.data.track, body.data.module);
  if ("error" in c) return c.error;

  if (body.data.action === "assessment") {
    if (c.row.assessmentPassedAt) return NextResponse.json({ error: "You have already passed this assessment." }, { status: 409 });
    const r = await submitAssessment(c.service, a.userId, c.track, c.m, c.row, body.data.answers);
    return NextResponse.json({ correct: r.correct, total: r.total, passed: r.passed, review: r.review, state: r.state });
  }

  if (!needsProblem(c.track, c.m)) return NextResponse.json({ error: "This module has no problem to run." }, { status: 400 });
  if (kind === "submit" && c.row.problemPassedAt) return NextResponse.json({ error: "You have already passed this problem." }, { status: 409 });
  if (isSqlChallenge(c.m.challenge!)) {
    const code = body.data.code;
    if (code.length > MAX_SQL_CHARS) return NextResponse.json({ error: "That is too long." }, { status: 400 });
    try {
      const r = await judgeSqlChallenge(c.m.challenge, code, kind === "run" ? "run" : "submit");
      if (kind === "run") return NextResponse.json({ kind: "sql", results: r.rows });
      const state = await recordProblem(c.service, a.userId, c.track, c.m, c.row, r.passed, { language: "sql", code, passedTests: r.rows.filter((x) => x.passed).length, totalTests: r.rows.length });
      return NextResponse.json({ kind: "sql", passed: r.passed, results: r.rows, state });
    } catch (e) {
      console.error("[module-sql] judging failed:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "The SQL checker is unavailable. Try again." }, { status: 502 });
    }
  }
  if (isHtmlChallenge(c.m.challenge!)) {
    const r = judgePage(c.m.challenge, body.data.code);
    if (kind === "run") return NextResponse.json({ kind: "html", results: r.results, note: r.note });
    const state = await recordProblem(c.service, a.userId, c.track, c.m, c.row, r.passed, { language: "html", code: body.data.code, passedTests: r.results.filter((x) => x.passed).length, totalTests: r.results.length });
    return NextResponse.json({ kind: "html", passed: r.passed, results: r.results, note: r.note, state });
  }
  const ch = c.m.challenge as ModuleChallenge;
  const tests = kind === "run" ? ch.tests.slice(0, ch.exampleCount) : ch.tests;
  const verdicts = await judge(c.track.runnerLanguage, body.data.code, tests);
  if (verdicts.some((v) => v.error.startsWith("Code execution service is unavailable"))) return NextResponse.json({ error: "Code execution service is unavailable. Try again." }, { status: 502 });
  const rows = verdicts.map((v, i) => ({ index: i, passed: v.passed, hidden: i >= ch.exampleCount, ...(i < ch.exampleCount ? { input: tests[i].input.trimEnd(), expected: tests[i].output.trimEnd(), actual: v.actual.trimEnd(), error: v.error } : {}) }));
  if (kind === "run") return NextResponse.json({ results: rows });
  const passed = verdicts.every((v) => v.passed);
  const state = await recordProblem(c.service, a.userId, c.track, c.m, c.row, passed, { language: c.track.runnerLanguage, code: body.data.code, passedTests: verdicts.filter((v) => v.passed).length, totalTests: verdicts.length });
  return NextResponse.json({ passed, results: rows, state });
}

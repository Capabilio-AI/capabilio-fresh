import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { cleanAnswers, DEFENDED_SCORE, generateRepoQuestions, hasSubstance, isSessionExpired, loadRepoBrief, MAX_ATTEMPTS, scoreRepoAnswers, SESSION_MINUTES } from "@/lib/code-dna/defend-repo";

export const maxDuration = 60;

const Body = z.object({ repo: z.string().min(1).max(100), action: z.enum(["start", "submit"]), answers: z.unknown().optional() });

interface DefenseRow {
  questions: string[] | null;
  asked: string[];
  attempts: number;
  score: number | null;
  updated_at: string | null;
}

/**
 * "Explain your project": questions come from the student's own repository
 * code, the answers are scored by the model. Server-side only -- the
 * questions live in the row, the score never comes from the client. A
 * finished try clears the questions so the next start asks fresh ones.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "code_dna_defend", maxRequests: 6, windowSeconds: 60, failClosed: true });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { repo, action } = parsed.data;

  const service = createServiceClient();
  // Only the student's own, scanned, non-fork repositories can be explained.
  const { data: repoRow } = await service
    .from("github_repositories")
    .select("full_name, description, primary_language, is_fork, scan_status, candidate_commit_count")
    .eq("user_id", auth.userId)
    .eq("name", repo)
    .maybeSingle();
  if (!repoRow || repoRow.is_fork || repoRow.scan_status === "failed" || repoRow.candidate_commit_count === 0) {
    return NextResponse.json({ error: "This repository can't be explained: it must be your own original, scanned project." }, { status: 404 });
  }

  const key = { user_id: auth.userId, full_name: repoRow.full_name };
  const { data: existing } = await service.from("github_repo_defenses").select("questions, asked, attempts, score, updated_at").match(key).maybeSingle();
  const row: DefenseRow = (existing as DefenseRow | null) ?? { questions: null, asked: [], attempts: 0, score: null, updated_at: null };
  if (row.attempts >= MAX_ATTEMPTS) return NextResponse.json({ error: "You've used both tries for this project.", score: row.score }, { status: 409 });

  const brief = await loadRepoBrief(repoRow.full_name, repoRow.description, repoRow.primary_language);
  if (!brief) return NextResponse.json({ error: "We couldn't read enough source code from this repository to ask about it." }, { status: 422 });

  if (action === "start") {
    // Resume only while the answering window is open; an expired set is replaced with fresh questions.
    if (row.questions && !isSessionExpired(row.updated_at)) {
      return NextResponse.json({ questions: row.questions, attempts: row.attempts, maxAttempts: MAX_ATTEMPTS, minutes: SESSION_MINUTES, startedAt: row.updated_at });
    }
    try {
      const questions = await generateRepoQuestions(brief, row.asked);
      const startedAt = new Date().toISOString();
      await service.from("github_repo_defenses").upsert({ ...key, questions, asked: [...row.asked, ...questions], updated_at: startedAt });
      return NextResponse.json({ questions, attempts: row.attempts, maxAttempts: MAX_ATTEMPTS, minutes: SESSION_MINUTES, startedAt });
    } catch (error) {
      console.error("[code-dna/defend] questions failed:", error);
      return NextResponse.json({ error: "We couldn't prepare your questions just now. Nothing was used up; try again in a minute." }, { status: 503 });
    }
  }

  const answers = cleanAnswers(parsed.data.answers);
  if (!row.questions || !answers) return NextResponse.json({ error: "Start first, and answer every question." }, { status: 400 });
  if (isSessionExpired(row.updated_at)) {
    // Time ran out: nothing is scored and no try is used; the next start asks fresh questions.
    await service.from("github_repo_defenses").upsert({ ...key, questions: null, updated_at: new Date().toISOString() });
    return NextResponse.json({ error: `The ${SESSION_MINUTES} minutes are up. No try was used; start again for fresh questions.`, expired: true }, { status: 410 });
  }
  if (!hasSubstance(answers)) return NextResponse.json({ error: "Write a little more: a few sentences across your answers." }, { status: 422 });

  try {
    const result = await scoreRepoAnswers(brief, row.questions.map((question, i) => ({ question, answer: answers[i] })));
    const score = Math.round(result.overallScore);
    const best = Math.max(row.score ?? 0, score);
    const feedback = { strengths: result.strengths, improvements: result.improvements, notes: result.notes, lastScore: score };
    await service.from("github_repo_defenses").upsert({ ...key, questions: null, asked: row.asked, attempts: row.attempts + 1, score: best, feedback, updated_at: new Date().toISOString() });
    return NextResponse.json({ score, best, defended: best >= DEFENDED_SCORE, feedback, attemptsLeft: MAX_ATTEMPTS - (row.attempts + 1) });
  } catch (error) {
    console.error("[code-dna/defend] scoring failed:", error);
    return NextResponse.json({ error: "We couldn't score your answers just now. Nothing was used up; try again in a minute." }, { status: 503 });
  }
}

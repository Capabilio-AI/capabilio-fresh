import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { judge } from "@/lib/arena-challenges/leetcode/judge";
import { loadLeetcodeForStudent } from "@/lib/arena-challenges/leetcode/access";

export const maxDuration = 120;

const Body = z.object({
  challengeId: z.string().uuid(),
  language: z.string(),
  code: z.string().min(1).max(20_000),
  /** run on this input instead of the examples */
  customInput: z.string().max(2_000).optional(),
});

/** "Run" in the LeetCode screen: the visible examples (or one custom input). Never reveals hidden tests and never records anything. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limited = await checkRateLimit(auth.userId, { bucket: "arena_leetcode_run", maxRequests: 15, windowSeconds: 60 });
  if (!limited.allowed) return rateLimitedResponse(limited.remaining);

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !isSupportedLanguage(body.data.language)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const service = createServiceClient();
  const c = await loadLeetcodeForStudent(service, auth.userId, body.data.challengeId);
  if (!c) return NextResponse.json({ error: "Challenge not found in your batch." }, { status: 404 });

  if (body.data.customInput !== undefined) {
    try {
      const r = await runCode(body.data.language, body.data.code, body.data.customInput);
      return NextResponse.json({ custom: { output: r.stdout, error: r.compileError || r.stderr } });
    } catch {
      return NextResponse.json({ error: "Code execution service is unavailable. Try again." }, { status: 502 });
    }
  }

  const samples = c.tests.slice(0, c.sampleCount);
  const verdicts = await judge(body.data.language, body.data.code, samples);
  return NextResponse.json({
    results: verdicts.map((v, i) => ({ index: i, passed: v.passed, input: samples[i].input.trimEnd(), expected: samples[i].output, actual: v.actual.trimEnd(), error: v.error })),
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { judge } from "@/lib/arena-challenges/leetcode/judge";
import { canAttemptTier, type TierNumber } from "@/lib/languages/tiers";
import { PROOF_AREAS, PROOF_READY, loadProofSet, loadProvenTiers } from "@/lib/languages/tier-proof";
import { proofGate } from "@/lib/languages/proof-gate";

export const maxDuration = 120;

const Body = z.object({ area: z.enum(PROOF_AREAS), tier: z.number().int().min(1).max(4), challengeId: z.string().uuid(), language: z.string().min(1).max(20), code: z.string().min(1).max(20000) });

/** Runs the code on the problem's examples only, so a student can check it before the one judged submit. The hidden tests are never run or shown here. */
export async function POST(request: Request) {
  const g = await proofGate();
  if ("error" in g) return g.error;
  const limit = await checkRateLimit(g.userId, { bucket: "tier_proof_run", maxRequests: 60, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That run is not valid." }, { status: 400 });
  const { area, challengeId, language, code } = parsed.data;
  const tier = parsed.data.tier as TierNumber;
  if (!PROOF_READY.includes(area) || !isSupportedLanguage(language)) return NextResponse.json({ error: "Unsupported area or language." }, { status: 400 });
  if (!canAttemptTier(tier, await loadProvenTiers(g.service, g.userId, area))) return NextResponse.json({ error: "Prove the tier before this one first." }, { status: 403 });
  const set = await loadProofSet(g.service, g.userId, tier);
  const entry = set?.tests[challengeId];
  if (!set || !entry) return NextResponse.json({ error: "That problem is not in your proof set." }, { status: 404 });
  const examples = entry.tests.slice(0, entry.sampleCount);
  const verdicts = await judge(language, code, examples);
  if (verdicts.some((v) => v.error.startsWith("Code execution service is unavailable"))) return NextResponse.json({ error: "Code execution service is unavailable. Try again." }, { status: 502 });
  return NextResponse.json({ results: verdicts.map((v, i) => ({ index: i, passed: v.passed, input: examples[i].input.trimEnd(), expected: examples[i].output, actual: v.actual.trimEnd(), error: v.error })) });
}

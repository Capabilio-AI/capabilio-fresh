import { NextResponse } from "next/server";
import { z } from "zod";
import { proofGate } from "@/lib/languages/proof-gate";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { judge, mapLimit } from "@/lib/arena-challenges/leetcode/judge";
import { canAttemptTier, tierPassed, type TierNumber } from "@/lib/languages/tiers";
import { PROOF_AREAS, PROOF_READY, loadProofSet, loadProvenTiers, recordTierProof } from "@/lib/languages/tier-proof";

export const maxDuration = 300;

const Query = z.object({ area: z.enum(PROOF_AREAS), tier: z.coerce.number().int().min(1).max(4) });
const Body = z.object({
  area: z.enum(PROOF_AREAS),
  tier: z.number().int().min(1).max(4),
  /** one entry per proof problem; each may be written in a different language */
  answers: z.array(z.object({ challengeId: z.string().uuid(), language: z.string().min(1).max(20), code: z.string().max(20000) })).min(1).max(8),
});

/** The proof set for a tier: problem statements and examples only, never the hidden tests. */
export async function GET(request: Request) {
  const g = await proofGate();
  if ("error" in g) return g.error;
  const limit = await checkRateLimit(g.userId, { bucket: "tier_proof_get", maxRequests: 120, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "Choose an area and a tier from 1 to 4." }, { status: 400 });
  const { area } = q.data;
  const tier = q.data.tier as TierNumber;
  if (!PROOF_READY.includes(area)) return NextResponse.json({ error: "This area's proof test is not open yet." }, { status: 409 });
  const proven = await loadProvenTiers(g.service, g.userId, area);
  if (!canAttemptTier(tier, proven)) return NextResponse.json({ error: "Prove the tier before this one first." }, { status: 403 });
  const set = await loadProofSet(g.service, g.userId, tier);
  if (!set) return NextResponse.json({ error: "Not enough problems are ready for this tier yet." }, { status: 503 });
  return NextResponse.json({ alreadyProven: proven.includes(tier), problems: set.problems });
}

/** Judges every answer on its own hidden tests, in whatever language the student wrote it, and records the proof when enough pass. */
export async function POST(request: Request) {
  const g = await proofGate();
  if ("error" in g) return g.error;
  const limit = await checkRateLimit(g.userId, { bucket: "tier_proof_submit", maxRequests: 6, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That submission is not valid." }, { status: 400 });
  const { area, answers } = parsed.data;
  const tier = parsed.data.tier as TierNumber;
  if (!PROOF_READY.includes(area)) return NextResponse.json({ error: "This area's proof test is not open yet." }, { status: 409 });
  if (answers.some((a) => !isSupportedLanguage(a.language))) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const proven = await loadProvenTiers(g.service, g.userId, area);
  if (!canAttemptTier(tier, proven)) return NextResponse.json({ error: "Prove the tier before this one first." }, { status: 403 });
  const set = await loadProofSet(g.service, g.userId, tier);
  if (!set) return NextResponse.json({ error: "Not enough problems are ready for this tier yet." }, { status: 503 });

  // the answers must be for exactly this student's problems; a missing one counts as not passed
  const byId = new Map(answers.map((a) => [a.challengeId, a]));
  if (answers.some((a) => !set.tests[a.challengeId])) return NextResponse.json({ error: "An answer is for a problem that is not in your proof set." }, { status: 400 });
  const results = await mapLimit(set.problems, 2, async (p) => {
    const a = byId.get(p.id);
    if (!a || a.code.trim() === "") return { id: p.id, passed: false, unavailable: false };
    const verdicts = await judge(a.language, a.code, set.tests[p.id].tests);
    return { id: p.id, passed: verdicts.every((v) => v.passed), unavailable: verdicts.some((v) => v.error.startsWith("Code execution service is unavailable")) };
  });
  // a judge that was down is not a fail: nothing is recorded and the student retries
  if (results.some((r) => r.unavailable)) return NextResponse.json({ error: "Code execution service is unavailable. Try again." }, { status: 502 });

  const passed = results.filter((r) => r.passed).length;
  const total = set.problems.length;
  const ok = tierPassed(passed, total);
  if (ok && !(await recordTierProof(g.service, g.userId, area, tier, passed, total, answers[0]?.language ?? null))) return NextResponse.json({ error: "Could not save your proof." }, { status: 500 });
  return NextResponse.json({ proven: ok, passed, total, results: results.map((r) => ({ challengeId: r.id, passed: r.passed })) });
}

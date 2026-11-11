import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";

// a busy shared runner can take a while, and a run is tried up to three times
export const maxDuration = 120;

const BodySchema = z.object({
  language: z.string(),
  code: z.string().min(1).max(10_000),
  stdin: z.string().max(2_000).optional().default(""),
});

// Forwards to a free public third-party service under this app's identity —
// no per-user limit existed before this (docs/audit/2026-09-27-full-audit.md §5).
const RATE_LIMIT = { bucket: "code_run", maxRequests: 20, windowSeconds: 60 };

/** Explore/iterate only — no grading, no question lookup. Used by the "Run" button while editing. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, RATE_LIMIT);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!isSupportedLanguage(parsed.data.language)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  // The shared runner throws when it is busy or slow (the code never ran), so a run is tried a few times before giving up.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return NextResponse.json(await runCode(parsed.data.language, parsed.data.code, parsed.data.stdin));
    } catch {
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  return NextResponse.json({ error: "The code runner is busy right now. Your code was not run; try again in a moment." }, { status: 503 });
}

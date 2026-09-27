import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";

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

  try {
    const result = await runCode(parsed.data.language, parsed.data.code, parsed.data.stdin);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Code execution service is unavailable — try again." }, { status: 502 });
  }
}

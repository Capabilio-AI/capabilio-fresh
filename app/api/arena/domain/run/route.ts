import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { DATA_ANALYST } from "@/lib/domain-workstations/roles";
import { runSqlQueries } from "@/lib/domain-workstations/sql-runner";

const BodySchema = z.object({ query: z.string().trim().min(1).max(5000) });

/** Exploration only — runs the student's query against the role's dataset; never touches grading. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_domain_run", maxRequests: 30, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a query first." }, { status: 400 });

  try {
    const [result] = await runSqlQueries(DATA_ANALYST.seedSql, [parsed.data.query]);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[arena/domain/run] SQL runner failed:", error);
    return NextResponse.json({ error: "The query engine is unavailable — try again in a moment." }, { status: 502 });
  }
}

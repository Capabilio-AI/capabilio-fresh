import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { studentOnlyResponse } from "@/lib/stage/guard";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loadSqlForStudent } from "@/lib/arena-challenges/workbench/access";
import { judgeSql } from "@/lib/arena-challenges/workbench/sql-task";

export const maxDuration = 30;

const Body = z.object({ challengeId: z.string().uuid(), query: z.string().min(1).max(6000) });

/** "Run" in the SQL workbench: runs the student's query on the task's data and shows the table it returns, plus whether it matches. Records nothing. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const notStudent = await studentOnlyResponse(auth.userId);
  if (notStudent) return notStudent;
  const limited = await checkRateLimit(auth.userId, { bucket: "arena_sql_run", maxRequests: 40, windowSeconds: 60 });
  if (!limited.allowed) return rateLimitedResponse(limited.remaining);

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const c = await loadSqlForStudent(createServiceClient(), auth.userId, body.data.challengeId);
  if (!c) return NextResponse.json({ error: "Challenge not found in your batch." }, { status: 404 });

  const { verdict, table } = await judgeSql(c.task, c.answer, body.data.query);
  if (table && "error" in table) return NextResponse.json({ error: table.error });
  // a run shows the student's own table (or, for a script, the preview query) and whether they match; it never reveals the expected values
  return NextResponse.json({ columns: table?.columns ?? [], rows: table?.rows.slice(0, 50) ?? [], truncated: table ? table.truncated || table.rows.length > 50 : false, matches: verdict.passed, message: verdict.message });
}

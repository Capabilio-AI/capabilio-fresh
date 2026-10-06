import { NextResponse } from "next/server";
import type { z } from "zod";
import type { Result } from "./intent";

/** Plumbing shared by the career-intent routes (each performs its own requireUser first). */
export async function parseBody<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<{ body: z.output<S> } | { error: NextResponse }> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return { body: parsed.data };
  const issue = parsed.error.issues[0];
  return { error: NextResponse.json({ error: issue?.code === "custom" ? issue.message : "Invalid request." }, { status: 400 }) };
}

export function respond<T extends object>(result: Result<T>, successStatus = 200): NextResponse {
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  const { ok: _ok, ...rest } = result;
  return NextResponse.json({ ok: true, ...rest }, { status: successStatus });
}

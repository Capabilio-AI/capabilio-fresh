import { NextResponse } from "next/server";
import type { z } from "zod";
import { IdSchema } from "./schemas";
import type { Result } from "./writes";

/** Shared, auth-free plumbing for the curriculum admin routes (each route performs its own requireOrgAdmin first). */
export async function parseId(params: Promise<{ id: string }>): Promise<{ id: string } | { error: NextResponse }> {
  const id = IdSchema.safeParse((await params).id);
  return id.success ? { id: id.data } : { error: NextResponse.json({ error: "Invalid request." }, { status: 400 }) };
}

export async function parseBody<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<{ body: z.output<S> } | { error: NextResponse }> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return { body: parsed.data };
  const issue = parsed.error.issues[0];
  // Our own refinement messages are written for people; structural ones are not.
  const friendly = issue?.code === "custom" ? issue.message : "Invalid request.";
  return { error: NextResponse.json({ error: friendly }, { status: 400 }) };
}

export function respond<T extends object>(result: Result<T>, successStatus = 200): NextResponse {
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  const { ok: _ok, ...rest } = result;
  return NextResponse.json({ ok: true, ...rest }, { status: successStatus });
}

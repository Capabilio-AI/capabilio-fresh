import { assessRoute } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { toStage } from "@/lib/stage/stage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An id from a URL or a body: a uuid or a 400, so a bad value never reaches the database. */
export function idOf(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new AssessError("INVALID_REQUEST", "Invalid request.", 400);
  return value;
}

export async function jsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AssessError("INVALID_REQUEST", "Invalid request.", 400);
  }
}

/** A route for working professionals only: authenticated, rate limited, and refused for any other path. */
export function proRoute<P = unknown>(bucket: string, maxPerMinute: number, run: (req: Request, ctx: { userId: string; params: P }) => Promise<unknown>) {
  return assessRoute<P>(bucket, maxPerMinute, async (req, { userId, db, params }) => {
    const { data } = await db.from("profiles").select("student_status").eq("id", userId).maybeSingle();
    if (toStage(data?.student_status) !== "professional") throw new AssessError("NOT_PROFESSIONAL", "This is for working professional accounts.", 403);
    return run(req, { userId, params });
  });
}

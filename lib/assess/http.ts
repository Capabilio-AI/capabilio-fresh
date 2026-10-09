import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/require-user";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { AssessError } from "./types";
import type { Db } from "./db";

type Ctx<P> = { userId: string; db: Db; params: P };

/**
 * Shared route shell: authenticates the caller (the student is ALWAYS the session user, never a body field), applies a rate
 * limit, and turns AssessError into the JSON the UI understands. POOL_UNAVAILABLE is retryable and keeps all progress.
 */
// Hot paths (answer, next, state) skip the database rate limit: it costs a round trip to a remote region on every click. A per-instance
// sliding window is plenty to stop a runaway client, and the DB-backed limit still guards the expensive endpoints (model calls).
const hits = new Map<string, number[]>();
function memoryAllowed(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v[v.length - 1] < now - 60_000) hits.delete(k);
  return recent.length <= max;
}

export function assessRoute<P = unknown>(bucket: string, maxPerMinute: number, run: (req: Request, ctx: Ctx<P>) => Promise<unknown>, opts: { memoryLimit?: boolean } = {}) {
  return async (req: Request, route: { params: Promise<P> }): Promise<Response> => {
    const auth = await requireUser(await createClient());
    if ("error" in auth) return auth.error;
    if (opts.memoryLimit) {
      if (!memoryAllowed(`${bucket}:${auth.userId}`, maxPerMinute)) return rateLimitedResponse(0);
    } else {
      const limit = await checkRateLimit(auth.userId, { bucket, maxRequests: maxPerMinute, windowSeconds: 60 });
      if (!limit.allowed) return rateLimitedResponse(limit.remaining);
    }
    try {
      const body = await run(req, { userId: auth.userId, db: createServiceClient() as unknown as Db, params: await route.params });
      return NextResponse.json(body ?? { ok: true });
    } catch (e) {
      if (e instanceof AssessError) return NextResponse.json({ error: e.message, code: e.code, retryable: e.code === "POOL_UNAVAILABLE" }, { status: e.status });
      if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request.", code: "INVALID_REQUEST" }, { status: 400 });
      console.error(`[assess:${bucket}]`, e);
      return NextResponse.json({ error: "Something went wrong. Your progress is saved, please try again.", code: "INTERNAL", retryable: true }, { status: 500 });
    }
  };
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  return schema.parse(await req.json().catch(() => ({})));
}

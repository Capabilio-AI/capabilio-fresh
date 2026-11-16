import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { checkDecision } from "@/lib/admin/rules";
import { applyDecision } from "@/lib/admin/decide";

const Body = z.object({ kind: z.enum(["mentor", "organisation", "executive"]), id: z.string().uuid(), decision: z.string(), reason: z.string().max(2000).optional() }).strict();

/** Capabilio admins only: approve, reject (with the reason the user will read) or hold a mentor, an organisation account or an executive request. */
export async function POST(request: Request) {
  const guard = await requireAdminApi("decide");
  if ("error" in guard) return guard.error;
  const auth = { userId: guard.admin.userId };
  const limit = await checkRateLimit(auth.userId, { bucket: "admin_decision", maxRequests: 120, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const checked = checkDecision({ decision: body.data.decision, reason: body.data.reason });
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const result = await applyDecision({ adminId: auth.userId, kind: body.data.kind, id: body.data.id, decision: checked.value.decision, reason: checked.value.reason });
  return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: result.status });
}

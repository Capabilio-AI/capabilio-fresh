import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { ROLES } from "@/lib/admin/permissions";
import { addAdmin, removeAdmin, updateAdmin } from "@/lib/admin/team";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), email: z.string().max(200), role: z.enum(ROLES), hideContacts: z.boolean().default(false) }),
  z.object({ action: z.literal("update"), userId: z.string().uuid(), role: z.enum(ROLES).optional(), hideContacts: z.boolean().optional() }),
  z.object({ action: z.literal("remove"), userId: z.string().uuid() }),
]);

/** Owners only: add an admin, change a role or a limit, or remove access. */
export async function POST(request: Request) {
  const guard = await requireAdminApi("team");
  if ("error" in guard) return guard.error;
  const limit = await checkRateLimit(guard.admin.userId, { bucket: "admin_team", maxRequests: 60, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const b = body.data;
  const result = b.action === "add" ? await addAdmin(guard.admin.userId, b) : b.action === "update" ? await updateAdmin(guard.admin.userId, b.userId, { role: b.role, hideContacts: b.hideContacts }) : await removeAdmin(guard.admin.userId, b.userId);
  return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: result.status });
}

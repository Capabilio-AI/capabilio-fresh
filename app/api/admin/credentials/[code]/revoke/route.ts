import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { audit } from "@/lib/admin/audit";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { revokeCredential } from "@/lib/credentials/store";

const CODE = /^CAP-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
const Body = z.object({ reason: z.string().trim().min(3).max(300) }).strict();

/** An admin revokes a credential. The public page shows it as revoked at once. Needs the permission to decide, and is recorded in the audit log. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guard = await requireAdminApi("decide");
  if ("error" in guard) return guard.error;
  const { code } = await params;
  if (!CODE.test(code)) return NextResponse.json({ error: "That is not a credential code." }, { status: 400 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Give a reason of 3 to 300 characters." }, { status: 400 });
  const limit = await checkRateLimit(guard.admin.userId, { bucket: "admin_credential_revoke", maxRequests: 60, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const result = await revokeCredential(createServiceClient(), code, guard.admin.userId, body.data.reason);
  if (result === "not_found") return NextResponse.json({ error: "No credential has that code." }, { status: 404 });
  if (result === "already") return NextResponse.json({ error: "That credential is already revoked." }, { status: 409 });
  await audit(guard.admin.userId, "credential.revoke", code, body.data.reason);
  return NextResponse.json({ revoked: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getByCode } from "@/lib/credentials/store";

const CODE = /^CAP-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
const Body = z.object({ showCode: z.boolean() }).strict();

/** The owner changes whether their solution code is shown on the public page. This choice is not part of the signed record, so it can change at any time. */
export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const { code } = await params;
  if (!CODE.test(code)) return NextResponse.json({ error: "That is not a credential code." }, { status: 400 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Say whether to show your code." }, { status: 400 });
  const limit = await checkRateLimit(auth.userId, { bucket: "credential_toggle", maxRequests: 30, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const service = createServiceClient();
  const row = await getByCode(service, code);
  // someone else's credential looks exactly like one that does not exist
  if (!row || row.user_id !== auth.userId) return NextResponse.json({ error: "No credential of yours has that code." }, { status: 404 });
  const { error } = await untyped(service).from("skill_credentials").update({ show_code: body.data.showCode }).eq("code", code).eq("user_id", auth.userId);
  if (error) { console.error("[credentials] toggle failed:", error.message); return NextResponse.json({ error: "Could not save that. Try again." }, { status: 500 }); }
  return NextResponse.json({ showCode: body.data.showCode });
}

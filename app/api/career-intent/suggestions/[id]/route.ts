import { NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { resolveSuggestion } from "@/lib/careers/intent";
import { ResolveSuggestionSchema } from "@/lib/careers/intent-rules";
import { parseBody, respond } from "@/lib/careers/route";
import { warmPrimaryCareerPool } from "@/lib/assess/warm";
import { roleReplaceBlocked } from "@/lib/careers/role-change";

/** The student's explicit answer to one of their own suggestions: accept one suggested career (as main or Plan B), or dismiss it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const parsed = await parseBody(request, ResolveSuggestionSchema);
  if ("error" in parsed) return parsed.error;
  const service = createServiceClient();
  // Accepting a suggestion as the main role replaces it, so it follows the same rule as every other change of main role.
  const blocked = parsed.body.action === "accept" && parsed.body.as !== "secondary" && parsed.body.careerId ? await roleReplaceBlocked(service, auth.userId, parsed.body.careerId) : null;
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const result = await resolveSuggestion(service, auth.userId, id.data, parsed.body);
  if (result.ok && parsed.body.action === "accept" && parsed.body.as !== "secondary") after(() => warmPrimaryCareerPool(auth.userId));
  return respond(result);
}

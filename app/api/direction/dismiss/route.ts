import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { recordPromptSeen } from "@/lib/career/direction-writes";
import { DismissBodySchema } from "@/lib/career/schemas";

/** "Decide later" on the goal prompt, or "Continue" on the Higher Studies check-in. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = DismissBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await recordPromptSeen(createServiceClient(), auth.userId, parsed.data.prompt);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}

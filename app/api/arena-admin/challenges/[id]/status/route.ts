import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { applyStatusAction } from "@/lib/arena-content/admin-actions";
import { ContentError } from "@/lib/arena-content/store";

const Body = z.object({ action: z.enum(["publish", "retire", "approve-legacy"]) }).strict();

/** Publish a validated spec, retire a challenge, or approve a reviewed legacy AI draft. The acting admin is recorded as the reviewer. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "action must be publish, retire or approve-legacy." }, { status: 400 });
  try {
    await applyStatusAction(createServiceClient(), (await params).id, body.data.action, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[admin/arena/status]", error);
    return NextResponse.json({ error: "Could not update the challenge." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { ContentError } from "@/lib/arena-content/store";
import { publishTemplate, retireTemplate, reviewTemplate } from "@/lib/roadmap-visual/template-store";

const Body = z.object({ action: z.enum(["review", "publish", "retire"]) }).strict();

/** Review (records the acting admin as reviewer), publish a reviewed template, or retire one. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "action must be review, publish or retire." }, { status: 400 });
  const service = createServiceClient();
  const { id } = await params;
  try {
    if (body.data.action === "review") await reviewTemplate(service, id, auth.userId);
    else if (body.data.action === "publish") await publishTemplate(service, id);
    else await retireTemplate(service, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[roadmap-admin/status]", error);
    return NextResponse.json({ error: "Could not update the template." }, { status: 500 });
  }
}

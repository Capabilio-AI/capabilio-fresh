import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { ContentError } from "@/lib/arena-content/store";
import { importTemplate, listTemplates } from "@/lib/roadmap-visual/template-store";

export async function GET() {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json({ templates: await listTemplates(createServiceClient()) });
}

/** Save a topic tree as a DRAFT (create, or replace the same career + version while it is not published). Review is a separate, recorded step. */
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { spec?: unknown } | null;
  if (!body?.spec) return NextResponse.json({ error: "spec is required." }, { status: 400 });
  try {
    return NextResponse.json(await importTemplate(createServiceClient(), body.spec));
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[roadmap-admin/templates]", error);
    return NextResponse.json({ error: "Could not save the template." }, { status: 500 });
  }
}

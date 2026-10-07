import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { ContentError, importSpec, listChallenges } from "@/lib/arena-content/store";

export async function GET() {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json({ challenges: await listChallenges(createServiceClient()) });
}

/** Save a spec as a DRAFT (create or replace by key). It must be validated again before it can be published. */
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { spec?: unknown } | null;
  if (!body?.spec) return NextResponse.json({ error: "spec is required." }, { status: 400 });
  try {
    return NextResponse.json(await importSpec(createServiceClient(), body.spec));
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[admin/arena/challenges]", error);
    return NextResponse.json({ error: "Could not save the challenge." }, { status: 500 });
  }
}

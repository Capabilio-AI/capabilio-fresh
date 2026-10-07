import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { validateStored } from "@/lib/arena-content/admin-actions";
import { ContentError } from "@/lib/arena-content/store";

/** Runs the reference solution against the checks (and a blank one) and records a pass. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await validateStored(createServiceClient(), (await params).id));
  } catch (error) {
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[admin/arena/validate]", error);
    return NextResponse.json({ error: "Validation could not run." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { ContentError } from "@/lib/arena-content/store";
import { exportTemplate } from "@/lib/roadmap-visual/template-store";

/** The authored spec rebuilt from the stored rows, for editing. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  try {
    const { spec, status } = await exportTemplate(createServiceClient(), (await params).id);
    return NextResponse.json({ spec, status });
  } catch (error) {
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[roadmap-admin/export]", error);
    return NextResponse.json({ error: "Could not load the template." }, { status: 500 });
  }
}

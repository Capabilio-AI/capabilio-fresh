import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { allowed } from "@/lib/org/roles";
import { loadPlacements, placementsToCsv } from "@/lib/org/outcomes";

/** CSV of the caller's OWN institution's confirmed placements (TPO / admin). */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await getOrgContext(supabase, data.user.id);
  if (!ctx || !allowed(ctx.kind, "viewInsights")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const csv = placementsToCsv(await loadPlacements(createServiceClient(), ctx.institutionId));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="placements-${ctx.institutionSlug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { PlacementConsentSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/** The STUDENT decides whether their confirmed placement appears on the public Placement Wall (own row only). */
export async function POST(request: Request) {
  return orgRoute(request, PlacementConsentSchema, "applyToDrive", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service)
      .from("org_placements")
      .update({ show_on_wall: body.show })
      .eq("id", body.placementId)
      .eq("student_user_id", ctx.userId)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "Placement not found." }, { status: 404 });
    return {};
  });
}

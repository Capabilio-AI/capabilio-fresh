import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { PlacementResponseSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/** The student accepts or declines the offer their college confirmed (own row only). The college sees the answer. */
export async function POST(request: Request) {
  return orgRoute(request, PlacementResponseSchema, "applyToDrive", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service)
      .from("org_placements")
      .update({ student_response: body.response, responded_at: new Date().toISOString() })
      .eq("id", body.placementId)
      .eq("student_user_id", ctx.userId)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "Placement not found." }, { status: 404 });
    return {};
  });
}

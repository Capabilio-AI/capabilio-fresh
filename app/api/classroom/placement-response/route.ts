import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { PlacementResponseSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { markEmployed } from "@/lib/stage/server";
import { notify } from "@/lib/notifications/notify";
import { staffWithPermission } from "@/lib/notifications/audiences";

/** The student accepts or declines the offer their college confirmed (own row only). The college sees the answer. */
export async function POST(request: Request) {
  return orgRoute(request, PlacementResponseSchema, "applyToDrive", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service)
      .from("org_placements")
      .update({ student_response: body.response, responded_at: new Date().toISOString() })
      .eq("id", body.placementId)
      .eq("student_user_id", ctx.userId)
      .select("id, company, role_title");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "Placement not found." }, { status: 404 });
    // Accepting an offer means they have a job: the profile moves to the professional path on its own.
    if (body.response === "accepted") await markEmployed(ctx.userId, { employerName: data[0].company, jobTitle: data[0].role_title });
    const { data: me } = await service.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle();
    await notify(service, {
      userIds: await staffWithPermission(service, ctx.institutionId, "placements"),
      type: "offer_response",
      title: `${me?.full_name ?? "A student"} ${body.response} the offer from ${data[0].company}`,
      href: "/org/outcomes",
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `offer-response:${body.placementId}:${body.response}`,
    });
    return {};
  });
}

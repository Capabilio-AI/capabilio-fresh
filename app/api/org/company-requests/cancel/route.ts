import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { untyped } from "@/lib/org/db";
import { CancelSchema } from "@/lib/org/requests";

/** A college takes back an invitation that has not been answered. */
export async function POST(request: Request) {
  return orgRoute(request, CancelSchema, "postPlacement", async ({ ctx, service }, body) => {
    const { data } = await untyped(service).from("campus_visit_requests").update({ status: "cancelled", responded_at: new Date().toISOString() }).eq("id", body.id).eq("college_id", ctx.institutionId).eq("status", "pending").select("id");
    if (!data?.length) return NextResponse.json({ error: "That invitation was already answered." }, { status: 409 });
    return {};
  });
}

import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { JoinLinkToggleSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/** Turn a join link off (stops new sign-ups through it) or back on. */
export async function POST(request: Request) {
  return orgRoute(request, JoinLinkToggleSchema, "approveMembers", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service).from("org_join_links").update({ active: body.active }).eq("id", body.linkId).eq("institution_id", ctx.institutionId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "Link not found." }, { status: 404 });
    return {};
  });
}

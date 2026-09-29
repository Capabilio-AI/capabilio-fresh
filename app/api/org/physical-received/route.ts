import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { GroupIdSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

export async function POST(request: Request) {
  return orgRoute(request, GroupIdSchema, "gradeProject", async ({ ctx, service }, body) => {
    const { data: group } = await untyped(service).from("class_project_groups").select("project_id").eq("id", body.groupId).maybeSingle();
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
    const { error } = await untyped(service).rpc("class_mark_physical_received", { p_membership_id: ctx.membershipId, p_group_id: body.groupId });
    if (error) throw error;
    return {};
  });
}

import { orgRoute } from "@/lib/api/org-route";
import { GroupIdSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

export async function POST(request: Request) {
  return orgRoute(request, GroupIdSchema, "joinGroup", async ({ ctx, service }, body) => {
    const { error } = await untyped(service).rpc("class_leave_group", { p_user_id: ctx.userId, p_group_id: body.groupId });
    if (error) throw error;
    return {};
  });
}

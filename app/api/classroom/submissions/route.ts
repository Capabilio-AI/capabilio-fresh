import { orgRoute } from "@/lib/api/org-route";
import { SubmitSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

export async function POST(request: Request) {
  return orgRoute(request, SubmitSchema, "joinGroup", async ({ ctx, service }, body) => {
    const { error } = await untyped(service).rpc("class_submit_project", { p_user_id: ctx.userId, p_group_id: body.groupId, p_link: body.linkUrl });
    if (error) throw error;
    return {};
  });
}

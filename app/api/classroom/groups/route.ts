import { orgRoute } from "@/lib/api/org-route";
import { GroupCreateSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/** A student starts a group. All rules (active student, department scope, one group per project) live in class_create_group. */
export async function POST(request: Request) {
  return orgRoute(request, GroupCreateSchema, "joinGroup", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service).rpc("class_create_group", { p_user_id: ctx.userId, p_project_id: body.projectId, p_name: body.name });
    if (error) throw error;
    return { groupId: data as string };
  });
}

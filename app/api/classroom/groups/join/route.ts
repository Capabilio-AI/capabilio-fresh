import { orgRoute } from "@/lib/api/org-route";
import { GroupIdSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { joinRequestCopy } from "@/lib/org/group-invite";
import { nameMap } from "@/lib/org/loaders";

/** Nobody joins a group directly: this sends the group's lead a request to accept or reject. */
export async function POST(request: Request) {
  return orgRoute(request, GroupIdSchema, "joinGroup", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data: requestId, error } = await db.rpc("class_request_join_group", { p_user_id: ctx.userId, p_group_id: body.groupId });
    if (error) throw error;
    const [{ data: group }, { data: leads }] = await Promise.all([
      db.from("class_project_groups").select("name, project_id").eq("id", body.groupId).maybeSingle(),
      db.from("class_project_group_members").select("user_id").eq("group_id", body.groupId).eq("role", "lead"),
    ]);
    if (group && leads?.length) {
      const names = await nameMap(service, [ctx.userId]);
      await notify(service, {
        ...joinRequestCopy(names.get(ctx.userId) ?? "A classmate", group.name),
        userIds: (leads as { user_id: string }[]).map((l) => l.user_id),
        type: "group_join_request",
        href: `/arena/projects/${group.project_id}`,
        actorId: ctx.userId,
        institutionId: ctx.institutionId,
        dedupeKey: `group-join:${requestId}`,
      });
    }
    return { requestId };
  });
}

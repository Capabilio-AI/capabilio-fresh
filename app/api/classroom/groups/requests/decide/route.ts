import { orgRoute } from "@/lib/api/org-route";
import { JoinRequestDecisionSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { joinDecisionCopy } from "@/lib/org/group-invite";

/** The group's lead accepts or rejects a request to join. The database checks they are the lead and re-checks every joining rule. */
export async function POST(request: Request) {
  return orgRoute(request, JoinRequestDecisionSchema, "joinGroup", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const accept = body.decision === "accept";
    const { error } = await db.rpc("class_decide_join_request", { p_user_id: ctx.userId, p_request_id: body.requestId, p_accept: accept });
    if (error) throw error;
    const { data: req } = await db.from("class_group_join_requests").select("user_id, project_id, class_project_groups(name)").eq("id", body.requestId).maybeSingle();
    const row = req as { user_id: string; project_id: string; class_project_groups: { name: string } | null } | null;
    if (row) {
      await notify(service, {
        ...joinDecisionCopy(row.class_project_groups?.name ?? "the group", accept),
        userIds: [row.user_id],
        type: "group_join_decision",
        href: `/arena/projects/${row.project_id}`,
        actorId: ctx.userId,
        institutionId: ctx.institutionId,
        dedupeKey: `group-join-decision:${body.requestId}:${body.decision}`,
      });
    }
    return {};
  });
}

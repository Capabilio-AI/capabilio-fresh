import { orgRoute } from "@/lib/api/org-route";
import { AddMemberSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { addedToGroupCopy } from "@/lib/org/project-notices";
import { nameMap } from "@/lib/org/loaders";

/** Staff place a student who is in no group into a forming group. The database re-checks the staff member's rights and every joining rule. */
export async function POST(request: Request) {
  return orgRoute(request, AddMemberSchema, "createProject", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { error } = await db.rpc("class_staff_add_member", { p_membership_id: ctx.membershipId, p_group_id: body.groupId, p_user_id: body.userId });
    if (error) throw error;
    const { data } = await db.from("class_project_groups").select("name, project_id").eq("id", body.groupId).maybeSingle();
    const g = data as { name: string; project_id: string } | null;
    if (g) {
      const by = (await nameMap(service, [ctx.userId])).get(ctx.userId) ?? "Your faculty";
      await notify(service, { ...addedToGroupCopy(g.name, by), userIds: [body.userId], type: "group_added", href: `/arena/projects/${g.project_id}`, actorId: ctx.userId, institutionId: ctx.institutionId, dedupeKey: `group-added:${body.groupId}:${body.userId}` });
    }
    return {};
  });
}

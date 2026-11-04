import { orgRoute } from "@/lib/api/org-route";
import { MentorRequestSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { mentorAskCopy } from "@/lib/org/project-notices";

/** A group member asks one staff member to mentor their group. */
export async function POST(request: Request) {
  return orgRoute(request, MentorRequestSchema, "joinGroup", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data: requestId, error } = await db.rpc("class_request_mentor", { p_user_id: ctx.userId, p_group_id: body.groupId, p_mentor_membership_id: body.mentorMembershipId, p_message: body.message ?? null });
    if (error) throw error;
    const [{ data: group }, { data: mentor }] = await Promise.all([
      db.from("class_project_groups").select("name, class_projects(title)").eq("id", body.groupId).maybeSingle(),
      db.from("institution_memberships").select("user_id").eq("id", body.mentorMembershipId).maybeSingle(),
    ]);
    const g = group as { name: string; class_projects: { title: string } | null } | null;
    if (g && mentor) {
      await notify(service, { ...mentorAskCopy(g.name, g.class_projects?.title ?? "a project"), userIds: [(mentor as { user_id: string }).user_id], type: "mentor_request", href: "/org/projects", actorId: ctx.userId, institutionId: ctx.institutionId, dedupeKey: `mentor-ask:${requestId}` });
    }
    return { requestId };
  });
}

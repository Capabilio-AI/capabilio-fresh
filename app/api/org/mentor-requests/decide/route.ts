import { orgRoute } from "@/lib/api/org-route";
import { MentorDecisionSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { mentorAnswerCopy } from "@/lib/org/project-notices";
import { nameMap } from "@/lib/org/loaders";

/** The asked staff member accepts, or rejects with a reason the students will read. The database checks they are the one asked. */
export async function POST(request: Request) {
  return orgRoute(request, MentorDecisionSchema, "createProject", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const accept = body.decision === "accept";
    const { error } = await db.rpc("class_decide_mentor_request", { p_user_id: ctx.userId, p_request_id: body.requestId, p_accept: accept, p_reason: body.reason ?? null });
    if (error) throw error;
    const { data } = await db.from("class_group_mentor_requests").select("requested_by_user_id, project_id, class_project_groups(name)").eq("id", body.requestId).maybeSingle();
    const row = data as { requested_by_user_id: string; project_id: string; class_project_groups: { name: string } | null } | null;
    if (row) {
      const mentor = (await nameMap(service, [ctx.userId])).get(ctx.userId) ?? "Your faculty";
      await notify(service, { ...mentorAnswerCopy(mentor, row.class_project_groups?.name ?? "your group", accept, body.reason), userIds: [row.requested_by_user_id], type: "mentor_decision", href: `/arena/projects/${row.project_id}`, actorId: ctx.userId, institutionId: ctx.institutionId, dedupeKey: `mentor-answer:${body.requestId}:${body.decision}` });
    }
    return {};
  });
}

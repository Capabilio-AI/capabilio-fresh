import { orgRoute } from "@/lib/api/org-route";
import { SubmitSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { staffWithPermission } from "@/lib/notifications/audiences";

export async function POST(request: Request) {
  return orgRoute(request, SubmitSchema, "joinGroup", async ({ ctx, service }, body) => {
    const { error } = await untyped(service).rpc("class_submit_project", { p_user_id: ctx.userId, p_group_id: body.groupId, p_link: body.linkUrl });
    if (error) throw error;
    const db = untyped(service);
    const { data: group } = await db.from("class_project_groups").select("name, project_id, class_projects(title)").eq("id", body.groupId).maybeSingle();
    const g = group as { name: string; project_id: string; class_projects: { title: string } | null } | null;
    if (g) {
      await notify(service, {
        userIds: await staffWithPermission(service, ctx.institutionId, "classroom"),
        type: "project_submitted",
        title: `${g.name} submitted ${g.class_projects?.title ?? "a project"}`,
        body: "Ready for grading.",
        href: `/org/projects/${g.project_id}`,
        actorId: ctx.userId,
        institutionId: ctx.institutionId,
        dedupeKey: `submitted:${body.groupId}`,
      });
    }
    return {};
  });
}

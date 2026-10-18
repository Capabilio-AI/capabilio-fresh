import { orgRoute } from "@/lib/api/org-route";
import { GradeSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";

/** Staff-entered grade. class_grade_group re-checks institution/ownership and writes the grade + evidence atomically. */
export async function POST(request: Request) {
  return orgRoute(request, GradeSchema, "gradeProject", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service).rpc("class_grade_group", {
      p_membership_id: ctx.membershipId,
      p_group_id: body.groupId,
      p_grade: body.grade,
      p_feedback: body.feedback ?? null,
      p_notes: body.notes ?? {},
    });
    if (error) throw error;
    const db = untyped(service);
    const { data: group } = await db.from("class_project_groups").select("name, project_id, class_projects(title)").eq("id", body.groupId).maybeSingle();
    const { data: members } = await db.from("class_project_group_members").select("user_id").eq("group_id", body.groupId);
    const g = group as { name: string; project_id: string; class_projects: { title: string } | null } | null;
    await notify(service, {
      userIds: ((members ?? []) as { user_id: string }[]).map((m) => m.user_id),
      type: "project_graded",
      title: `Your project was graded: ${g?.class_projects?.title ?? "project"}`,
      body: `Grade ${body.grade}${body.feedback ? ` · ${body.feedback.slice(0, 120)}` : ""}`,
      href: g ? `/arena/projects/${g.project_id}` : undefined,
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `grade:${data as string}`,
    });
    return { gradeId: data as string };
  });
}

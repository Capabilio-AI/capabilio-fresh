import { NextResponse, after } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { FeedbackSchema } from "@/lib/org/schemas";
import { loadManagedProject } from "@/lib/org/project-access";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { feedbackCopy } from "@/lib/org/project-notices";
import { nameMap } from "@/lib/org/loaders";

/** Staff leave feedback on a weekly report. The save returns at once; every member of the group is notified in the background. */
export async function POST(request: Request) {
  return orgRoute(request, FeedbackSchema, "gradeProject", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data: report } = await db.from("class_weekly_reports").select("id, group_id, week_number").eq("id", body.reportId).maybeSingle();
    const { data: group } = report ? await db.from("class_project_groups").select("name, project_id").eq("id", report.group_id).maybeSingle() : { data: null };
    if (!report || !group || !(await loadManagedProject(service, ctx, group.project_id))) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const { error } = await db.from("class_weekly_reports").update({ staff_feedback: body.feedback, staff_seen_at: new Date().toISOString() }).eq("id", body.reportId);
    if (error) throw error;

    after(async () => {
      const [{ data: members }, names] = await Promise.all([db.from("class_project_group_members").select("user_id").eq("group_id", report.group_id), nameMap(service, [ctx.userId])]);
      await notify(service, {
        ...feedbackCopy(names.get(ctx.userId) ?? "Your faculty", group.name, report.week_number, body.feedback),
        userIds: ((members ?? []) as { user_id: string }[]).map((m) => m.user_id),
        type: "report_feedback",
        href: `/arena/projects/${group.project_id}`,
        actorId: ctx.userId,
        institutionId: ctx.institutionId,
        dedupeKey: `report-feedback:${body.reportId}`,
      });
    });
    return {};
  });
}

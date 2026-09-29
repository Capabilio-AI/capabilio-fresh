import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { FeedbackSchema } from "@/lib/org/schemas";
import { loadManagedProject } from "@/lib/org/project-access";
import { untyped } from "@/lib/org/db";

export async function POST(request: Request) {
  return orgRoute(request, FeedbackSchema, "gradeProject", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data: report } = await db.from("class_weekly_reports").select("id, group_id").eq("id", body.reportId).maybeSingle();
    const { data: group } = report ? await db.from("class_project_groups").select("project_id").eq("id", report.group_id).maybeSingle() : { data: null };
    if (!group || !(await loadManagedProject(service, ctx, group.project_id))) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const { error } = await db.from("class_weekly_reports").update({ staff_feedback: body.feedback, staff_seen_at: new Date().toISOString() }).eq("id", body.reportId);
    if (error) throw error;
    return {};
  });
}

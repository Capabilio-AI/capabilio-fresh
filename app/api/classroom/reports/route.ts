import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ReportSchema } from "@/lib/org/schemas";
import { untyped, type GroupRow, type ProjectRow } from "@/lib/org/db";

/** Weekly report (process data only — never evidence). Any member of the group may file/edit a week until the project is graded. */
export async function POST(request: Request) {
  return orgRoute(request, ReportSchema, "joinGroup", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data: member } = await db.from("class_project_group_members").select("id").eq("group_id", body.groupId).eq("user_id", ctx.userId).maybeSingle();
    if (!member) return NextResponse.json({ error: "You aren't a member of that group." }, { status: 403 });
    const { data: group } = await db.from("class_project_groups").select("*").eq("id", body.groupId).single<GroupRow>();
    const { data: project } = await db.from("class_projects").select("*").eq("id", group?.project_id).single<ProjectRow>();
    if (!group || !project) return NextResponse.json({ error: "Group not found." }, { status: 404 });
    if (group.status === "graded" || project.status !== "open") return NextResponse.json({ error: "Reports are closed for this project." }, { status: 409 });

    // upsert content only; staff_feedback on an existing week is preserved
    const { data: existing } = await db.from("class_weekly_reports").select("id").eq("group_id", body.groupId).eq("week_number", body.weekNumber).maybeSingle();
    const fields = { content: body.content, attachment_url: body.attachmentUrl ?? null, submitted_by_user_id: ctx.userId, submitted_at: new Date().toISOString() };
    const { error } = existing
      ? await db.from("class_weekly_reports").update(fields).eq("id", existing.id)
      : await db.from("class_weekly_reports").insert({ group_id: body.groupId, week_number: body.weekNumber, ...fields });
    if (error) throw error;
    return {};
  });
}

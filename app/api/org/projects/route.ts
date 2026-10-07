import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ProjectSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { resolveProjectScope, staffBranchScope } from "@/lib/org/branch-scope";

// Team size is fixed at 4 for v1 (spec default); it is never a request field.
const TEAM_SIZE = 4;

export async function POST(request: Request) {
  return orgRoute(request, ProjectSchema, "createProject", async ({ ctx, service }, body) => {
    const deadline = new Date(body.deadlineAt);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Deadline must be in the future." }, { status: 400 });
    }
    // Faculty and HoDs post for their own branch only; students of other departments never see it. Admins choose the scope.
    const scope = resolveProjectScope(staffBranchScope(ctx), body.departmentScope);
    if (!scope.ok) return NextResponse.json({ error: scope.message }, { status: 403 });
    if (body.subjectId) {
      const { data: subject } = await service.from("curriculum_subjects").select("id").eq("id", body.subjectId).eq("institution_id", ctx.institutionId).maybeSingle();
      if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    }
    const { data, error } = await untyped(service)
      .from("class_projects")
      .insert({
        institution_id: ctx.institutionId,
        created_by_membership_id: ctx.membershipId,
        subject_id: body.subjectId ?? null,
        title: body.title,
        brief: body.brief,
        department_scope: scope.value,
        team_size: TEAM_SIZE,
        submission_type: body.submissionType,
        weekly_report_required: body.weeklyReportRequired,
        deadline_at: deadline.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { projectId: data.id };
  });
}

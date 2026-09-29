import { orgRoute } from "@/lib/api/org-route";
import { GradeSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

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
    return { gradeId: data as string };
  });
}

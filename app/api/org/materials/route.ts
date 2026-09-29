import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { MaterialSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/** Staff/admin share a note, PDF link or external link with a branch + year. Institution comes from the caller's membership. */
export async function POST(request: Request) {
  return orgRoute(request, MaterialSchema, "uploadMaterial", async ({ ctx, service }, body) => {
    let branch = body.branch;
    let year = body.year;
    if (body.subjectId) {
      const { data: subject } = await service
        .from("curriculum_subjects")
        .select("branch, year")
        .eq("id", body.subjectId)
        .eq("institution_id", ctx.institutionId)
        .maybeSingle();
      if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
      branch = subject.branch;
      year = subject.year;
    }
    const { error } = await untyped(service).from("class_materials").insert({
      institution_id: ctx.institutionId,
      author_membership_id: ctx.membershipId,
      subject_id: body.subjectId ?? null,
      type: body.type,
      title: body.title,
      description: body.description ?? null,
      body: body.type === "notes" ? body.body : null,
      url: body.type === "notes" ? null : body.url,
      branch,
      year,
    });
    if (error) throw error;
    return {};
  });
}

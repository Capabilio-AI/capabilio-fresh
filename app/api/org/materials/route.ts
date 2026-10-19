import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { MaterialSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { resolveMaterialScope } from "@/lib/org/material-scope";
import { notify } from "@/lib/notifications/notify";
import { activeStudents } from "@/lib/notifications/audiences";

/** Staff/admin share a note, PDF link or external link with a branch + year. Institution comes from the caller's membership. */
export async function POST(request: Request) {
  return orgRoute(request, MaterialSchema, "uploadMaterial", async ({ ctx, service }, body) => {
    const scope = await resolveMaterialScope(service, ctx, { subjectId: body.subjectId, branch: body.branch, year: body.year });
    if (!scope.ok) return NextResponse.json({ error: scope.message }, { status: scope.status });
    const { branch, year } = scope;
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
    await notify(service, {
      userIds: await activeStudents(service, ctx.institutionId, branch ? [branch] : null),
      type: "material_posted",
      title: `New material: ${body.title}`,
      href: "/skillstudio/materials",
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `material:${ctx.membershipId}:${body.title}:${Math.floor(Date.now() / 60000)}`,
    });
    return {};
  });
}

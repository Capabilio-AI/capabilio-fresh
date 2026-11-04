import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { orgRoute } from "@/lib/api/org-route";
import { MaterialSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { resolveMaterialScope } from "@/lib/org/material-scope";
import { notify } from "@/lib/notifications/notify";
import { activeStudents } from "@/lib/notifications/audiences";

/**
 * Staff/admin share a note, PDF link or external link with one or more branch-and-year groups. Each group gets its own row (that is how students
 * are matched) and all of them carry one share id, so it is one item in the library and one copy for a student. The institution comes from the
 * caller's membership.
 */
export async function POST(request: Request) {
  return orgRoute(request, MaterialSchema, "uploadMaterial", async ({ ctx, service }, body) => {
    const inputs: { subjectId?: string; branch?: string; year?: number }[] = body.audiences ?? [{ subjectId: body.subjectId, branch: body.branch, year: body.year }];
    const scopes: { branch: string; year: number }[] = [];
    for (const input of inputs) {
      const scope = await resolveMaterialScope(service, ctx, input);
      if (!scope.ok) return NextResponse.json({ error: scope.message }, { status: scope.status });
      if (!scopes.some((s) => s.branch === scope.branch && s.year === scope.year)) scopes.push({ branch: scope.branch, year: scope.year });
    }
    const shareId = randomUUID();
    const { error } = await untyped(service).from("class_materials").insert(
      scopes.map((s) => ({
        share_id: shareId,
        institution_id: ctx.institutionId,
        author_membership_id: ctx.membershipId,
        subject_id: body.subjectId ?? null,
        type: body.type,
        title: body.title,
        description: body.description ?? null,
        body: body.type === "notes" ? body.body : null,
        url: body.type === "notes" ? null : body.url,
        branch: s.branch,
        year: s.year,
      }))
    );
    if (error) throw error;
    await notify(service, {
      userIds: await activeStudents(service, ctx.institutionId, [...new Set(scopes.map((s) => s.branch))]),
      type: "material_posted",
      title: `New material: ${body.title}`,
      href: "/skillstudio/materials",
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `material:${ctx.membershipId}:${body.title}:${Math.floor(Date.now() / 60000)}`,
    });
    return { groups: scopes.length };
  });
}

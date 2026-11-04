import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizeOrg } from "@/lib/api/org-route";
import { untyped } from "@/lib/org/db";
import { resolveMaterialScope } from "@/lib/org/material-scope";
import { uploadImage, removeMedia } from "@/lib/pulse/media";
import { notify } from "@/lib/notifications/notify";
import { activeStudents } from "@/lib/notifications/audiences";

const Fields = z.object({
  title: z.string().trim().min(1, "Give the material a title.").max(200),
  description: z.string().trim().max(2000).optional(),
  subjectId: z.string().uuid().optional(),
  branch: z.string().trim().max(200).optional(),
  year: z.coerce.number().int().min(1).max(6).optional(),
});
const Audiences = z.array(z.object({ branch: z.string().trim().min(1).max(200), year: z.number().int().min(1).max(6) })).min(1).max(24);

const text = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/**
 * Staff share an uploaded file (PDF, Word, Excel, PowerPoint or an image) with one or more branch-and-year groups. The file is stored once and
 * each group gets its own row pointing at it. The file type is read from its bytes, the file lives in the uploader's own storage folder, the
 * institution comes from their membership (never the request), and the students concerned are notified.
 */
export async function POST(request: Request) {
  const env = await authorizeOrg("uploadMaterial");
  if (env instanceof NextResponse) return env;
  const { ctx, service } = env;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  const parsed = Fields.safeParse({ title: text(form!.get("title")), description: text(form!.get("description")), subjectId: text(form!.get("subjectId")), branch: text(form!.get("branch")), year: text(form!.get("year")) });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  // who sees it: a subject, an explicit list of branch-and-year groups, or (older callers) one branch and year
  let inputs: { subjectId?: string; branch?: string; year?: number }[] = [{ subjectId: parsed.data.subjectId, branch: parsed.data.branch, year: parsed.data.year }];
  const raw = text(form!.get("audiences"));
  if (raw && !parsed.data.subjectId) {
    const list = Audiences.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
    if (!list.success) return NextResponse.json({ error: "Choose who should see it." }, { status: 400 });
    inputs = list.data;
  }
  const scopes: { branch: string; year: number; subjectId: string | null }[] = [];
  for (const input of inputs) {
    const scope = await resolveMaterialScope(service, ctx, input);
    if (!scope.ok) return NextResponse.json({ error: scope.message }, { status: scope.status });
    if (!scopes.some((s) => s.branch === scope.branch && s.year === scope.year)) scopes.push({ branch: scope.branch, year: scope.year, subjectId: input.subjectId ?? null });
  }

  const uploaded = await uploadImage(service, ctx.userId, "material", file);
  if (!uploaded.ok) return NextResponse.json({ error: uploaded.message }, { status: uploaded.status });

  const shareId = randomUUID();
  const { error } = await untyped(service).from("class_materials").insert(
    scopes.map((s) => ({
      share_id: shareId,
      institution_id: ctx.institutionId,
      author_membership_id: ctx.membershipId,
      subject_id: s.subjectId,
      type: "file",
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      file_path: uploaded.path,
      file_name: file.name.slice(0, 200),
      file_size: file.size,
      file_mime: uploaded.mime ?? null,
      branch: s.branch,
      year: s.year,
    }))
  );
  if (error) {
    await removeMedia(service, [uploaded.path]); // never leave an orphaned file behind
    return NextResponse.json({ error: "Could not publish the material. Please try again." }, { status: 500 });
  }

  await notify(service, {
    userIds: await activeStudents(service, ctx.institutionId, [...new Set(scopes.map((s) => s.branch))]),
    type: "material_posted",
    title: `New material: ${parsed.data.title}`,
    href: "/skillstudio/materials",
    actorId: ctx.userId,
    institutionId: ctx.institutionId,
    dedupeKey: `material:${ctx.membershipId}:${parsed.data.title}:${Math.floor(Date.now() / 60000)}`,
  });
  return NextResponse.json({ ok: true, groups: scopes.length });
}

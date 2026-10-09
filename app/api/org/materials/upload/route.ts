import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeOrg } from "@/lib/api/org-route";
import { untyped } from "@/lib/org/db";
import { resolveMaterialScope } from "@/lib/org/material-scope";
import { uploadImage, removeMedia } from "@/lib/pulse/media";

const Fields = z.object({
  title: z.string().trim().min(1, "Give the material a title.").max(200),
  description: z.string().trim().max(2000).optional(),
  subjectId: z.string().uuid().optional(),
  branch: z.string().trim().max(200).optional(),
  year: z.coerce.number().int().min(1).max(6).optional(),
});

const text = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/**
 * Staff share an uploaded file (PDF, Word, Excel, PowerPoint or an image) with a branch and year. The file type is read from its bytes,
 * the file lives in the uploader's own storage folder, and the institution comes from their membership, never from the request.
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

  const scope = await resolveMaterialScope(service, ctx, parsed.data);
  if (!scope.ok) return NextResponse.json({ error: scope.message }, { status: scope.status });

  const uploaded = await uploadImage(service, ctx.userId, "material", file);
  if (!uploaded.ok) return NextResponse.json({ error: uploaded.message }, { status: uploaded.status });

  const { error } = await untyped(service).from("class_materials").insert({
    institution_id: ctx.institutionId,
    author_membership_id: ctx.membershipId,
    subject_id: parsed.data.subjectId ?? null,
    type: "file",
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    file_path: uploaded.path,
    file_name: file.name.slice(0, 200),
    file_size: file.size,
    file_mime: uploaded.mime ?? null,
    branch: scope.branch,
    year: scope.year,
  });
  if (error) {
    await removeMedia(service, [uploaded.path]); // never leave an orphaned file behind
    return NextResponse.json({ error: "Could not publish the material. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

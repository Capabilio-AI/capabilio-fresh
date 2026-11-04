import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authorizeOrg } from "@/lib/api/org-route";
import { untyped, type GroupRow, type ProjectRow } from "@/lib/org/db";
import { PROJECT_BUCKET, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, cleanFileName, groupFolder, sniffProjectFile, type ProjectFile } from "@/lib/org/project-files";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * A member of a project group uploads one image or PDF for a weekly report or the final submission. The type is read from the bytes,
 * the file lands in the group's own folder of a private bucket, and the browser gets back only the small record to attach.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const groupId = String(form?.get("groupId") ?? "");
  const file = form?.get("file");
  if (!UUID.test(groupId) || !(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });

  const env = await authorizeOrg("joinGroup");
  if (env instanceof NextResponse) return env;
  const { ctx, service } = env;
  const db = untyped(service);

  const { data: member } = await db.from("class_project_group_members").select("id").eq("group_id", groupId).eq("user_id", ctx.userId).maybeSingle();
  if (!member) return NextResponse.json({ error: "You aren't a member of that group." }, { status: 403 });
  const { data: group } = await db.from("class_project_groups").select("*").eq("id", groupId).single<GroupRow>();
  const { data: project } = await db.from("class_projects").select("*").eq("id", group?.project_id).single<ProjectRow>();
  if (!group || !project) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  if (group.status === "graded" || project.status !== "open") return NextResponse.json({ error: "This project no longer takes files." }, { status: 409 });

  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: `Each file must be under ${MAX_UPLOAD_MB} MB.` }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffProjectFile(bytes);
  if (!kind) return NextResponse.json({ error: "Upload a PNG, JPG, WebP image or a PDF." }, { status: 415 });

  const path = `${groupFolder(project.id, group.id)}${randomUUID()}.${kind.ext}`;
  const { error } = await service.storage.from(PROJECT_BUCKET).upload(path, bytes, { contentType: kind.contentType, upsert: false });
  if (error) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  const out: ProjectFile = { path, name: cleanFileName(file.name), contentType: kind.contentType as ProjectFile["contentType"], size: file.size };
  return NextResponse.json({ ok: true, file: out });
}

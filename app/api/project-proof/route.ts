import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { failureResponse, overLimit } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { PROJECT_BUCKET, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, cleanFileName, sniffProjectFile, type ProjectFile } from "@/lib/org/project-files";
import { selfFolder, StateQuery } from "@/lib/roadmap-visual/project-submission";
import { loadProjectScope } from "@/lib/roadmap-visual/project-submission-server";

/**
 * A student uploads one photo or PDF as proof for a roadmap project. The type is read from the bytes, and the file lands in the student's own
 * folder of the private bucket, so it can only ever be attached to their own submission.
 */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limited = await overLimit(auth.userId, "project_submission_file", 20);
  if (limited) return limited;
  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const q = StateQuery.safeParse({ resourceId: String(form?.get("resourceId") ?? ""), career: String(form?.get("career") ?? "primary") });
    if (!q.success || !(file instanceof File)) throw new AssessError("BAD_UPLOAD", "Choose a file to upload.", 400);
    const service = createServiceClient();
    const found = await loadProjectScope(service, auth.userId, q.data.resourceId, q.data.career);
    if (!found) throw new AssessError("NOT_AVAILABLE", "That project isn't on your roadmap.", 404);
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new AssessError("TOO_BIG", `Each file must be under ${MAX_UPLOAD_MB} MB.`, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffProjectFile(bytes);
    if (!kind) throw new AssessError("BAD_TYPE", "Upload a PNG, JPG, WebP image or a PDF.", 415);
    const path = `${selfFolder(auth.userId, found.resource.id)}${randomUUID()}.${kind.ext}`;
    const { error } = await service.storage.from(PROJECT_BUCKET).upload(path, bytes, { contentType: kind.contentType, upsert: false });
    if (error) throw new AssessError("UPLOAD_FAILED", "Upload failed. Please try again.", 500);
    const out: ProjectFile = { path, name: cleanFileName(file.name), contentType: kind.contentType as ProjectFile["contentType"], size: file.size };
    return NextResponse.json({ file: out });
  } catch (e) {
    return failureResponse(e, "project_submission_file");
  }
}

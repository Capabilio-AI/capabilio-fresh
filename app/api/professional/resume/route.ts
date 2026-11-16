import { assessRoute } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { readProResume } from "@/lib/professional/resume-ai";
import { namesMatch } from "@/lib/graduate/name-match";
import { toStage } from "@/lib/stage/stage";
import { sniff } from "@/lib/professional/documents";
import { saveProResume } from "@/lib/professional/server";
import { addDoc } from "@/lib/professional/workspace-server";

export const maxDuration = 60; // reading the PDF and one model call

/**
 * A working professional uploads a resume (PDF). The server reads it, checks it is theirs, and keeps what it extracts in the professional's
 * own tables, and the file is kept in the professional's Vault as their current resume. Nothing is written to the student or graduate tables.
 */
export const POST = assessRoute("professional_resume", 5, async (req, { userId, db }) => {
  const { data: me } = await db.from("profiles").select("full_name, student_status").eq("id", userId).maybeSingle();
  if (toStage(me?.student_status) !== "professional") throw new AssessError("NOT_PROFESSIONAL", "This is for working professional accounts.", 403);

  const form = await req.formData().catch(() => null);
  const file = form?.get("resume");
  if (!(file instanceof File)) throw new AssessError("NO_FILE", "Choose your resume as a PDF.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const read = await readProResume(bytes);
  if (!read.ok) throw new AssessError("RESUME_REJECTED", read.message, read.status);

  // The resume must be theirs: a different name is rejected before anything is saved.
  const resumeName = read.extraction.personal.fullName;
  if (resumeName && me?.full_name && !namesMatch(me.full_name as string, resumeName)) {
    throw new AssessError("NAME_MISMATCH", `The name on this resume (${resumeName}) doesn't match your account name (${me.full_name}). Upload your own resume, or correct your name in Settings first.`, 422);
  }

  await saveProResume(userId, file.name, read.extraction, read.model);
  // The file itself goes to the Vault as the current resume. If that fails the profile is still filled in, and we say so.
  const type = sniff(bytes.slice(0, 8));
  const stored = type ? await addDoc(userId, "resume", { name: file.name, bytes, mime: type.mime, ext: type.ext }).then((r) => r.ok, () => false) : false;
  return { ok: true, stored };
});

import { assessRoute } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { applyResume } from "@/lib/graduate/apply";
import { readResumePdf } from "@/lib/graduate/analyse";
import { isGraduate, resumeSkillNames } from "@/lib/graduate/focus";
import { summariseResume } from "@/lib/graduate/summary";
import { ResumeExtractionSchema } from "@/lib/ai/llm/prompts/resume.v1";

export const maxDuration = 60; // reading the PDF and one model call

/**
 * A recently graduated account uploads a resume (PDF). The server reads it, keeps what it extracts (the file itself is discarded),
 * and writes the details into the profile, education history and vault. `?skip=1` records "no resume yet" so the flow can move on.
 */
export const POST = assessRoute("graduate_resume", 5, async (req, { userId, db }) => {
  if (!(await isGraduate(db, userId))) throw new AssessError("NOT_GRADUATE", "Resume upload is for recently graduated accounts.", 403);
  const now = new Date().toISOString();

  if (new URL(req.url).searchParams.get("skip") === "1") {
    const empty = ResumeExtractionSchema.parse({ isResume: false });
    await db.from("graduate_resumes").upsert({ user_id: userId, file_name: null, extraction: empty, skill_names: [], model: null, updated_at: now }, { onConflict: "user_id", ignoreDuplicates: true });
    return { summary: summariseResume(empty, [], null) };
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("resume");
  if (!(file instanceof File)) throw new AssessError("NO_FILE", "Choose your resume as a PDF.", 400);

  const read = await readResumePdf(new Uint8Array(await file.arrayBuffer()));
  if (!read.ok) throw new AssessError("RESUME_REJECTED", read.message, read.status);

  const skills = resumeSkillNames(read.extraction);
  const { error } = await db.from("graduate_resumes").upsert(
    { user_id: userId, file_name: file.name.slice(0, 255), extraction: read.extraction, skill_names: skills, model: read.model, updated_at: now },
    { onConflict: "user_id" }
  );
  if (error) throw error;
  const applied = await applyResume(db, userId, read.extraction);
  await db.from("graduate_resumes").update({ applied_at: new Date().toISOString() }).eq("user_id", userId);
  return { summary: summariseResume(read.extraction, skills, applied) };
});

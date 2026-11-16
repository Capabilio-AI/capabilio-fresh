import { generateStructured, type GenerateDeps } from "@/lib/ai/llm";
import { checkPdfBytes, extractPdfPages } from "@/lib/roadmap/extract/pdf";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads/limits";
import { PRO_RESUME_PROMPT_VERSION, ProResumeSchema, proResumePrompt, type ProResume } from "./resume-schema";

export type ProResumeRead = { ok: true; extraction: ProResume; model: string } | { ok: false; status: number; message: string };

/** PDF bytes in, a checked professional resume out. The file is judged by its first bytes. */
export async function readProResume(bytes: Uint8Array, deps: GenerateDeps = {}): Promise<ProResumeRead> {
  const check = checkPdfBytes(bytes);
  if (!check.ok) return check;
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, status: 413, message: `Keep the resume under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const pages = await extractPdfPages(bytes);
  if (!pages.ok) return { ok: false, status: 422, message: pages.code === "no_text_layer" ? "This PDF looks like a scan. Upload a PDF you can select text in." : "We could not read that PDF. Try exporting it again." };
  const text = pages.pages.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 120) return { ok: false, status: 422, message: "That file has too little text to be a resume." };
  const p = proResumePrompt(text);
  try {
    const { value, model } = await generateStructured({ task: "resume", system: p.system, user: p.user, schema: ProResumeSchema, temperature: 0.1, maxTokens: 6000, promptVersion: PRO_RESUME_PROMPT_VERSION }, deps);
    if (!value.isResume) return { ok: false, status: 422, message: "That does not look like a resume. Upload your resume or CV as a PDF." };
    return { ok: true, extraction: value, model };
  } catch (e) {
    console.error("[professional] resume analysis failed:", (e as Error).message);
    return { ok: false, status: 503, message: "We could not analyse your resume just now. Please try again in a minute." };
  }
}

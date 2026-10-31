import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { authorizeOrg } from "@/lib/api/org-route";
import { completeJsonDetailed } from "@/lib/ai/groq";
import { checkPdfBytes } from "@/lib/roadmap/extract/pdf";
import { mediaPath } from "@/lib/org/media";
import { readCircularImage } from "@/lib/org/circular-vision";
import { CIRCULAR_SYSTEM, CircularDraftSchema, cleanStartsAt } from "@/lib/org/circular";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads/limits";

const BUCKET = "org-media";
const MAX_TEXT_CHARS = 12_000;

/**
 * A circular PDF in, a post draft out: we read its text, render page 1 as the picture shown on the page, and propose a headline, summary and
 * date. Nothing is posted — the composer shows the draft for the college to check and edit.
 */
export async function POST(request: Request) {
  const env = await authorizeOrg("publishPost");
  if (env instanceof NextResponse) return env;
  const { ctx, service } = env;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF to upload." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkPdfBytes(bytes, MAX_UPLOAD_BYTES);
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  const parser = new PDFParse({ data: bytes.slice() });
  try {
    // one after the other: pdfjs hands the same document to its worker, and overlapping calls fail with "Cannot transfer object of unsupported type"
    const text = await parser.getText({ first: 2 });
    // the picture is a bonus: if rendering fails on this host the text is still read
    const page = await parser.getScreenshot({ first: 1, desiredWidth: 1400, imageBuffer: true }).then((r) => r.pages[0]?.data, (e) => { console.error("[posts/from-pdf] render failed:", e instanceof Error ? e.message : e); return undefined; });
    let imageUrl: string | null = null;
    if (page) {
      const path = mediaPath(ctx.institutionId, "post", "png", randomUUID());
      const { error } = await service.storage.from(BUCKET).upload(path, page, { contentType: "image/png", upsert: false });
      if (!error) imageUrl = service.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const content = text.text.trim().slice(0, MAX_TEXT_CHARS);
    if (content.length < 40) {
      // a scan has no text layer: read the page as a picture instead
      const seen = page ? await readCircularImage(page).catch(() => null) : null;
      if (seen) return NextResponse.json({ ok: true, imageUrl, draft: { ...seen, startsAt: cleanStartsAt(seen.startsAt) } });
      return NextResponse.json({ ok: true, imageUrl, draft: null, note: "We couldn't read this PDF automatically. The page is attached; add the details yourself." });
    }
    const { value } = await completeJsonDetailed(`Circular text:\n"""\n${content}\n"""`, CIRCULAR_SYSTEM, CircularDraftSchema, { maxTokens: 1500, temperature: 0.1 });
    return NextResponse.json({ ok: true, imageUrl, draft: { ...value, startsAt: cleanStartsAt(value.startsAt) } });
  } catch (e) {
    console.error("[posts/from-pdf]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "We couldn't read that PDF. Try another file, or write the post yourself." }, { status: 422 });
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

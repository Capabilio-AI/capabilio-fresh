import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authorizeOrg } from "@/lib/api/org-route";
import { MAX_MEDIA_BYTES, sniffDocument } from "@/lib/org/media";
import { untyped } from "@/lib/org/db";

const BUCKET = "org-offers";

/**
 * Attach the company's offer letter (PDF or image, private) to a placement the college confirmed. The letter can
 * only be opened later by that student or by the college's placement officers, through short-lived signed links.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const placementId = String(form?.get("placementId") ?? "");
  const file = form?.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(placementId) || !(file instanceof File)) return NextResponse.json({ error: "Choose the offer letter to upload." }, { status: 400 });

  const env = await authorizeOrg("postPlacement");
  if (env instanceof NextResponse) return env;
  const { ctx, service } = env;

  if (file.size === 0 || file.size > MAX_MEDIA_BYTES) return NextResponse.json({ error: "The letter must be under 5 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = sniffDocument(bytes);
  if (!doc) return NextResponse.json({ error: "Upload a PDF, PNG or JPG file." }, { status: 415 });

  const db = untyped(service);
  const { data } = await db.from("org_placements").select("id, offer_letter_path").eq("id", placementId).eq("institution_id", ctx.institutionId).maybeSingle();
  const placement = data as { id: string; offer_letter_path: string | null } | null;
  if (!placement) return NextResponse.json({ error: "Placement not found." }, { status: 404 });

  const path = `${ctx.institutionId}/${placement.id}-${randomUUID()}.${doc.ext}`;
  const { error: uploadError } = await service.storage.from(BUCKET).upload(path, bytes, { contentType: doc.contentType, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  const { error } = await db.from("org_placements").update({ offer_letter_path: path }).eq("id", placement.id);
  if (error) return NextResponse.json({ error: "Could not save the letter." }, { status: 500 });
  if (placement.offer_letter_path) await service.storage.from(BUCKET).remove([placement.offer_letter_path]);
  return NextResponse.json({ ok: true });
}

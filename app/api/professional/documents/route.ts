import { AssessError } from "@/lib/assess/types";
import { DOC_KINDS, checkUpload, type DocKind } from "@/lib/professional/documents";
import { unwrap } from "@/lib/professional/respond";
import { proRoute } from "@/lib/professional/route";
import { addDoc } from "@/lib/professional/workspace-server";

export const maxDuration = 30;

/** Adds a file to the vault. The type is decided by the file's contents, never by its name. */
export const POST = proRoute("pro_document", 10, async (req, { userId }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File)) throw new AssessError("NO_FILE", "Choose a file.", 400);
  if (typeof kind !== "string" || !(DOC_KINDS as readonly string[]).includes(kind)) throw new AssessError("INVALID_REQUEST", "Choose what kind of document this is.", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload({ name: file.name, size: bytes.length }, bytes.slice(0, 8));
  if (!check.ok) throw new AssessError("INVALID_FILE", check.error, 400);
  return unwrap(await addDoc(userId, kind as DocKind, { name: file.name, bytes, mime: check.value.mime, ext: check.value.ext }));
});

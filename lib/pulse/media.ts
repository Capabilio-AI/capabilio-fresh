import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Service = SupabaseClient<Database>;

export const BUCKET = "pulse-media";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_SECONDS = 3600;
export type Purpose = "story" | "post" | "doc" | "chat" | "material";
export type ImageMime = "image/png" | "image/jpeg" | "image/webp";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export type MediaMime = ImageMime | "application/pdf" | typeof DOCX | typeof XLSX | typeof PPTX;
const EXT: Record<MediaMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf", [DOCX]: "docx", [XLSX]: "xlsx", [PPTX]: "pptx" };
const OFFICE_BY_EXT: Record<string, MediaMime> = { docx: DOCX, xlsx: XLSX, pptx: PPTX };

/** Word, Excel and PowerPoint files are zip containers: the bytes must start with "PK" and the name must carry the matching extension. */
export function sniffOffice(b: Uint8Array, fileName: string): MediaMime | null {
  const zip = b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return zip ? (OFFICE_BY_EXT[ext] ?? null) : null;
}

/** The real type of an image from its first bytes — the browser-supplied content type is never trusted. */
export function sniffImage(b: Uint8Array): ImageMime | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** PDFs start with "%PDF-"; the browser-supplied type is never trusted. */
export function sniffPdf(b: Uint8Array): boolean {
  return b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-";
}

/** A stored path may only be attached by the person whose folder it is in, for the purpose it was uploaded for. */
export function ownsMedia(userId: string, purpose: Purpose, path: string): boolean {
  return path.startsWith(`${userId}/${purpose}/`) && !path.includes("..") && path.length <= 300;
}

export type UploadResult = { ok: true; path: string; mime?: MediaMime } | { ok: false; status: number; message: string };

export async function uploadImage(service: Service, userId: string, purpose: Purpose, file: File): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, status: 400, message: "That file is empty." };
  const isDoc = purpose === "doc";
  const isChat = purpose === "chat" || purpose === "material";
  if (file.size > (isDoc || isChat ? MAX_DOC_BYTES : MAX_IMAGE_BYTES)) return { ok: false, status: 413, message: isDoc || isChat ? "Files must be under 10 MB." : "Images must be under 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime: MediaMime | null = isChat ? (sniffImage(bytes) ?? (sniffPdf(bytes) ? "application/pdf" : sniffOffice(bytes, file.name))) : isDoc ? (sniffPdf(bytes) ? "application/pdf" : null) : sniffImage(bytes);
  if (!mime) return { ok: false, status: 415, message: isChat ? "Upload a PDF, a Word, Excel or PowerPoint file, or a PNG, JPEG or WebP image." : isDoc ? "Upload a PDF document." : "Use a PNG, JPEG or WebP image." };
  const path = `${userId}/${purpose}/${randomUUID()}.${EXT[mime]}`;
  const { error } = await service.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) {
    console.error("[pulse-media] upload failed:", error.message);
    return { ok: false, status: 500, message: "Couldn't upload the file. Please try again." };
  }
  return { ok: true, path, mime };
}

/** path -> short-lived signed URL, for every path in one call. */
export async function signPaths(service: Service, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return new Map();
  const { data } = await service.storage.from(BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  return new Map((data ?? []).flatMap((r) => (r.path && r.signedUrl ? [[r.path, r.signedUrl] as const] : [])));
}

export async function removeMedia(service: Service, paths: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length > 0) await service.storage.from(BUCKET).remove(unique);
}

export type MediaKind = "logo" | "cover" | "post";

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export interface SniffedImage {
  contentType: "image/png" | "image/jpeg" | "image/webp";
  ext: "png" | "jpg" | "webp";
}

/** The file's real type from its first bytes — the browser-supplied Content-Type is never trusted. */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { contentType: "image/png", ext: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { contentType: "image/webp", ext: "webp" };
  return null;
}

/** PDF or image, for offer letters. */
export function sniffDocument(bytes: Uint8Array): { contentType: string; ext: string } | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return { contentType: "application/pdf", ext: "pdf" };
  return sniffImage(bytes);
}

/** Storage path scoped by institution, so a path can never point into another college's folder. */
export function mediaPath(institutionId: string, kind: MediaKind, ext: string, id: string): string {
  return `${institutionId}/${kind}-${id}.${ext}`;
}

/** Recovers our own object path from a public URL of the bucket (used to delete a replaced picture). */
export function ownPathFromPublicUrl(url: string | null, bucket: string, institutionId: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const path = decodeURIComponent(url.slice(i + marker.length));
  return path.startsWith(`${institutionId}/`) && !path.includes("..") ? path : null;
}

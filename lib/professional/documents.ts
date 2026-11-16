export const DOC_KINDS = ["resume", "certificate", "letter", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABEL: Record<DocKind, string> = { resume: "Resume", certificate: "Certifications", letter: "Letters and records", other: "Other documents" };
export const SHARES = ["me", "accepted"] as const;
export type Share = (typeof SHARES)[number];
export const SHARE_LABEL: Record<Share, string> = { me: "Only me", accepted: "Recruiters I accept" };

export const MAX_BYTES = 10 * 1024 * 1024;

type Type = { mime: string; ext: string };
const starts = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);

/** What a file really is, from its first bytes, so a renamed file is not trusted. Null when it is none of the allowed types. */
export function sniff(head: Uint8Array): Type | null {
  if (starts(head, [0x25, 0x50, 0x44, 0x46])) return { mime: "application/pdf", ext: "pdf" };
  if (starts(head, [0x89, 0x50, 0x4e, 0x47])) return { mime: "image/png", ext: "png" };
  if (starts(head, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts(head, [0x50, 0x4b, 0x03, 0x04])) return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" };
  if (starts(head, [0xd0, 0xcf, 0x11, 0xe0])) return { mime: "application/msword", ext: "doc" };
  return null;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** A file to store: not empty, not over 10 MB, and one of PDF, PNG, JPG, DOC or DOCX by its contents. */
export function checkUpload(file: { name: string; size: number }, head: Uint8Array): Checked<Type> {
  if (file.size <= 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That file is over 10 MB." };
  const type = sniff(head);
  if (!type) return { ok: false, error: "Use a PDF, PNG, JPG, DOC or DOCX file." };
  return { ok: true, value: type };
}

/** A name safe to use in a storage path and in a download header. */
export const safeName = (name: string, ext: string): string => {
  const base = name.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
  return `${base}.${ext}`;
};

export const titleFrom = (name: string): string => name.replace(/\.[^.]*$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Document";

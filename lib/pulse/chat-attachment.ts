import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { MAX_DOC_BYTES, ownsMedia, signPaths } from "./media";

/** What a chat message carries beside its text. `url` is a short-lived signed link, present only when read back. */
export interface ChatAttachment {
  name: string;
  size: number;
  mime: string;
  kind: "image" | "file";
  url: string;
}

/** The attachment a sender claims: it must live in their own `chat` folder, so nobody can attach someone else's file. */
export const AttachmentInput = z
  .object({ path: z.string().max(300), name: z.string().trim().min(1).max(200), size: z.number().int().min(1).max(MAX_DOC_BYTES), mime: z.string().max(120) })
  .strict();
export type AttachmentInput = z.infer<typeof AttachmentInput>;

export const attachmentIsOwn = (userId: string, a: AttachmentInput): boolean => ownsMedia(userId, "chat", a.path);

export interface AttachmentColumns {
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime: string | null;
}
export const attachmentColumns = (a: AttachmentInput | undefined): AttachmentColumns => ({
  attachment_path: a?.path ?? null,
  attachment_name: a?.name ?? null,
  attachment_size: a?.size ?? null,
  attachment_mime: a?.mime ?? null,
});

/** Pure. "Sent a photo" / "Sent a file: report.pdf", for a conversation preview. */
export const attachmentPreview = (a: { name: string; mime: string }): string => (a.mime.startsWith("image/") ? "Sent a photo" : `Sent a file: ${a.name}`);

/** Signs the attachments on a batch of rows in one storage call. Rows without an attachment map to null. */
export async function signAttachments<T extends Partial<AttachmentColumns>>(service: SupabaseClient<Database>, rows: T[]): Promise<(ChatAttachment | null)[]> {
  const urls = await signPaths(service, rows.map((r) => r.attachment_path));
  return rows.map((r) => {
    const url = r.attachment_path ? urls.get(r.attachment_path) : undefined;
    if (!r.attachment_path || !url) return null;
    const mime = r.attachment_mime ?? "application/octet-stream";
    return { name: r.attachment_name ?? "File", size: r.attachment_size ?? 0, mime, kind: mime.startsWith("image/") ? "image" : "file", url };
  });
}

/** Pure. Turns plain text into text and http(s) link parts so a renderer can link them without dangerouslySetInnerHTML. */
export function splitLinks(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const start = m.index ?? 0;
    const url = m[0].replace(/[.,;:!?)\]]+$/, "");
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

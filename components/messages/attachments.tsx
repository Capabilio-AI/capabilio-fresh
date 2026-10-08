"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, Loader2, Paperclip, Presentation, X } from "lucide-react";
import clsx from "clsx";
import { splitLinks, type ChatAttachment } from "@/lib/pulse/chat-attachment";

/** A file already uploaded and waiting to be sent with the next message. */
export interface PendingFile {
  path: string;
  name: string;
  size: number;
  mime: string;
  /** local preview for photos */
  preview?: string;
}

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf,.pdf,.docx,.xlsx,.pptx";
const MAX_BYTES = 10 * 1024 * 1024;

export const formatSize = (bytes: number): string => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Uploads one file to the caller's private chat folder. The server reads its real type from the bytes. */
async function uploadChatFile(file: File): Promise<PendingFile> {
  const form = new FormData();
  form.set("file", file);
  form.set("purpose", "chat");
  const res = await fetch("/api/pulse/media", { method: "POST", body: form });
  const json = (await res.json().catch(() => null)) as { path?: string; mime?: string; name?: string; size?: number; error?: string } | null;
  if (!res.ok || !json?.path || !json.mime) throw new Error(json?.error ?? "Couldn't upload the file.");
  return { path: json.path, mime: json.mime, name: json.name ?? file.name, size: json.size ?? file.size, preview: json.mime.startsWith("image/") ? URL.createObjectURL(file) : undefined };
}

/** Paperclip button: picks a photo, PDF, Word, Excel or PowerPoint file (up to 10 MB) and uploads it straight away. */
export function AttachButton({ onPicked, onError, disabled, className }: { onPicked: (f: PendingFile) => void; onError: (message: string) => void; disabled?: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) return onError("Files must be under 10 MB.");
    setBusy(true);
    try {
      onPicked(await uploadChatFile(file));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't upload the file.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} disabled={disabled || busy} aria-label="Attach a photo or file" title="Photo, PDF, Word, Excel or PowerPoint (up to 10 MB)" className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-app-muted hover:bg-app-orange-container hover:text-app-charcoal disabled:opacity-50", className)}>
        {busy ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Paperclip size={17} aria-hidden="true" />}
      </button>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label="Choose a file to attach" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );
}

function FileGlyph({ mime, size }: { mime: string; size: number }) {
  if (mime.includes("spreadsheet")) return <FileSpreadsheet size={size} aria-hidden="true" />;
  if (mime.includes("presentation")) return <Presentation size={size} aria-hidden="true" />;
  return <FileText size={size} aria-hidden="true" />;
}

/** The file chosen for the next message, with a way to take it back. */
export function PendingChip({ file, onRemove }: { file: PendingFile; onRemove: () => void }) {
  return (
    <div className="mb-2 flex w-fit max-w-full items-center gap-2.5 rounded-2xl border border-app-border bg-app-orange-container py-1.5 pl-1.5 pr-2.5">
      {file.preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={file.preview} alt="" className="h-10 w-10 rounded-xl object-cover" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-app-orange"><FileGlyph mime={file.mime} size={18} /></span>
      )}
      <span className="min-w-0">
        <span className="block max-w-[14rem] truncate text-[12.5px] font-semibold text-app-charcoal">{file.name}</span>
        <span className="block text-[11px] text-app-muted">{formatSize(file.size)}</span>
      </span>
      <button type="button" onClick={onRemove} aria-label="Remove attachment" className="rounded-full p-1 text-app-muted hover:text-app-charcoal"><X size={14} /></button>
    </div>
  );
}

/** A shared photo (opens full size) or file card (download). `mine` only tunes the colours for the sender's own bubble. */
export function MessageAttachment({ attachment, mine = false }: { attachment: ChatAttachment; mine?: boolean }) {
  if (attachment.kind === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="mb-1 block overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
        <img src={attachment.url} alt={attachment.name} loading="lazy" className="max-h-72 w-full max-w-[18rem] object-cover" />
      </a>
    );
  }
  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer" download={attachment.name} className={clsx("mb-1 flex min-w-[13rem] max-w-[18rem] items-center gap-3 rounded-xl border px-3 py-2.5 no-underline", mine ? "border-white/25 bg-white/10 text-inherit" : "border-app-border bg-app-orange-container text-app-charcoal")}>
      <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", mine ? "bg-white/15" : "bg-white/70 text-app-orange")}><FileGlyph mime={attachment.mime} size={18} /></span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold">{attachment.name}</span>
        <span className="block text-[11px] opacity-70">{formatSize(attachment.size)} · Open</span>
      </span>
    </a>
  );
}

/** Message text with http(s) links made clickable (no HTML is ever injected). */
export function Linkified({ text, mine = false }: { text: string; mine?: boolean }) {
  return (
    <>
      {splitLinks(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className={clsx("break-all underline underline-offset-2", mine ? "text-inherit" : "text-app-blue")}>
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

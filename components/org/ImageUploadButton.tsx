"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { compressImage } from "@/lib/image/compress";
import type { MediaKind } from "@/lib/org/media";

const MAX_DIMENSION: Record<MediaKind, number> = { logo: 640, cover: 1800, post: 1600 };

/** Pick an image, shrink it in the browser, upload it. Logo/cover refresh the page; post photos hand the URL back. */
export function ImageUploadButton({
  kind,
  children,
  className = "o-btn-ghost",
  onUploaded,
  label,
}: {
  kind: MediaKind;
  children: ReactNode;
  className?: string;
  onUploaded?: (url: string) => void;
  label: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    let upload: Blob = file;
    try {
      upload = await compressImage(file, MAX_DIMENSION[kind]);
    } catch {
      // fall back to the original; the server still validates the bytes
    }
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", upload, `${kind}.jpg`);
    try {
      const res = await fetch("/api/org/media", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !json?.url) {
        setError(json?.error ?? "Upload failed. Please try again.");
      } else if (onUploaded) {
        onUploaded(json.url);
      } else {
        router.refresh();
      }
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()} aria-label={label}>
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
        {children}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={onFile} aria-hidden="true" />
      {error && (
        <span role="alert" className="max-w-[16rem] text-[11.5px] text-app-rose">
          {error}
        </span>
      )}
    </span>
  );
}

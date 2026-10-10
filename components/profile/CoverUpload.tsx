"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { compressImage } from "@/lib/image/compress";

const COVER_MAX_DIMENSION = 1600;

export function CoverUpload({ hasCover }: { hasCover: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    let upload: Blob = file;
    try {
      upload = await compressImage(file, COVER_MAX_DIMENSION);
    } catch {
      // the server still validates the original
    }
    const form = new FormData();
    form.append("file", upload, "cover.jpg");
    const res = await fetch("/api/profile/cover", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed — try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 font-lp-body text-[12.5px] font-bold text-[var(--m-ink)] shadow-sm backdrop-blur hover:bg-white disabled:opacity-60">
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Camera size={14} aria-hidden />}
        {hasCover ? "Change cover" : "Add cover"}
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} className="hidden" />
      {error && <p role="alert" className="rounded-md bg-white px-2 py-1 font-lp-body text-[11.5px] text-[var(--m-accent-ink)]">{error}</p>}
    </div>
  );
}

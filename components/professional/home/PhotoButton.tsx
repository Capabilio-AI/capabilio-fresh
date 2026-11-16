"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { compressImage } from "@/lib/image/compress";

/** A small camera button on the profile photo. Shrinks the image in the browser, then sends it to the account's photo endpoint. */
export function PhotoButton({ hasPhoto }: { hasPhoto: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    let upload: Blob = file;
    try {
      upload = await compressImage(file);
    } catch {
      // the server still checks the original
    }
    const form = new FormData();
    form.append("file", upload, "avatar.jpg");
    const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return setError(data.error ?? "Upload failed. Try again.");
    }
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={hasPhoto ? "Change profile photo" : "Add profile photo"} className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full bg-[var(--m-ink)] text-white hover:bg-[var(--m-accent-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-accent)] disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} className="hidden" />
      {error && <p role="alert" className="absolute left-0 top-full mt-1 w-48 rounded-md bg-white px-2 py-1 text-[11.5px] text-[var(--m-ink)] shadow">{error}</p>}
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";

export function AvatarUpload({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed — try again.");
      return;
    }
    const data = await res.json();
    setPreview(data.avatarUrl);
    router.refresh();
  }

  return (
    <div className="relative shrink-0">
      <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-app-orange font-lp-display text-[20px] font-semibold text-white ring-2 ring-white/20">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage-hosted user avatar, arbitrary origin
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change profile picture"
        className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-app-blue text-white shadow-sm disabled:opacity-60"
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      {error && (
        <p className="absolute top-full mt-1 w-40 font-lp-body text-[11px] text-app-orange">{error}</p>
      )}
    </div>
  );
}

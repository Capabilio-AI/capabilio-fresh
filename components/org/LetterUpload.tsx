"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip } from "lucide-react";

/** Attach (or replace) the company's offer letter on an existing placement. */
export function LetterUpload({ placementId, replace = false }: { placementId: string; replace?: boolean }) {
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
    const form = new FormData();
    form.append("placementId", placementId);
    form.append("file", file);
    try {
      const res = await fetch("/api/org/offers/letter", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) setError(json?.error ?? "Upload failed. Please try again.");
      else router.refresh();
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={onFile} aria-label="Offer letter file" />
      <button type="button" className="o-btn-ghost !py-1.5" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Paperclip size={13} aria-hidden="true" />} {replace ? "Replace letter" : "Attach letter"}
      </button>
      {error && (
        <span role="alert" className="text-[11.5px] text-app-rose">
          {error}
        </span>
      )}
    </span>
  );
}

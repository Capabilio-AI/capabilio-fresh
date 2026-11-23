"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, Loader2 } from "lucide-react";

/** Claim the Proven Skill credential for a course the student has fully proven. They choose whether their name appears on the public page. */
export function ClaimCredential({ track, title }: { track: string; title: string }) {
  const [showName, setShowName] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function claim() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ track, showName, showCode }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
      setUrl(data.url as string);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (url) return <p role="status" className="text-[14.5px] font-bold text-[#0f5132]">Done. <Link href={url} className="underline">Open your {title} credential</Link></p>;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-start gap-2 text-[14px] text-[var(--m-ink)]"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="mt-1" />Show my name on the public page</label>
      <label className="flex items-start gap-2 text-[14px] text-[var(--m-ink)]"><input type="checkbox" checked={showCode} onChange={(e) => setShowCode(e.target.checked)} className="mt-1" /><span>Show the code I wrote to people I share this with. <span className="text-[var(--m-muted)]">Recruiters trust a certificate more when they can see real work. You can change this later.</span></span></label>
      <div>
        <button type="button" onClick={() => void claim()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Award size={15} aria-hidden />}Get my {title} credential
        </button>
      </div>
      {error && <p role="alert" className="text-[13.5px] font-semibold text-red-700">{error}</p>}
    </div>
  );
}

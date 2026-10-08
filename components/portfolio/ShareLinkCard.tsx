"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { enablePortfolioSharing, disablePortfolioSharing } from "@/app/(app)/dashboard/portfolio/actions";

interface ShareLinkCardProps {
  initialUrl: string | null;
  initialIsPublic: boolean;
}

/** Owner-only. Generates (once) and toggles the public, read-only portfolio link recruiters use. */
export function ShareLinkCard({ initialUrl, initialIsPublic }: ShareLinkCardProps) {
  const [url, setUrl] = useState(initialUrl);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setBusy(true);
    setError(null);
    if (isPublic) {
      await disablePortfolioSharing();
      setIsPublic(false);
    } else {
      const result = await enablePortfolioSharing();
      if ("error" in result) setError(result.error);
      else {
        setUrl(result.url);
        setIsPublic(true);
      }
    }
    setBusy(false);
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-3xl border border-[#E0E0E0] bg-white p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-lp-display text-[17px] font-bold text-[var(--m-ink)]">
            <Link2 size={16} />
            Share your portfolio
          </h2>
          <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">Anyone with this link can view your evidence — no account needed. Turn it off any time.</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={busy}
          className={`shrink-0 rounded-full px-4 py-2 font-lp-body text-[12.5px] font-semibold disabled:opacity-60 ${isPublic ? "bg-app-background text-[var(--m-ink)]" : "bg-app-orange text-white"}`}
        >
          {isPublic ? "Turn off sharing" : "Get shareable link"}
        </button>
      </div>

      {error && <p className="mt-3 font-lp-body text-[12.5px] text-app-rose">{error}</p>}

      {isPublic && url && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--m-rule)] bg-app-background px-4 py-2.5">
          <span className="min-w-0 flex-1 truncate font-lp-mono text-[12.5px] text-[var(--m-ink)]">{url}</span>
          <button type="button" onClick={handleCopy} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-lp-mono text-[11.5px] font-semibold text-[var(--m-ink)]">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </section>
  );
}

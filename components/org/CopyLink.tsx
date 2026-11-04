"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

/** A read-only link with a Copy button. The path is joined to the current origin in the browser, so it is right on every domain. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${path}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url());
    }
  }
  return (
    <div className="flex items-center gap-2">
      <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--m-rule)] bg-app-background px-3 py-2 font-lp-mono text-[12px] text-app-muted">
        <Link2 size={14} aria-hidden className="shrink-0" />
        <span className="truncate" title={path}>…{path}</span>
      </span>
      <button type="button" onClick={copy} className="o-btn shrink-0" aria-live="polite">
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies text to the clipboard; falls back to a prompt if the browser blocks it. */
export function CopyButton({ text, label = "Copy link", className = "o-btn-ghost" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy this link", text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}

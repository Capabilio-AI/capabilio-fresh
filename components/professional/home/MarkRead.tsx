"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await fetch("/api/professional/notifications/read", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" onClick={run} disabled={busy} className="rounded-full border border-[var(--m-rule)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)] disabled:opacity-50">Mark all as read</button>;
}

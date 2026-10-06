"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ImportStatus } from "@/lib/curriculum/mapping-rules";
import { api } from "./api";

/** Moves a curriculum to another review status (never to PUBLISHED — that is the publish step). */
export function StatusButton({ importId, to, label, ghost, then }: { importId: string; to: Exclude<ImportStatus, "PUBLISHED" | "ARCHIVED">; label: string; ghost?: boolean; then?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    const r = await api("PATCH", `/api/admin/curriculum/imports/${importId}`, { status: to });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (then) router.push(then);
    else router.refresh();
  }
  return (
    <span>
      <button type="button" className={ghost ? "o-btn-ghost" : "o-btn"} onClick={go} disabled={busy}>{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} {label}</button>
      {error && <span className="ml-3 font-lp-body text-[12px] text-app-rose" role="alert">{error}</span>}
    </span>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "./api";

/** Starts an editable copy of a published curriculum and opens it. */
export function NewVersionButton({ importId, ghost }: { importId: string; ghost?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true);
    setError(null);
    const r = await api<{ id: string }>("POST", `/api/admin/curriculum/imports/${importId}/new-version`);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push(`/org/curriculum/${r.data.id}?step=courses`);
  }
  return (
    <span>
      <button type="button" className={ghost ? "o-btn-ghost !px-3 !py-1.5 !text-[12px]" : "o-btn"} onClick={start} disabled={busy}>{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Create a new version</button>
      {error && <span className="ml-3 font-lp-body text-[12px] text-app-rose" role="alert">{error}</span>}
    </span>
  );
}

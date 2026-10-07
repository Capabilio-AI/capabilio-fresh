"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "./api";

/** Starts a curriculum for another regulation of this branch (kept separate from the others) and opens it. */
export function AddRegulation({ branch }: { branch: string }) {
  const router = useRouter();
  const [regulation, setRegulation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `add-reg-${branch.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  async function start() {
    setBusy(true);
    setError(null);
    const r = await api<{ id: string }>("POST", "/api/admin/curriculum/imports", { branch, regulation: regulation.trim() });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push(`/org/curriculum/${r.data.id}?step=courses`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label htmlFor={id} className="mb-1 block font-lp-mono text-[11px] text-app-muted">New regulation</label>
          <input id={id} className="o-input" value={regulation} onChange={(e) => setRegulation(e.target.value)} placeholder="e.g. R23" maxLength={80} />
        </div>
        <button type="button" className="o-btn-ghost" disabled={busy || !regulation.trim()} onClick={start}>{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Add regulation</button>
      </div>
      {error && <p className="mt-2 font-lp-body text-[12px] text-app-rose" role="alert">{error}</p>}
    </div>
  );
}

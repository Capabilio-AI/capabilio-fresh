"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface OpenGroupOption { id: string; label: string }

/** Staff pick a forming group for a student who is in none. The server re-checks the rights and every joining rule. */
export function AddToGroup({ userId, groups }: { userId: string; groups: OpenGroupOption[] }) {
  const router = useRouter();
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/groups/add-member", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, userId }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setBusy(false);
    }
  }

  if (groups.length === 0) return <span className="font-lp-body text-[12px] text-app-muted">No group has a free slot</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Group to add this student to" className="o-input !w-auto !py-1 text-[12.5px]">
        <option value="">Add to a group…</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
      </select>
      <button type="button" onClick={add} disabled={!groupId || busy} className="o-btn !px-3 !py-1">{busy ? "Adding…" : "Add"}</button>
      {error && <span role="alert" className="font-lp-body text-[12px] text-app-rose">{error}</span>}
    </span>
  );
}

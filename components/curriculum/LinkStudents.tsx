"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { BranchBoard } from "@/lib/curriculum/cohorts";
import { api } from "./api";

/** Links a branch's students (all, or one graduating batch) to a regulation, so each gets that regulation's curriculum without setting it themselves. */
export function LinkStudents({ board }: { board: BranchBoard }) {
  const router = useRouter();
  const [regulation, setRegulation] = useState(board.knownRegulations[0] ?? "");
  const [endYear, setEndYear] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = `link-${board.key.replace(/[^a-z0-9]+/g, "-")}`;

  if (board.students === 0 || board.knownRegulations.length === 0) return null;

  async function assign() {
    setBusy(true);
    setMsg(null);
    const r = await api<{ updated: number }>("POST", "/api/admin/curriculum/cohorts/regulation", { branch: board.branch, regulation, endYear: endYear ? Number(endYear) : null, overwrite });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: r.data.updated === 0 ? "No students needed changing." : `${r.data.updated} student${r.data.updated === 1 ? "" : "s"} linked to ${regulation}.` });
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-app-border p-4">
      <p className="font-lp-body text-[13px] font-semibold text-app-charcoal">Link students to a regulation</p>
      <p className="mt-1 font-lp-body text-[12px] text-app-muted">Pick the batch that studies under a regulation. They get that curriculum in their roadmap. Students who already chose their own regulation are left alone unless you tick replace.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[160px_180px_auto] sm:items-end">
        <div>
          <label htmlFor={`${id}-reg`} className="mb-1 block font-lp-mono text-[11px] text-app-muted">Regulation</label>
          <select id={`${id}-reg`} className="o-input" value={regulation} onChange={(e) => setRegulation(e.target.value)}>{board.knownRegulations.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        </div>
        <div>
          <label htmlFor={`${id}-batch`} className="mb-1 block font-lp-mono text-[11px] text-app-muted">Batch (graduating in)</label>
          <select id={`${id}-batch`} className="o-input" value={endYear} onChange={(e) => setEndYear(e.target.value)}>
            <option value="">Every batch</option>
            {board.endYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" className="o-btn" disabled={busy || !regulation} onClick={assign}>{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Link students</button>
      </div>
      <label className="mt-3 flex items-center gap-2 font-lp-body text-[12px] text-app-muted"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Replace regulations students already set</label>
      {msg && <p className={`mt-2 font-lp-body text-[12.5px] ${msg.ok ? "text-app-success" : "text-app-rose"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </div>
  );
}

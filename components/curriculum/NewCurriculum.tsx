"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { searchBranches } from "@/lib/branch-catalog";
import type { ExtractionRecord } from "@/lib/roadmap/extract/types";
import { Panel } from "@/components/org/ui";
import { api } from "./api";
import { SyllabusExtraction } from "./SyllabusExtraction";
import { TemplateUpload } from "./TemplateUpload";

/** The two ways to begin: read a syllabus PDF, or start an empty curriculum and type the courses in. */
export function NewCurriculum({ extraction, roleKey }: { extraction: ExtractionRecord | null; roleKey: string }) {
  const router = useRouter();
  const [branch, setBranch] = useState("");
  const [regulation, setRegulation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await api<{ id: string }>("POST", "/api/admin/curriculum/imports", { branch: branch.trim(), regulation: regulation.trim() || null });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push(`/org/curriculum/${r.data.id}?step=courses`);
  }

  return (
    <div className="flex flex-col gap-4">
      <TemplateUpload />
      <SyllabusExtraction initial={extraction} roleKey={roleKey} />
      <Panel title="Or start by hand">
        <p className="font-lp-body text-[12px] text-app-muted">No PDF? Start an empty curriculum for a branch and add the courses yourself (typed in, or pasted from a CSV).</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div>
            <label htmlFor="nc-branch" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Branch</label>
            <input id="nc-branch" list="nc-branch-options" className="o-input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Start typing, e.g. Computer Science" autoComplete="off" />
            <datalist id="nc-branch-options">{(branch.trim() ? searchBranches(branch) : []).map((b) => <option key={b.name} value={b.name} />)}</datalist>
          </div>
          <div><label htmlFor="nc-reg" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Regulation (optional)</label><input id="nc-reg" className="o-input" value={regulation} onChange={(e) => setRegulation(e.target.value)} placeholder="e.g. R23" maxLength={80} /></div>
          <button type="button" className="o-btn" disabled={busy || !branch.trim()} onClick={start}>{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Start</button>
        </div>
        {error && <p className="mt-2 font-lp-body text-[12px] text-app-rose" role="alert">{error}</p>}
      </Panel>
    </div>
  );
}

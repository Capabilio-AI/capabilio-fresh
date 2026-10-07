"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { searchBranches } from "@/lib/branch-catalog";
import type { TemplateIssue } from "@/lib/curriculum/template/parse";
import { Panel } from "@/components/org/ui";

/** The recommended path: one filled spreadsheet per branch and regulation. Read exactly as written, so it is fast and nothing is guessed. */
export function TemplateUpload() {
  const router = useRouter();
  const [branch, setBranch] = useState("");
  const [regulation, setRegulation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<TemplateIssue[]>([]);

  async function upload() {
    if (!file || !branch.trim()) return setError("Choose a branch and the filled template file.");
    setBusy(true);
    setError(null);
    setIssues([]);
    const form = new FormData();
    form.set("file", file);
    form.set("branch", branch.trim());
    form.set("regulation", regulation.trim());
    try {
      const res = await fetch("/api/admin/curriculum/template", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as { id?: string; error?: string; issues?: TemplateIssue[] } | null;
      if (!res.ok || !json?.id) {
        setError(json?.error ?? "Could not read the file.");
        setIssues(json?.issues ?? []);
        return;
      }
      router.push(`/org/curriculum/${json.id}`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Upload in the Capabilio template (fastest)">
      <p className="font-lp-body text-[12px] text-app-muted">
        One spreadsheet per branch and regulation: courses, units, topics, outcomes, labs and the skills each builds. We read it exactly as written, so there is no guessing and students get their skills sooner. Anything you leave out is read or worked out from the rest, and you review it before publishing.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="/org/curriculum/template/universal" download className="o-btn-ghost !px-3 !py-1.5 !text-[12px]"><Download size={12} aria-hidden="true" /> Download the template</a>
        <a href="/org/curriculum/template/skills" download className="o-btn-ghost !px-3 !py-1.5 !text-[12px]"><Download size={12} aria-hidden="true" /> Skills list for the SKILL rows</a>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_1fr]">
        <div>
          <label htmlFor="tpl-branch" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Branch</label>
          <input id="tpl-branch" list="tpl-branch-options" className="o-input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Start typing, e.g. Computer Science" autoComplete="off" />
          <datalist id="tpl-branch-options">{(branch.trim() ? searchBranches(branch) : []).map((b) => <option key={b.name} value={b.name} />)}</datalist>
        </div>
        <div>
          <label htmlFor="tpl-reg" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Regulation</label>
          <input id="tpl-reg" className="o-input" value={regulation} onChange={(e) => setRegulation(e.target.value)} placeholder="e.g. R23" maxLength={80} />
        </div>
        <div>
          <label htmlFor="tpl-file" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Filled template (.csv)</label>
          <input id="tpl-file" type="file" accept=".csv,text/csv" className="o-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <div className="mt-3"><button type="button" className="o-btn" disabled={busy || !file || !branch.trim()} onClick={upload}>{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Import template</button></div>
      {error && (
        <div className="mt-3" role="alert">
          <p className="font-lp-body text-[12.5px] text-app-rose">{error}</p>
          {issues.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 font-lp-body text-[12px] text-app-muted">
              {issues.map((i, n) => <li key={n}>{i.line > 0 ? `Line ${i.line}: ` : ""}{i.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { searchBranches } from "@/lib/branch-catalog";
import type { ExtractionErrorCode, ExtractionRecord } from "@/lib/roadmap/extract/types";
import { Panel } from "@/components/org/ui";

const POLL_MS = 2500;
const MAX_MB = 15;

const FAILURE: Record<ExtractionErrorCode, string> = {
  no_text_layer: "We couldn't read this file — it looks like a scan with no selectable text. Start the curriculum by hand, or upload a digitally generated PDF.",
  unrecognised_format: "We couldn't find semester tables in this PDF. Start the curriculum by hand instead.",
  unreadable: "We couldn't read this file. It may be damaged, password-protected or too long.",
  ai_unavailable: "The reader is unavailable right now. Please try again in a few minutes.",
  internal: "The extraction didn't finish. Please try again.",
};

interface Props {
  initial: ExtractionRecord | null;
  roleKey: string;
}

/** Upload → background read (polled) → a draft curriculum to review. The PDF itself is never stored. */
export function SyllabusExtraction({ initial, roleKey }: Props) {
  const router = useRouter();
  const [extraction, setExtraction] = useState<ExtractionRecord | null>(initial);
  const [branch, setBranch] = useState(initial?.branch ?? "");
  const [regulation, setRegulation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processing = extraction?.status === "processing";
  useEffect(() => {
    if (!processing || !extraction) return;
    const id = extraction.id;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/admin/curriculum/extractions/${id}`);
      if (!res.ok) return;
      const json = (await res.json()) as { extraction: ExtractionRecord };
      setExtraction(json.extraction);
      if (json.extraction.status !== "processing") router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [processing, extraction, router]);

  async function upload() {
    if (!file || !branch.trim()) return setError("Choose a branch and a PDF.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`The PDF must be under ${MAX_MB} MB.`);
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("branch", branch.trim());
    form.set("roleKey", roleKey);
    form.set("regulation", regulation.trim());
    const res = await fetch("/api/admin/curriculum/extractions", { method: "POST", body: form });
    const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
    setBusy(false);
    if (!res.ok || !json?.id) return setError(json?.error ?? "Could not start the extraction.");
    setFile(null);
    setExtraction({ id: json.id, branch: branch.trim(), fileName: file.name, status: "processing", chunksDone: 0, chunksTotal: 0, errorCode: null, result: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  async function reset() {
    if (extraction) await fetch(`/api/admin/curriculum/extractions/${extraction.id}`, { method: "DELETE" });
    setExtraction(null);
    router.refresh();
  }

  const percent = extraction && extraction.chunksTotal > 0 ? Math.round((extraction.chunksDone / extraction.chunksTotal) * 100) : 4;
  const importId = extraction?.result?.importId ?? null;

  return (
    <Panel title="No template? Upload any syllabus PDF">
      <p className="font-lp-body text-[12px] text-app-muted">
        Upload one branch and one regulation at a time (a digital PDF, up to {MAX_MB} MB). If the regulation is printed in the PDF header we use it; a regulation you type here takes priority. We read the semester tables, units and topics, course outcomes, labs and books, then work out the skills each course builds, into a draft you review. Nothing is saved to students until you review, confirm and publish.
      </p>

      {!extraction && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_1fr]">
            <div>
              <label htmlFor="ext-branch" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Branch this syllabus is for</label>
              <input id="ext-branch" list="ext-branch-options" className="o-input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Start typing, e.g. Computer Science" autoComplete="off" />
              <datalist id="ext-branch-options">{(branch.trim() ? searchBranches(branch) : []).map((b) => <option key={b.name} value={b.name} />)}</datalist>
            </div>
            <div>
              <label htmlFor="ext-reg" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Regulation (optional)</label>
              <input id="ext-reg" className="o-input" value={regulation} onChange={(e) => setRegulation(e.target.value)} placeholder="e.g. R23" maxLength={80} />
            </div>
            <div>
              <label htmlFor="ext-file" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Syllabus PDF</label>
              <input id="ext-file" type="file" accept=".pdf,application/pdf" className="o-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div><button type="button" className="o-btn" disabled={busy || !file} onClick={upload}>{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Read syllabus</button></div>
          {error && <p className="font-lp-body text-[12px] text-app-rose" role="alert">{error}</p>}
        </div>
      )}

      {processing && extraction && (
        <div className="mt-4" role="status">
          <p className="font-lp-body text-[13px] text-app-charcoal">Reading <span className="font-medium">{extraction.fileName}</span>… this takes a minute or two for a long syllabus.</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: "var(--o-gradient)" }} /></div>
          <p className="mt-2 font-lp-body text-[12px] text-app-muted">You can leave this page — it keeps going, and the draft will be waiting in the list below.</p>
        </div>
      )}

      {extraction?.status === "failed" && (
        <div className="mt-4">
          <p className="font-lp-body text-[13px] text-app-rose" role="alert">{FAILURE[extraction.errorCode ?? "internal"]}</p>
          <button type="button" className="o-btn-ghost mt-3" onClick={reset}>Try another file</button>
        </div>
      )}

      {extraction?.status === "ready" && (
        <div className="mt-4" role="status">
          {importId ? (
            <>
              <p className="font-lp-body text-[13px] text-app-success">Done — a draft curriculum for {extraction.branch} is ready for your review.</p>
              {extraction.result?.warnings.map((w) => <p key={w} className="mt-1 font-lp-body text-[12px] text-app-warning">{w}</p>)}
              <Link href={`/org/curriculum/${importId}`} className="o-btn mt-3 inline-flex">Review the draft</Link>
            </>
          ) : (
            <>
              <p className="font-lp-body text-[13px] text-app-rose" role="alert">We read the syllabus but couldn&apos;t save the draft. Nothing was changed — please try again.</p>
              <button type="button" className="o-btn-ghost mt-3" onClick={reset}>Try again</button>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

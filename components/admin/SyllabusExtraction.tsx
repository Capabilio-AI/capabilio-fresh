"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { searchBranches } from "@/lib/branch-catalog";
import type { ExtractionErrorCode, ExtractionRecord } from "@/lib/roadmap/extract/types";
import { ExtractionReview } from "./ExtractionReview";

const POLL_MS = 2500;
const MAX_MB = 15;

const FAILURE: Record<ExtractionErrorCode, string> = {
  no_text_layer: "We couldn't read this file — it looks like a scan with no selectable text. Use the CSV template, or upload a digitally generated PDF.",
  unrecognised_format: "We couldn't find semester tables in this PDF. Use the CSV template instead.",
  unreadable: "We couldn't read this file. It may be damaged, password-protected or too long.",
  ai_unavailable: "The reader is unavailable right now. Please try again in a few minutes.",
  internal: "The extraction didn't finish. Please try again.",
};

interface Props {
  initial: ExtractionRecord | null;
  roleKey: string;
  areas: { key: string; name: string }[];
  onMessage: (m: string) => void;
}

/** Third input method: upload → background read (poll) → editable review → import through the existing routes. */
export function SyllabusExtraction({ initial, roleKey, areas, onMessage }: Props) {
  const router = useRouter();
  const [extraction, setExtraction] = useState<ExtractionRecord | null>(initial);
  const [branch, setBranch] = useState(initial?.branch ?? "");
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
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [processing, extraction]);

  async function upload() {
    if (!file || !branch.trim()) return setError("Choose a branch and a PDF.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`The PDF must be under ${MAX_MB} MB.`);
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("branch", branch.trim());
    form.set("roleKey", roleKey);
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

  return (
    <section className="o-card p-5">
      <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Extract from a syllabus PDF</h2>
      <p className="mt-1 font-lp-body text-[12px] text-app-muted">
        Upload your college&apos;s syllabus (a digital PDF, up to {MAX_MB} MB). We read the semester tables and course outcomes, then show you what we found. Nothing is saved until you review and import.
      </p>

      {!extraction && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ext-branch" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Branch this syllabus is for</label>
              <input id="ext-branch" list="ext-branch-options" className="o-input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Start typing, e.g. Computer Science" autoComplete="off" />
              <datalist id="ext-branch-options">{(branch.trim() ? searchBranches(branch) : []).map((b) => <option key={b.name} value={b.name} />)}</datalist>
            </div>
            <div>
              <label htmlFor="ext-file" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Syllabus PDF</label>
              <input id="ext-file" type="file" accept=".pdf,application/pdf" className="o-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div>
            <button type="button" className="o-btn" disabled={busy || !file} onClick={upload}>
              {busy && <Loader2 size={13} className="animate-spin" />} Read syllabus
            </button>
          </div>
          {error && <p className="font-lp-body text-[12px] text-app-orange" role="alert">{error}</p>}
        </div>
      )}

      {processing && extraction && (
        <div className="mt-4" role="status">
          <p className="font-lp-body text-[13px] text-app-charcoal">Reading <span className="font-medium">{extraction.fileName}</span>… this takes a minute or two for a long syllabus.</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: "var(--o-gradient)" }} /></div>
          <p className="mt-2 font-lp-body text-[12px] text-app-muted">You can leave this page — it keeps going, and the result will be waiting here when you come back.</p>
        </div>
      )}

      {extraction?.status === "failed" && (
        <div className="mt-4">
          <p className="font-lp-body text-[13px] text-app-orange" role="alert">{FAILURE[extraction.errorCode ?? "internal"]}</p>
          <button type="button" className="o-btn-ghost mt-3" onClick={reset}>Try another file</button>
        </div>
      )}

      {extraction?.status === "ready" && extraction.result && (
        <ExtractionReview
          key={extraction.id}
          extraction={{ ...extraction, result: extraction.result }}
          roleKey={roleKey}
          areas={areas}
          onDone={(m) => {
            onMessage(m);
            setExtraction(null);
          }}
        />
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import type { CourseRow } from "@/lib/curriculum/admin-data";
import type { HighConfidencePreview } from "@/lib/curriculum/mapping-writes";
import { Panel, Pill } from "@/components/org/ui";
import { api } from "./api";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  importId: string;
  courses: CourseRow[];
  editable: boolean;
}

const MIN = 0.9;

/** Suggest skills (bounded batches, repeated until done), confirm the high-confidence ones after a preview, and review each course. */
export function MappingsStep({ importId, courses, editable }: Props) {
  const router = useRouter();
  const pending = courses.filter((c) => !c.skillsSuggested).length;
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<HighConfidencePreview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function suggestAll() {
    setRunning(true);
    setError(null);
    let done = 0;
    const total = pending;
    for (let guard = 0; guard < 50; guard++) {
      const r = await api<{ processed: number; remaining: number; suggested: number; failedBatches: number }>("POST", `/api/admin/curriculum/imports/${importId}/suggest-skills`);
      if (!r.ok) { setError(r.error); break; }
      done += r.data.processed;
      setProgress(`Read ${Math.min(done, total)} of ${total} courses…`);
      router.refresh();
      if (r.data.remaining === 0) { setProgress(`Done — ${total} course${total === 1 ? "" : "s"} read. Review the suggestions below.`); break; }
      if (r.data.processed === 0) { setError("Some courses couldn't be read right now. Try again in a minute."); break; }
    }
    setRunning(false);
  }

  async function openPreview() {
    setError(null);
    const r = await api<{ preview: HighConfidencePreview }>("POST", `/api/admin/curriculum/imports/${importId}/confirm-high-confidence`, { preview: true, minConfidence: MIN });
    if (!r.ok) return setError(r.error);
    setPreview(r.data.preview);
    setOpen(true);
  }
  async function confirmAll() {
    if (!preview) return;
    setBusy(true);
    const r = await api("POST", `/api/admin/curriculum/imports/${importId}/confirm-high-confidence`, { preview: false, minConfidence: MIN, expectedCount: preview.count });
    setBusy(false);
    setOpen(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  const review = courses.filter((c) => c.suggested > 0).length;
  return (
    <div className="flex flex-col gap-4">
      {editable && (
        <Panel title="Suggest skills">
          <p className="font-lp-body text-[12.5px] leading-relaxed text-app-muted">The AI reads each course&apos;s outcomes, units and labs and suggests skills from the Capabilio catalog, with the sentence that justifies each one. It only suggests — nothing counts until you confirm it.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="o-btn" onClick={suggestAll} disabled={running || pending === 0}>{running ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />} {pending === 0 ? "All courses read" : `Suggest skills for ${pending} course${pending === 1 ? "" : "s"}`}</button>
            <button type="button" className="o-btn-ghost" onClick={openPreview} disabled={running}>Confirm high-confidence suggestions…</button>
            {progress && <p className="font-lp-body text-[12.5px] text-app-muted" role="status">{progress}</p>}
          </div>
          {error && <p className="mt-2 font-lp-body text-[12.5px] text-app-rose" role="alert">{error}</p>}
        </Panel>
      )}
      <Panel>
        <p className="font-lp-body text-[13px] text-app-charcoal">{review} course{review === 1 ? " has" : "s have"} suggestions waiting for review.</p>
      </Panel>
      <ul className="flex flex-col gap-2">
        {courses.map((c) => (
          <li key={c.id} className="o-card !rounded-xl flex flex-wrap items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{c.title}</p>
              <p className="font-lp-mono text-[11px] text-app-muted">Year {c.year}{c.semester ? ` · Semester ${c.semester}` : ""}</p>
            </div>
            {c.confirmed > 0 && <Pill tone="ok">{c.confirmed} confirmed</Pill>}
            {c.suggested > 0 && <Pill tone="warn">{c.suggested} to review</Pill>}
            {c.rejected > 0 && <Pill tone="bad">{c.rejected} rejected</Pill>}
            {c.confirmed + c.suggested + c.rejected === 0 && <Pill>{c.skillsSuggested ? "No skills suggested" : "Not read yet"}</Pill>}
            <Link href={`/org/curriculum/${importId}/courses/${c.id}#skills`} className="o-btn-ghost !px-3 !py-1.5 !text-[12px]">{c.suggested > 0 ? "Review skills" : "Open"}</Link>
          </li>
        ))}
      </ul>

      <ConfirmDialog open={open} title="Confirm high-confidence suggestions" confirmLabel={`Confirm ${preview?.count ?? 0}`} confirmDisabled={!preview || preview.count === 0} busy={busy} onCancel={() => setOpen(false)} onConfirm={confirmAll}>
        {preview && preview.count > 0 ? (
          <>
            <p>{preview.count} suggestion{preview.count === 1 ? "" : "s"} at {Math.round(MIN * 100)}% confidence or higher across {preview.courses} course{preview.courses === 1 ? "" : "s"} ({preview.courseLevel} course-level, {preview.outcomeLevel} outcome-level) will be confirmed as yours. Nothing else changes.</p>
            <ul className="mt-3 max-h-40 overflow-y-auto font-lp-mono text-[11.5px]">
              {preview.sample.map((s, i) => <li key={i}>{s.course} → {s.skill} ({Math.round(s.confidence * 100)}%)</li>)}
              {preview.courseLevel > preview.sample.length && <li>…and {preview.courseLevel - preview.sample.length} more</li>}
            </ul>
          </>
        ) : (
          <p>There are no suggestions at {Math.round(MIN * 100)}% confidence or higher to confirm.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}

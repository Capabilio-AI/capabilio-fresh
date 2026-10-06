"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ImportStatus } from "@/lib/curriculum/mapping-rules";
import { Panel } from "@/components/org/ui";
import { api } from "./api";
import { ConfirmDialog } from "./ConfirmDialog";
import { NewVersionButton } from "./NewVersionButton";

interface Props {
  importId: string;
  status: ImportStatus;
  branch: string;
  regulation: string | null;
  versionNo: number | null;
}

/** Publishing is the one irreversible step, so it is a deliberate, explained click. */
export function PublishStep({ importId, status, branch, regulation, versionNo }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    const r = await api("POST", `/api/admin/curriculum/imports/${importId}/publish`);
    setBusy(false);
    setOpen(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  if (status === "PUBLISHED" || status === "ARCHIVED") {
    return (
      <Panel title={status === "PUBLISHED" ? "Published" : "Archived"}>
        <p className="font-lp-body text-[13px] text-app-charcoal">{status === "PUBLISHED" ? `Version ${versionNo ?? 1} is live for ${branch} students.` : `This version was replaced by a newer one${versionNo ? ` (it was version ${versionNo})` : ""}. It is kept for the record.`}</p>
        <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">A published version never changes. To make a correction, create a new version; publishing it archives this one.</p>
        {status === "PUBLISHED" && <p className="mt-3"><NewVersionButton importId={importId} /></p>}
        <p className="mt-3"><Link href="/org/curriculum" className="font-lp-body text-[12.5px] text-app-blue hover:underline">Back to all curricula</Link></p>
      </Panel>
    );
  }
  if (status !== "CONFIRMED") {
    return (
      <Panel title="Publish">
        <p className="font-lp-body text-[13px] text-app-muted">Confirm the curriculum first. Publishing is available once your review is marked complete.</p>
        <p className="mt-3"><Link href={`/org/curriculum/${importId}?step=confirm`} className="o-btn-ghost">Go to confirm</Link></p>
      </Panel>
    );
  }
  return (
    <Panel title="Publish">
      <p className="font-lp-body text-[13px] leading-relaxed text-app-charcoal">Publishing makes this curriculum visible to {branch} students{regulation ? ` (${regulation})` : ""}. Only the skill mappings you confirmed shape their roadmaps; AI suggestions never do.</p>
      <ul className="mt-3 list-disc pl-5 font-lp-body text-[12.5px] leading-relaxed text-app-muted">
        <li>It becomes an immutable version. To change anything later you create a new version.</li>
        <li>An older published version of the same regulation is archived, not deleted.</li>
        <li>Who confirmed and published, and when, is recorded.</li>
      </ul>
      <button type="button" className="o-btn mt-4" onClick={() => setOpen(true)}>Publish curriculum</button>
      {error && <p className="mt-3 font-lp-body text-[12.5px] text-app-rose" role="alert">{error}</p>}
      <ConfirmDialog open={open} title="Publish this curriculum?" confirmLabel={busy ? "Publishing…" : "Publish"} busy={busy} onCancel={() => setOpen(false)} onConfirm={publish}>
        <p>This can&apos;t be undone — a published version is permanent. Students in {branch} will see their roadmap built from it.</p>
        {busy && <Loader2 size={14} className="mt-2 animate-spin" aria-hidden="true" />}
      </ConfirmDialog>
    </Panel>
  );
}

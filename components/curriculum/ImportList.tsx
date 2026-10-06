"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ImportListItem } from "@/lib/curriculum/admin-data";
import { Panel } from "@/components/org/ui";
import { StatusPill, yearsLabel } from "./bits";
import { api } from "./api";
import { ConfirmDialog } from "./ConfirmDialog";
import { NewVersionButton } from "./NewVersionButton";

/** All of the college's curricula: in progress first, then published, then archived. Deleting is a confirmed soft delete (never for a published one). */
export function ImportList({ items }: { items: ImportListItem[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<ImportListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const r = await api("DELETE", `/api/admin/curriculum/imports/${removing.id}`);
    setBusy(false);
    setRemoving(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  const groups: [string, ImportListItem[]][] = [
    ["In progress", items.filter((i) => !["PUBLISHED", "ARCHIVED"].includes(i.status))],
    ["Published", items.filter((i) => i.status === "PUBLISHED")],
    ["Archived", items.filter((i) => i.status === "ARCHIVED")],
  ];
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-app-border px-4 py-8 text-center font-lp-body text-[13px] text-app-muted">No curricula yet. Upload a syllabus or start one by hand above.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {error && <p className="font-lp-body text-[12.5px] text-app-rose" role="alert">{error}</p>}
      {groups.filter(([, list]) => list.length > 0).map(([label, list]) => (
        <section key={label} aria-label={label}>
          <h2 className="o-eyebrow mb-2">{label}</h2>
          <ul className="flex flex-col gap-2">
            {list.map((i) => (
              <li key={i.id}>
                <Panel className="!p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/org/curriculum/${i.id}`} className="font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">{i.branch}{i.regulation ? ` · ${i.regulation}` : ""}{i.versionNo ? ` · v${i.versionNo}` : ""}</Link>
                      <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">{yearsLabel(i.summary.years)} · {i.summary.courses} courses · {i.summary.outcomes} outcomes · {i.summary.confirmedMappings} confirmed skills{i.summary.mappingsNeedingReview > 0 ? ` · ${i.summary.mappingsNeedingReview} to review` : ""}</p>
                    </div>
                    <StatusPill status={i.status} />
                    <Link href={`/org/curriculum/${i.id}`} className="o-btn-ghost !px-3 !py-1.5 !text-[12px]">{i.status === "PUBLISHED" || i.status === "ARCHIVED" ? "View" : "Continue review"}</Link>
                    {i.status === "PUBLISHED" && <NewVersionButton importId={i.id} ghost />}
                    {i.status !== "PUBLISHED" && i.status !== "ARCHIVED" && (
                      <button type="button" aria-label={`Delete ${i.branch}${i.regulation ? ` ${i.regulation}` : ""}`} className="text-app-muted hover:text-app-charcoal" onClick={() => setRemoving(i)}><Trash2 size={14} aria-hidden="true" /></button>
                    )}
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ConfirmDialog open={removing !== null} title={`Delete this ${removing?.branch ?? ""} curriculum?`} confirmLabel="Delete" danger busy={busy} onCancel={() => setRemoving(null)} onConfirm={remove}>
        It disappears from your list. Nothing has been published, so students are not affected.
      </ConfirmDialog>
    </div>
  );
}

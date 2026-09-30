"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { CandidateRow, ExtractionRecord } from "@/lib/roadmap/extract/types";

interface Props {
  extraction: ExtractionRecord & { result: NonNullable<ExtractionRecord["result"]> };
  roleKey: string;
  areas: { key: string; name: string }[];
  onDone: (message: string) => void;
}

interface EditRow extends CandidateRow {
  include: boolean;
  areaKeys: string[];
}

const NOTE: Record<CandidateRow["mappingNote"], string> = {
  suggested: "Suggested from the course outcomes",
  none_confident: "No confident skill match — map by hand or skip",
  no_outcomes: "No course outcomes in the PDF — use Suggest after import",
  not_attempted: "Suggestions unavailable — use Suggest after import",
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((k) => b.includes(k));

/** Editable preview of the staged extraction. Nothing is saved until "Import"; that goes through the same routes as manual/CSV entry. */
export function ExtractionReview({ extraction, roleKey, areas, onDone }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<EditRow[]>(() =>
    // rows the reader wasn't sure about start unchecked: the admin opts them in
    extraction.result.rows.map((r) => ({ ...r, include: !r.needsReview, areaKeys: r.suggestedAreaKeys }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (tempId: string, change: Partial<EditRow>) => setRows((rs) => rs.map((r) => (r.tempId === tempId ? { ...r, ...change } : r)));
  const toggleArea = (r: EditRow, key: string) => patch(r.tempId, { areaKeys: r.areaKeys.includes(key) ? r.areaKeys.filter((k) => k !== key) : [...r.areaKeys, key] });

  const chosen = rows.filter((r) => r.include && r.name.trim());
  const flagged = rows.filter((r) => r.needsReview).length;
  const groups = new Map<string, EditRow[]>();
  for (const r of rows) groups.set(`${r.year}-${r.semester}`, [...(groups.get(`${r.year}-${r.semester}`) ?? []), r]);

  async function confirm() {
    setBusy(true);
    setError(null);
    let added = 0;
    let mapped = 0;
    let failed = false;
    const byGroup = new Map<string, EditRow[]>();
    for (const r of chosen) byGroup.set(`${r.year}-${r.semester}`, [...(byGroup.get(`${r.year}-${r.semester}`) ?? []), r]);
    for (const group of byGroup.values()) {
      const first = group[0];
      const res = await fetch("/api/admin/curriculum/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: extraction.branch, year: first.year, semester: first.semester, subjects: group.map((r) => ({ name: r.name.trim(), ...(r.code?.trim() ? { code: r.code.trim() } : {}) })) }),
      });
      const json = (await res.json().catch(() => null)) as { added?: number; subjects?: { name: string; id: string }[] } | null;
      if (!res.ok) {
        failed = true;
        continue;
      }
      added += json?.added ?? 0;
      const ids = new Map((json?.subjects ?? []).map((s) => [s.name, s.id]));
      for (const r of group) {
        const id = ids.get(r.name.trim());
        if (!id || r.areaKeys.length === 0) continue; // an already-existing subject keeps whatever mapping it has
        const m = await fetch(`/api/admin/curriculum/subjects/${id}/mapping`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleKey, areaKeys: r.areaKeys, fromSuggestion: sameSet(r.areaKeys, r.suggestedAreaKeys) }),
        });
        if (m.ok) mapped++;
        else failed = true;
      }
    }
    if (failed) {
      setBusy(false);
      setError(`Imported ${added} subject${added === 1 ? "" : "s"}, but some rows could not be saved. Your review is kept — check the list below and try again.`);
      router.refresh();
      return;
    }
    await fetch(`/api/admin/curriculum/extractions/${extraction.id}`, { method: "DELETE" });
    setBusy(false);
    onDone(`${added} subject${added === 1 ? "" : "s"} imported${mapped ? `, ${mapped} with confirmed skill mapping` : ""} (duplicates skipped).`);
    router.refresh();
  }

  async function discard() {
    setBusy(true);
    await fetch(`/api/admin/curriculum/extractions/${extraction.id}`, { method: "DELETE" });
    setBusy(false);
    onDone("Extraction discarded. Nothing was saved.");
    router.refresh();
  }

  return (
    <div className="mt-4">
      <p className="font-lp-body text-[12.5px] text-app-charcoal">
        {rows.length} subject{rows.length === 1 ? "" : "s"} found in <span className="font-medium">{extraction.fileName}</span> for <span className="font-medium">{extraction.branch}</span>. Review, edit or untick anything —
        nothing is saved until you import.
      </p>
      {flagged > 0 && <p className="mt-1 font-lp-body text-[12px] text-app-warning">{flagged} need your review — we weren&apos;t confident about {flagged === 1 ? "this one" : "these"}, so {flagged === 1 ? "it starts" : "they start"} unticked.</p>}
      {extraction.result.warnings.map((w) => (
        <p key={w} className="mt-1 font-lp-body text-[12px] text-app-warning">{w}</p>
      ))}

      <div className="mt-4 flex max-h-[520px] flex-col gap-5 overflow-y-auto pr-1">
        {[...groups.entries()].map(([key, items]) => (
          <div key={key}>
            <h3 className="mb-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-muted">Year {items[0].year} · Semester {items[0].semester}</h3>
            <ul className="flex flex-col gap-2">
              {items.map((r) => (
                <li key={r.tempId} className="o-card !rounded-xl p-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-2.5 accent-[var(--color-app-orange)]" checked={r.include} onChange={(e) => patch(r.tempId, { include: e.target.checked })} aria-label={`Include ${r.name}`} />
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_130px]">
                      <input className="o-input" value={r.name} onChange={(e) => patch(r.tempId, { name: e.target.value })} aria-label="Subject name" maxLength={200} />
                      <input className="o-input" value={r.code ?? ""} placeholder="Code (optional)" onChange={(e) => patch(r.tempId, { code: e.target.value || null })} aria-label="Subject code" maxLength={40} />
                    </div>
                  </div>
                  <p className="ml-7 mt-1.5 font-lp-mono text-[11px] text-app-muted">
                    {[r.category, r.kind === "elective_option" ? "elective option" : r.kind !== "course" ? r.kind : null].filter(Boolean).join(" · ")}
                    {r.needsReview && <span className="ml-2 text-app-warning">Needs review{r.reason ? ` — ${r.reason}` : ""}</span>}
                  </p>
                  <div className="ml-7 mt-2 flex flex-wrap items-center gap-2">
                    {areas.map((a) => (
                      <label key={a.key} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-app-border px-2.5 py-1 font-lp-body text-[11.5px] text-app-charcoal has-[:checked]:border-app-orange has-[:checked]:bg-app-orange-container">
                        <input type="checkbox" className="accent-[var(--color-app-orange)]" checked={r.areaKeys.includes(a.key)} onChange={() => toggleArea(r, a.key)} />
                        {a.name}
                      </label>
                    ))}
                  </div>
                  <p className="ml-7 mt-1.5 font-lp-body text-[11.5px] text-app-muted">{r.areaKeys.length === 0 ? NOTE[r.mappingNote] : "Ticked skills are saved as confirmed when you import."}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 font-lp-body text-[12px] text-app-orange" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="o-btn" disabled={busy || chosen.length === 0} onClick={confirm}>
          {busy && <Loader2 size={13} className="animate-spin" />} Import {chosen.length} subject{chosen.length === 1 ? "" : "s"}
        </button>
        <button type="button" className="o-btn-ghost" disabled={busy} onClick={discard}>Discard</button>
      </div>
    </div>
  );
}

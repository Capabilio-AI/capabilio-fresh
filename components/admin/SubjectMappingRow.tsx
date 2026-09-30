"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import type { AdminSubject } from "@/lib/roadmap/admin-data";

interface Props {
  subject: AdminSubject;
  roleKey: string;
  areas: { key: string; name: string }[];
}

/**
 * Mapping is stored only when the admin presses "Confirm mapping". "Suggest" fills the checkboxes as an
 * unsaved proposal for review; it never saves.
 */
export function SubjectMappingRow({ subject, roleKey, areas }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(subject.mappedAreaKeys);
  const [fromSuggestion, setFromSuggestion] = useState(false);
  const [busy, setBusy] = useState<"suggest" | "save" | "delete" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const dirty = [...selected].sort().join() !== [...subject.mappedAreaKeys].sort().join();
  const toggle = (key: string) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  async function suggest() {
    setBusy("suggest");
    setNote(null);
    const res = await fetch("/api/admin/curriculum/suggest-mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectName: subject.name, roleKey }),
    });
    setBusy(null);
    const body = (await res.json().catch(() => null)) as { suggestedAreaKeys?: string[]; error?: string } | null;
    if (!res.ok || !body?.suggestedAreaKeys) return setNote(body?.error ?? "Could not get a suggestion.");
    setSelected(body.suggestedAreaKeys);
    setFromSuggestion(true);
    setNote(body.suggestedAreaKeys.length ? "Suggestion loaded — review it, then confirm." : "No clear match suggested. Choose by hand if one applies.");
  }

  async function save() {
    setBusy("save");
    const res = await fetch(`/api/admin/curriculum/subjects/${subject.id}/mapping`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleKey, areaKeys: selected, fromSuggestion }),
    });
    setBusy(null);
    if (!res.ok) return setNote("Could not save — try again.");
    setNote(null);
    setFromSuggestion(false);
    router.refresh();
  }

  async function remove() {
    setBusy("delete");
    const res = await fetch(`/api/admin/curriculum/subjects/${subject.id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) router.refresh();
    else setNote("Could not delete — try again.");
  }

  return (
    <li className="o-card !rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">
            {subject.name} {subject.code && <span className="font-lp-mono text-[11px] text-app-muted">{subject.code}</span>}
          </p>
          <p className="font-lp-mono text-[11px] text-app-muted">
            {subject.mappedAreaKeys.length === 0 ? "Not mapped yet" : `Mapped to ${subject.mappedAreaKeys.length} skill area${subject.mappedAreaKeys.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button type="button" onClick={remove} disabled={busy !== null} aria-label={`Delete ${subject.name}`} className="text-app-muted hover:text-app-charcoal disabled:opacity-50">
          {busy === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {areas.map((a) => (
          <label key={a.key} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-app-border px-2.5 py-1 font-lp-body text-[12px] text-app-charcoal has-[:checked]:border-app-orange has-[:checked]:bg-app-orange-container">
            <input type="checkbox" className="accent-[var(--color-app-orange)]" checked={selected.includes(a.key)} onChange={() => toggle(a.key)} />
            {a.name}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={suggest} disabled={busy !== null} className="o-btn-ghost !px-3 !py-1.5 !text-[12px]">
          {busy === "suggest" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Suggest
        </button>
        <button type="button" onClick={save} disabled={busy !== null || !dirty} className="o-btn !px-3 !py-1.5 !text-[12px]">
          {busy === "save" ? <Loader2 size={12} className="animate-spin" /> : "Confirm mapping"}
        </button>
        {note && <span className="font-lp-body text-[12px] text-app-muted" role="status">{note}</span>}
      </div>
    </li>
  );
}

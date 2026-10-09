"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Clock, ExternalLink, Plus, X } from "lucide-react";
import type { ProofRow } from "@/lib/assess/proof";
import { PROOF_TYPES } from "@/lib/assess/proof";
import { Button } from "../ui/Button";

const TYPE_LABEL: Record<(typeof PROOF_TYPES)[number], string> = { PROJECT: "Project", CERTIFICATION: "Certification", GITHUB: "GitHub", PORTFOLIO: "Portfolio", ARENA: "Arena result", OTHER: "Other" };
const STATUS: Record<ProofRow["verification_status"], { label: string; cls: string }> = {
  VERIFIED: { label: "Verified", cls: "bg-[var(--ok-soft)] text-[var(--ok-ink)]" },
  UNVERIFIED: { label: "Awaiting review", cls: "bg-[var(--m-ink)]/8 text-[var(--m-muted)]" },
  REJECTED: { label: "Not accepted", cls: "bg-[var(--bad-soft)] text-[var(--bad-ink)]" },
};

/** Add and list proof of work. Verified proof updates the skill graph; unverified proof is shown but carries no weight. */
export function ProofOfWorkPanel({ skills }: { skills: { id: string; name: string }[] }) {
  const [items, setItems] = useState<ProofRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "PROJECT" as (typeof PROOF_TYPES)[number], title: "", url: "", skillIds: [] as string[] });

  useEffect(() => {
    fetch("/api/proof-of-work", { cache: "no-store" }).then((r) => r.json()).then((d: { items: ProofRow[] }) => setItems(d.items)).catch(() => setItems([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/proof-of-work", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, url: form.url || undefined }) });
    const body = (await res.json().catch(() => ({}))) as { item?: ProofRow; error?: string };
    setBusy(false);
    if (!res.ok || !body.item) return setError(body.error ?? "Couldn't save that. Check the link and try again.");
    setItems((cur) => [body.item!, ...(cur ?? [])]);
    setForm({ type: "PROJECT", title: "", url: "", skillIds: [] });
    setOpen(false);
  };
  const toggle = (id: string) => setForm((f) => ({ ...f, skillIds: f.skillIds.includes(id) ? f.skillIds.filter((x) => x !== id) : [...f.skillIds, id].slice(0, 8) }));

  return (
    <section className="glass rounded-3xl p-6" aria-labelledby="pow-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="pow-title" className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Proof of work</h2>
          <p className="mt-0.5 text-[13.5px] text-[var(--m-muted)]">Projects, certificates and links. Once verified they update your skill graph.</p>
        </div>
        <Button variant="primary" onClick={() => setOpen((o) => !o)} icon={open ? <X className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}>{open ? "Close" : "Add proof of work"}</Button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-5 grid gap-4 rounded-2xl bg-white/60 p-4 sm:grid-cols-2">
          <label className="text-[13px] font-bold text-[var(--m-ink)]">Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="mt-1 w-full rounded-xl border border-[var(--m-rule)] bg-white px-3 py-2.5 text-[14.5px] font-normal">
              {PROOF_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="text-[13px] font-bold text-[var(--m-ink)]">Title
            <input required minLength={2} maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--m-rule)] bg-white px-3 py-2.5 text-[14.5px] font-normal" placeholder="Sales dashboard in Power BI" />
          </label>
          <label className="text-[13px] font-bold text-[var(--m-ink)] sm:col-span-2">Link {form.type === "CERTIFICATION" || form.type === "OTHER" ? "(optional)" : ""}
            <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--m-rule)] bg-white px-3 py-2.5 text-[14.5px] font-normal" placeholder="https://github.com/you/project" />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-[13px] font-bold text-[var(--m-ink)]">Skills this shows (up to 8)</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((s) => (
                <label key={s.id} className={`cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors ${form.skillIds.includes(s.id) ? "bg-[var(--m-ink)] text-white" : "bg-white text-[var(--m-ink)] ring-1 ring-[var(--m-rule)] hover:ring-[var(--m-ink)]"}`}>
                  <input type="checkbox" className="sr-only" checked={form.skillIds.includes(s.id)} onChange={() => toggle(s.id)} />{s.name}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-[13.5px] font-bold text-[var(--bad-ink)] sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2"><Button type="submit" variant="accent" loading={busy}>Save proof of work</Button></div>
        </form>
      )}

      <ul className="mt-5 divide-y divide-[var(--m-rule)]">
        {items === null && <li className="py-3"><span className="a-skeleton block h-4 w-1/2" /></li>}
        {items?.length === 0 && <li className="py-3 text-[14px] text-[var(--m-muted)]">Nothing added yet. Add a project or certificate to start building evidence.</li>}
        {items?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-bold text-[var(--m-ink)]">{p.title}</p>
              <p className="text-[12.5px] text-[var(--m-muted)]">{TYPE_LABEL[p.type]}{p.skill_ids.length > 0 && ` · ${p.skill_ids.length} skill${p.skill_ids.length > 1 ? "s" : ""}`}</p>
            </div>
            <div className="flex items-center gap-3">
              {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[var(--m-muted)] hover:text-[var(--m-ink)]" aria-label={`Open ${p.title}`}><ExternalLink className="h-4 w-4" aria-hidden /></a>}
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${STATUS[p.verification_status].cls}`}>{p.verification_status === "VERIFIED" ? <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> : <Clock className="h-3.5 w-3.5" aria-hidden />}{STATUS[p.verification_status].label}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

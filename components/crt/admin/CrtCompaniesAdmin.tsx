"use client";

import { useState } from "react";
import type { CompanyView } from "@/lib/crt/company-server";

const TEMPLATE = {
  slug: "company-name", name: "Company name", sector: "Technology", about: "One or two lines about the company and who it hires.",
  process: ["Online assessment", "Technical interview", "HR interview"],
  officialUrl: "https://www.example.com/careers", patternSourceUrl: null, patternCheckedOn: null,
  rounds: [
    { position: 1, kind: "online_assessment", title: "Online assessment", minutes: 60, negativeMarking: 0, sections: [{ category: "aptitude", count: 20 }, { category: "reasoning", count: 15 }, { category: "verbal", count: 15 }], notes: null },
    { position: 2, kind: "technical_interview", title: "Technical interview", minutes: 30, negativeMarking: 0, sections: [], notes: "What this round usually covers." },
  ],
};

const toInput = (c: CompanyView) => ({ slug: c.slug, name: c.name, sector: c.sector, about: c.about, process: c.process, officialUrl: c.officialUrl, patternSourceUrl: c.patternSourceUrl, patternCheckedOn: c.patternCheckedOn, rounds: c.rounds.map((r) => ({ position: r.position, kind: r.kind, title: r.title, minutes: r.minutes, negativeMarking: r.negativeMarking, sections: r.sections, notes: r.notes })) });
const FIELD = "w-full rounded-lg border border-app-border bg-white p-3 font-lp-mono text-[12.5px] text-app-charcoal";

/** Admin: add or edit a company as JSON (checked on save), then publish it once its pattern's source and check date are filled in. */
export function CrtCompaniesAdmin({ initial }: { initial: CompanyView[] }) {
  const [companies, setCompanies] = useState(initial);
  const [text, setText] = useState(JSON.stringify(TEMPLATE, null, 2));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const res = await fetch("/api/crt-admin/companies");
    if (res.ok) setCompanies(((await res.json()) as { companies: CompanyView[] }).companies);
  }
  async function call(method: "PUT" | "PATCH", body: unknown, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/crt-admin/companies", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(res.ok ? { ok: true, text: done } : { ok: false, text: out.error ?? "That did not work." });
      if (res.ok) await reload();
    } finally {
      setBusy(false);
    }
  }
  const save = () => {
    try { void call("PUT", JSON.parse(text), "Saved as a draft."); } catch { setMessage({ ok: false, text: "That is not valid JSON." }); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section aria-label="Companies" className="rounded-2xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[18px] font-bold text-app-charcoal">Companies ({companies.length})</h2>
        {companies.length === 0 && <p className="mt-2 font-lp-body text-[13.5px] text-app-muted">None yet. Add one on the right.</p>}
        <ul className="mt-3 flex flex-col divide-y divide-app-border">
          {companies.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-lp-body text-[14.5px] font-bold text-app-charcoal">{c.name} <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] ${c.status === "PUBLISHED" ? "bg-[#e6f4ec] text-[#17784a]" : "bg-amber-50 text-amber-800"}`}>{c.status === "PUBLISHED" ? "Published" : "Draft"}</span></p>
                <p className="font-lp-body text-[12.5px] text-app-muted">{c.rounds.length} rounds · {c.patternSourceUrl ? `source checked ${c.patternCheckedOn ?? "?"}` : "no source yet"}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setText(JSON.stringify(toInput(c), null, 2))} className="rounded-lg border border-app-border px-3 py-1.5 font-lp-body text-[12.5px] font-semibold">Edit</button>
                <button type="button" disabled={busy} onClick={() => void call("PATCH", { slug: c.slug, status: c.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }, c.status === "PUBLISHED" ? "Unpublished." : "Published.")} className="rounded-lg bg-[var(--m-ink)] px-3 py-1.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-60">{c.status === "PUBLISHED" ? "Unpublish" : "Publish"}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Company editor" className="rounded-2xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[18px] font-bold text-app-charcoal">Add or edit a company</h2>
        <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">Categories for sections: aptitude, reasoning, verbal, workplace, soft_skills, group_discussion, interview. Round kinds: online_assessment, coding, technical_interview, hr_interview, group_discussion. Saving always makes a draft until it is published.</p>
        <label htmlFor="company-json" className="sr-only">Company as JSON</label>
        <textarea id="company-json" value={text} onChange={(e) => setText(e.target.value)} rows={26} spellCheck={false} className={`${FIELD} mt-3`} />
        {message && <p role={message.ok ? "status" : "alert"} className={`mt-3 font-lp-body text-[13px] font-semibold ${message.ok ? "text-[#17784a]" : "text-red-700"}`}>{message.text}</p>}
        <button type="button" onClick={save} disabled={busy} className="mt-3 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white disabled:opacity-60">Save draft</button>
      </section>
    </div>
  );
}

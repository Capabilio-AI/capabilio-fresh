"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { CourseDetail } from "@/lib/curriculum/admin-data";
import { BLOOM, KINDS } from "@/lib/curriculum/schemas";
import { api } from "./api";

type Outcome = { code: string; text: string; bloom: string };
type Unit = { title: string; hours: string; topics: string };
const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const num = (s: string): number | null => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));
const FIELD = "o-input";
const Label = ({ id, children }: { id: string; children: string }) => <label htmlFor={id} className="mb-1 block font-lp-mono text-[11px] text-app-muted">{children}</label>;

/** Edits one course and everything under it; "Save" sends the whole tree in one transaction (outcomes and units keep their mappings by code / number). */
export function CourseEditor({ detail }: { detail: CourseDetail }) {
  const router = useRouter();
  const c = detail.course;
  const locked = !detail.editable;
  const [f, setF] = useState({
    title: c.title, year: String(c.year), semester: c.semester == null ? "" : String(c.semester), code: c.course_code ?? "", category: c.category ?? "", kind: c.kind,
    l: c.lecture_hours == null ? "" : String(c.lecture_hours), t: c.tutorial_hours == null ? "" : String(c.tutorial_hours), p: c.practical_hours == null ? "" : String(c.practical_hours), credits: c.credits == null ? "" : String(c.credits),
    prerequisites: c.prerequisites ?? "", objectives: (c.objectives ?? []).join("\n"), experiments: detail.experiments.join("\n"),
    textbooks: (c.textbooks ?? []).join("\n"), referenceBooks: (c.reference_books ?? []).join("\n"), onlineResources: (c.online_resources ?? []).join("\n"),
  });
  const [outcomes, setOutcomes] = useState<Outcome[]>(detail.outcomes.map((o) => ({ code: o.code, text: o.text, bloom: o.bloom_level ?? "" })));
  const [units, setUnits] = useState<Unit[]>(detail.units.map((u) => ({ title: u.title, hours: u.hours == null ? "" : String(u.hours), topics: u.topics.join("\n") })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    setMsg(null);
    const used = new Set(outcomes.map((o) => o.code.trim()).filter(Boolean));
    let next = 1;
    const coded = outcomes.filter((o) => o.text.trim()).map((o) => {
      let code = o.code.trim();
      while (!code) { const candidate = `CO${next++}`; if (!used.has(candidate)) { code = candidate; used.add(code); } }
      return { code, text: o.text.trim(), bloomLevel: (o.bloom || null) as (typeof BLOOM)[number] | null };
    });
    const r = await api("PUT", `/api/admin/curriculum/courses/${c.id}`, {
      title: f.title.trim(), year: Number(f.year), semester: f.semester ? Number(f.semester) : null, courseCode: f.code.trim() || null, category: f.category.trim() || null, kind: f.kind,
      lectureHours: num(f.l), tutorialHours: num(f.t), practicalHours: num(f.p), credits: num(f.credits), prerequisites: f.prerequisites.trim() || null,
      objectives: lines(f.objectives), outcomes: coded, experiments: lines(f.experiments), textbooks: lines(f.textbooks), referenceBooks: lines(f.referenceBooks), onlineResources: lines(f.onlineResources),
      units: units.filter((u) => u.title.trim()).map((u, i) => ({ unitNo: i + 1, title: u.title.trim(), hours: num(u.hours), topics: lines(u.topics) })),
    });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  const card = "o-card p-5";
  const h = "font-lp-display text-[15px] font-semibold text-app-charcoal";
  return (
    <fieldset disabled={locked || busy} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
      {locked && <p className="rounded-lg border border-app-border px-4 py-3 font-lp-body text-[12.5px] text-app-muted" role="note">This curriculum is published, so it can&apos;t be edited. Create a new version to make changes.</p>}

      <section className={card} aria-labelledby="ce-info">
        <h2 id="ce-info" className={h}>Academic information</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-4"><Label id="ce-title">Title</Label><input id="ce-title" className={FIELD} value={f.title} onChange={set("title")} maxLength={200} /></div>
          <div className="sm:col-span-2"><Label id="ce-code">Course code</Label><input id="ce-code" className={FIELD} value={f.code} onChange={set("code")} maxLength={40} placeholder="Not stated" /></div>
          <div><Label id="ce-year">Year</Label><select id="ce-year" className={FIELD} value={f.year} onChange={set("year")}>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></div>
          <div><Label id="ce-sem">Semester</Label><select id="ce-sem" className={FIELD} value={f.semester} onChange={set("semester")}><option value="">Not stated</option><option value="1">1</option><option value="2">2</option></select></div>
          <div className="sm:col-span-2"><Label id="ce-cat">Category</Label><input id="ce-cat" className={FIELD} value={f.category} onChange={set("category")} maxLength={120} placeholder="e.g. Professional Core" /></div>
          <div><Label id="ce-kind">Type</Label><select id="ce-kind" className={FIELD} value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}</select></div>
          {([["l", "L"], ["t", "T"], ["p", "P"], ["credits", "Credits"]] as const).map(([k, label]) => (
            <div key={k}><Label id={`ce-${k}`}>{label}</Label><input id={`ce-${k}`} className={FIELD} inputMode="decimal" value={f[k]} onChange={set(k)} placeholder="—" /></div>
          ))}
          <div className="sm:col-span-6"><Label id="ce-pre">Prerequisites</Label><input id="ce-pre" className={FIELD} value={f.prerequisites} onChange={set("prerequisites")} maxLength={500} placeholder="Not stated" /></div>
        </div>
      </section>

      <section className={card} aria-labelledby="ce-obj">
        <h2 id="ce-obj" className={h}>Course objectives</h2>
        <Label id="ce-objectives">One per line</Label>
        <textarea id="ce-objectives" className={`${FIELD} h-28`} value={f.objectives} onChange={set("objectives")} />
      </section>

      <section className={card} aria-labelledby="ce-co">
        <h2 id="ce-co" className={h}>Learning outcomes</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {outcomes.map((o, i) => (
            <li key={i} className="grid grid-cols-[70px_1fr_130px_auto] items-start gap-2">
              <input aria-label={`Outcome ${i + 1} code`} className={FIELD} value={o.code} onChange={(e) => setOutcomes((s) => s.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} placeholder={`CO${i + 1}`} maxLength={20} />
              <textarea aria-label={`Outcome ${i + 1} text`} className={`${FIELD} h-16`} value={o.text} onChange={(e) => setOutcomes((s) => s.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <select aria-label={`Outcome ${i + 1} Bloom level`} className={FIELD} value={o.bloom} onChange={(e) => setOutcomes((s) => s.map((x, j) => (j === i ? { ...x, bloom: e.target.value } : x)))}><option value="">Level not stated</option>{BLOOM.map((b) => <option key={b}>{b}</option>)}</select>
              <button type="button" className="mt-2 text-app-muted hover:text-app-charcoal" aria-label={`Remove outcome ${i + 1}`} onClick={() => setOutcomes((s) => s.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="o-btn-ghost mt-3 !py-1.5" onClick={() => setOutcomes((s) => [...s, { code: "", text: "", bloom: "" }])}><Plus size={13} aria-hidden="true" /> Add outcome</button>
      </section>

      <section className={card} aria-labelledby="ce-units">
        <h2 id="ce-units" className={h}>Units and topics</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {units.map((u, i) => (
            <li key={i} className="rounded-xl border border-app-border p-3">
              <div className="grid grid-cols-[1fr_90px_auto] items-center gap-2">
                <input aria-label={`Unit ${i + 1} title`} className={FIELD} value={u.title} onChange={(e) => setUnits((s) => s.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder={`Unit ${i + 1} title`} maxLength={160} />
                <input aria-label={`Unit ${i + 1} hours`} className={FIELD} inputMode="decimal" value={u.hours} onChange={(e) => setUnits((s) => s.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))} placeholder="Hours" />
                <button type="button" className="text-app-muted hover:text-app-charcoal" aria-label={`Remove unit ${i + 1}`} onClick={() => setUnits((s) => s.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden="true" /></button>
              </div>
              <textarea aria-label={`Unit ${i + 1} topics, one per line`} className={`${FIELD} mt-2 h-24`} value={u.topics} onChange={(e) => setUnits((s) => s.map((x, j) => (j === i ? { ...x, topics: e.target.value } : x)))} placeholder="One topic per line" />
            </li>
          ))}
        </ul>
        <button type="button" className="o-btn-ghost mt-3 !py-1.5" onClick={() => setUnits((s) => [...s, { title: "", hours: "", topics: "" }])}><Plus size={13} aria-hidden="true" /> Add unit</button>
      </section>

      <section className={card} aria-labelledby="ce-lab">
        <h2 id="ce-lab" className={h}>Lab experiments, books and resources</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([["experiments", "Lab experiments"], ["textbooks", "Text books"], ["referenceBooks", "Reference books"], ["onlineResources", "Online resources"]] as const).map(([k, label]) => (
            <div key={k}><Label id={`ce-${k}`}>{`${label} — one per line`}</Label><textarea id={`ce-${k}`} className={`${FIELD} h-28`} value={f[k]} onChange={set(k)} /></div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className="o-btn" onClick={save} disabled={locked || busy || !f.title.trim()}>{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Save changes</button>
        {msg && <p className={`font-lp-body text-[12.5px] ${msg.ok ? "text-app-success" : "text-app-rose"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      </div>
    </fieldset>
  );
}

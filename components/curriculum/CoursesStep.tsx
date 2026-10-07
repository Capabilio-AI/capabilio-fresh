"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitMerge, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { parseCurriculumCsv, CSV_TEMPLATE } from "@/lib/roadmap/csv";
import type { CourseRow } from "@/lib/curriculum/admin-data";
import { COURSE_GROUPS, GROUP_LABEL, composition, courseGroup, type CourseGroup } from "@/lib/curriculum/composition";
import { Panel, Pill } from "@/components/org/ui";
import { api } from "./api";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  importId: string;
  courses: CourseRow[];
  removed: CourseRow[];
  editable: boolean;
}

/** Add, remove (soft — restorable until published), merge and open courses. */
export function CoursesStep({ importId, courses, removed, editable }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState("");
  const [year, setYear] = useState("1");
  const [semester, setSemester] = useState("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<CourseRow | null>(null);
  const [merging, setMerging] = useState<CourseRow | null>(null);
  const [mergeInto, setMergeInto] = useState("");
  const [filter, setFilter] = useState<CourseGroup | "all">("all");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  async function add(rows: { year: number; semester: number | null; title: string; code?: string | null }[]) {
    if (rows.length === 0) return setMsg({ ok: false, text: "Enter at least one course." });
    setBusy("add");
    const r = await api<{ added: number; skipped: number }>("POST", `/api/admin/curriculum/imports/${importId}/courses`, { courses: rows });
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: `${r.data.added} course${r.data.added === 1 ? "" : "s"} added${r.data.skipped ? `, ${r.data.skipped} already existed` : ""}.` });
    setLines("");
    setCsv("");
    router.refresh();
  }
  const addLines = () => add(lines.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [title, code] = l.split(",").map((s) => s.trim()); return { year: Number(year), semester: semester ? Number(semester) : null, title, code: code || null }; }));
  function addCsv() {
    const parsed = parseCurriculumCsv(csv);
    if (!parsed.ok) return setMsg({ ok: false, text: parsed.errors.slice(0, 3).join(" ") });
    void add(parsed.rows.map((x) => ({ year: x.year, semester: x.semester, title: x.name, code: x.code })));
  }
  async function act(key: string, run: () => ReturnType<typeof api>, done: string) {
    setBusy(key);
    const r = await run();
    setBusy(null);
    setRemoving(null);
    setMerging(null);
    setMsg(r.ok ? { ok: true, text: done } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  }

  const counts = composition(courses);
  const shown = filter === "all" ? courses : courses.filter((c) => courseGroup(c) === filter);
  const shownSelected = shown.filter((c) => selected.has(c.id));
  const toggle = (id: string) => setSelected((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleShown = () => setSelected((cur) => { const next = new Set(cur); const all = shown.every((c) => next.has(c.id)); for (const c of shown) { if (all) next.delete(c.id); else next.add(c.id); } return next; });
  async function removeSelected() {
    const ids = shownSelected.map((c) => c.id);
    setBulkOpen(false);
    setBusy("bulk");
    const r = await api<{ removed: number }>("POST", `/api/admin/curriculum/imports/${importId}/courses/remove`, { courseIds: ids });
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setSelected(new Set());
    setMsg({ ok: true, text: `${r.data.removed} course${r.data.removed === 1 ? "" : "s"} removed. You can restore them below until you publish.` });
    router.refresh();
  }

  const groups = new Map<string, CourseRow[]>();
  for (const c of shown) groups.set(`Year ${c.year}${c.semester ? ` · Semester ${c.semester}` : ""}`, [...(groups.get(`Year ${c.year}${c.semester ? ` · Semester ${c.semester}` : ""}`) ?? []), c]);

  return (
    <div className="flex flex-col gap-4">
      {msg && <p className={`font-lp-body text-[12.5px] ${msg.ok ? "text-app-success" : "text-app-rose"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}

      {courses.length > 0 && (
        <div className="flex flex-col gap-3" aria-label="Filter courses">
          <p className="font-lp-body text-[12.5px] text-app-muted">A syllabus lists every elective option, lab and audit course, but a student takes only some of them. Filter by type, then remove the entries your college does not run so students see what applies to them.</p>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", ...COURSE_GROUPS] as const).map((g) => {
              const n = g === "all" ? courses.length : counts[g];
              if (g !== "all" && n === 0) return null;
              return <button key={g} type="button" aria-pressed={filter === g} onClick={() => setFilter(g)} className={filter === g ? "o-btn !px-3 !py-1.5 !text-[12px]" : "o-btn-ghost !px-3 !py-1.5 !text-[12px]"}>{g === "all" ? "All" : GROUP_LABEL[g]} · {n}</button>;
            })}
          </div>
          {editable && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 font-lp-body text-[12.5px] text-app-muted"><input type="checkbox" checked={shown.length > 0 && shown.every((c) => selected.has(c.id))} onChange={toggleShown} /> Select all shown ({shown.length})</label>
              <button type="button" className="o-btn-ghost !px-3 !py-1.5 !text-[12px]" disabled={shownSelected.length === 0 || busy !== null} onClick={() => setBulkOpen(true)}><Trash2 size={12} aria-hidden="true" /> Remove selected ({shownSelected.length})</button>
            </div>
          )}
        </div>
      )}

      {courses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-app-border px-4 py-6 text-center font-lp-body text-[13px] text-app-muted">No courses yet. Add them below.</p>
      ) : (
        [...groups.entries()].map(([label, items]) => (
          <section key={label} aria-label={label}>
            <h3 className="o-eyebrow mb-2">{label}</h3>
            <ul className="flex flex-col gap-2">
              {items.map((c) => (
                <li key={c.id} className="o-card !rounded-xl flex flex-wrap items-center gap-3 p-3.5">
                  {editable && <input type="checkbox" aria-label={`Select ${c.title}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/org/curriculum/${importId}/courses/${c.id}`} className="font-lp-body text-[13.5px] font-medium text-app-charcoal hover:underline">{c.title}</Link>
                    <p className="font-lp-mono text-[11px] text-app-muted">{[c.code, c.category, c.kind !== "course" ? c.kind.replace("_", " ") : null, c.credits != null ? `${c.credits} credits` : null].filter(Boolean).join(" · ") || "No code or category stated"}</p>
                  </div>
                  <Pill tone={c.outcomes ? "neutral" : "warn"}>{c.outcomes ? `${c.outcomes} outcomes` : "No outcomes"}</Pill>
                  {c.units > 0 && <Pill>{c.units} units</Pill>}
                  {c.experiments > 0 && <Pill>{c.experiments} experiments</Pill>}
                  {editable && (
                    <div className="flex items-center gap-2">
                      <button type="button" className="o-btn-ghost !px-3 !py-1.5 !text-[12px]" onClick={() => { setMerging(c); setMergeInto(""); }}><GitMerge size={12} aria-hidden="true" /> Merge</button>
                      <button type="button" aria-label={`Remove ${c.title}`} className="text-app-muted hover:text-app-charcoal" onClick={() => setRemoving(c)}><Trash2 size={14} aria-hidden="true" /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {editable && (
        <>
          <Panel title="Add courses">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[120px_160px]">
              <div><label htmlFor="co-year" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Year</label><select id="co-year" className="o-input" value={year} onChange={(e) => setYear(e.target.value)}>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></div>
              <div><label htmlFor="co-sem" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Semester</label><select id="co-sem" className="o-input" value={semester} onChange={(e) => setSemester(e.target.value)}><option value="">Not stated</option><option value="1">1</option><option value="2">2</option></select></div>
            </div>
            <label htmlFor="co-lines" className="mb-1 mt-3 block font-lp-mono text-[11px] text-app-muted">One course per line — optional code after a comma</label>
            <textarea id="co-lines" className="o-input h-24" value={lines} onChange={(e) => setLines(e.target.value)} placeholder={"Database Management Systems, CS301\nProbability and Statistics"} />
            <button type="button" className="o-btn mt-3" disabled={busy !== null || !lines.trim()} onClick={addLines}>{busy === "add" && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Add courses</button>
          </Panel>
          <details className="o-card p-5">
            <summary className="cursor-pointer font-lp-body text-[13px] font-extrabold text-app-charcoal">Import from a CSV</summary>
            <p className="mt-2 font-lp-body text-[12px] text-app-muted">Header: <code className="font-lp-mono">{CSV_TEMPLATE.split("\n")[0]}</code>. The branch column is ignored here — courses go into this curriculum.</p>
            <textarea aria-label="CSV" className="o-input mt-2 h-24 font-lp-mono text-[12px]" value={csv} onChange={(e) => setCsv(e.target.value)} />
            <button type="button" className="o-btn mt-3" disabled={busy !== null || !csv.trim()} onClick={addCsv}>Import CSV</button>
          </details>
        </>
      )}

      {removed.length > 0 && (
        <Panel title={`Removed (${removed.length})`}>
          <ul className="flex flex-col gap-1.5">
            {removed.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 font-lp-body text-[13px] text-app-muted">
                <span>{c.title} <span className="font-lp-mono text-[11px]">Year {c.year}</span></span>
                {editable && <button type="button" className="o-btn-ghost !px-3 !py-1.5 !text-[12px]" disabled={busy !== null} onClick={() => act(`re-${c.id}`, () => api("POST", `/api/admin/curriculum/courses/${c.id}/restore`), `${c.title} restored.`)}><RotateCcw size={12} aria-hidden="true" /> Restore</button>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <ConfirmDialog open={removing !== null} title={`Remove “${removing?.title ?? ""}”?`} confirmLabel="Remove course" danger busy={busy === "rm"} onCancel={() => setRemoving(null)} onConfirm={() => removing && act("rm", () => api("DELETE", `/api/admin/curriculum/courses/${removing.id}`), `${removing.title} removed. You can restore it below until you publish.`)}>
        It moves to “Removed” and no longer counts. You can restore it until this curriculum is published.
      </ConfirmDialog>
      <ConfirmDialog open={bulkOpen} title={`Remove ${shownSelected.length} course${shownSelected.length === 1 ? "" : "s"}?`} confirmLabel="Remove courses" danger busy={busy === "bulk"} onCancel={() => setBulkOpen(false)} onConfirm={removeSelected}>
        They move to “Removed” and no longer count towards what students see. You can restore any of them until this curriculum is published.
      </ConfirmDialog>
      <ConfirmDialog open={merging !== null} title={`Merge “${merging?.title ?? ""}” into another course`} confirmLabel="Merge" confirmDisabled={!mergeInto} busy={busy === "mg"} onCancel={() => setMerging(null)} onConfirm={() => merging && mergeInto && act("mg", () => api("POST", `/api/admin/curriculum/courses/${merging.id}/merge`, { intoCourseId: mergeInto }), `${merging.title} merged.`)}>
        <p>Its outcomes, units, experiments and books are added to the course you choose, and this one is removed. Skill mappings are not carried over — suggest and confirm them again on the merged course.</p>
        <label htmlFor="merge-into" className="mb-1 mt-3 block font-lp-mono text-[11px]">Merge into</label>
        <select id="merge-into" className="o-input" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
          <option value="">Choose a course…</option>
          {courses.filter((c) => c.id !== merging?.id).map((c) => <option key={c.id} value={c.id}>{c.title} (Year {c.year})</option>)}
        </select>
      </ConfirmDialog>
    </div>
  );
}

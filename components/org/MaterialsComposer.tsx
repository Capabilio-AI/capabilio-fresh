"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileSpreadsheet, FileImage, Link2, Loader2, Presentation, StickyNote, UploadCloud, X, type LucideIcon } from "lucide-react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/uploads/limits";
import type { CollegeBranch } from "@/lib/org/college-branches";

type Tab = "files" | "link" | "note";
interface Picked { id: string; file: File; title: string }
interface Audience { branch: string; year: number }

const MAX_FILES = 10;
const MAX_JOBS = 24;
const YEARS = [1, 2, 3, 4];
const ACCEPT = ".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "files", label: "Files", icon: UploadCloud },
  { id: "link", label: "A link", icon: Link2 },
  { id: "note", label: "A note", icon: StickyNote },
];
const CHIP = "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors";
const chipTone = (on: boolean) => (on ? "border-[var(--m-ink)]! bg-[var(--m-accent-soft)] text-app-charcoal" : "border-app-border! text-app-muted hover:bg-[var(--m-accent-soft)]");

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const stem = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
const iconFor = (name: string): LucideIcon => (/\.(png|jpe?g|webp)$/i.test(name) ? FileImage : /\.xlsx$/i.test(name) ? FileSpreadsheet : /\.pptx$/i.test(name) ? Presentation : FileText);

async function post(url: string, body: BodyInit, json: boolean): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "POST", ...(json ? { headers: { "Content-Type": "application/json" } } : {}), body });
    if (res.ok) return null;
    return ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.";
  } catch {
    return "Network problem. Please try again.";
  }
}

/**
 * One place to share with students: files (several at once), a link, or a note. The audience is picked from the college's real branches and
 * years, so what is published always matches how students' branches are stored.
 */
export function MaterialsComposer({ branches, subjects, canPickAll }: { branches: CollegeBranch[]; subjects: { value: string; label: string }[]; canPickAll: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("files");
  const [files, setFiles] = useState<Picked[]>([]);
  const [link, setLink] = useState({ url: "", title: "" });
  const [note, setNote] = useState({ title: "", body: "" });
  const [description, setDescription] = useState("");
  const [selBranches, setSelBranches] = useState<string[]>(branches.length === 1 ? [branches[0].branch] : []);
  const [selYears, setSelYears] = useState<number[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const audiences: Audience[] = selBranches.flatMap((branch) => selYears.map((year) => ({ branch, year })));
  const audienceReady = subjectId ? true : audiences.length > 0;
  const contentReady = tab === "files" ? files.length > 0 && files.every((f) => f.title.trim()) : tab === "link" ? /^https?:\/\/\S+$/.test(link.url.trim()) && link.title.trim().length > 0 : note.title.trim().length > 0 && note.body.trim().length > 0;
  const tooMany = !subjectId && audiences.length * (tab === "files" ? 1 : 1) > MAX_JOBS;
  const ready = contentReady && audienceReady && !tooMany && !progress;

  function addFiles(list: FileList | File[]) {
    setMessage(null);
    const next = [...files];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) { rejected.push(`${file.name}: up to ${MAX_FILES} files at a time`); continue; }
      if (file.size > MAX_UPLOAD_BYTES) { rejected.push(`${file.name}: over ${MAX_UPLOAD_MB} MB`); continue; }
      if (!new RegExp(`(${ACCEPT.replace(/\./g, "\\.").replace(/,/g, "|")})$`, "i").test(file.name)) { rejected.push(`${file.name}: not a supported type`); continue; }
      next.push({ id: `${file.name}:${file.size}:${file.lastModified}`, file, title: stem(file.name) });
    }
    setFiles(next);
    if (rejected.length) setMessage({ ok: false, text: `Skipped ${rejected.join("; ")}.` });
    if (input.current) input.current.value = "";
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function publish() {
    setMessage(null);
    const jobs = tab === "files" ? files.length : subjectId ? 1 : audiences.length;
    setProgress({ done: 0, total: jobs });
    let failure: string | null = null;
    if (tab === "files") {
      for (const [i, f] of files.entries()) {
        const form = new FormData();
        form.set("file", f.file);
        form.set("title", f.title.trim());
        if (description.trim()) form.set("description", description.trim());
        if (subjectId) form.set("subjectId", subjectId);
        else form.set("audiences", JSON.stringify(audiences));
        failure = await post("/api/org/materials/upload", form, false);
        if (failure) { failure = `${f.file.name}: ${failure}`; break; }
        setProgress({ done: i + 1, total: jobs });
      }
    } else {
      const targets: ({ subjectId: string } | Audience)[] = subjectId ? [{ subjectId }] : audiences;
      for (const [i, t] of targets.entries()) {
        const base = tab === "link"
          ? { type: /\.pdf(\?|#|$)/i.test(link.url) ? "pdf" : "link", title: link.title.trim(), url: link.url.trim() }
          : { type: "notes", title: note.title.trim(), body: note.body.trim() };
        failure = await post("/api/org/materials", JSON.stringify({ ...base, ...(description.trim() ? { description: description.trim() } : {}), ...t }), true);
        if (failure) break;
        setProgress({ done: i + 1, total: jobs });
      }
    }
    setProgress(null);
    if (failure) return setMessage({ ok: false, text: failure });
    setFiles([]); setLink({ url: "", title: "" }); setNote({ title: "", body: "" }); setDescription("");
    setMessage({ ok: true, text: "Published. Students were notified and will see it in SkillStudio." });
    router.refresh();
  }

  const summary = subjectId ? "the subject's own branch and year" : audiences.length ? `${selBranches.length} branch${selBranches.length === 1 ? "" : "es"} × Year ${[...selYears].sort().join(", ")}` : null;

  return (
    <section aria-label="Share with students" className="o-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-border! px-5 py-4">
        <div>
          <h2 className="font-lp-display text-[18px] font-bold text-app-charcoal">Share with students</h2>
          <p className="text-[12.5px] text-app-muted">Choose what to share, then who should see it.</p>
        </div>
        <div role="tablist" aria-label="What to share" className="inline-flex overflow-hidden rounded-full border border-app-border! text-[13px] font-semibold">
          {TABS.map((t) => (
            <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setMessage(null); }} className={`inline-flex items-center gap-1.5 px-4 py-2 ${tab === t.id ? "bg-[var(--m-ink)] text-[var(--m-paper,#fff)]" : "text-app-muted hover:bg-[var(--m-accent-soft)]"}`}>
              <t.icon size={14} aria-hidden /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          <p className="text-[12px] font-bold uppercase tracking-wide text-app-muted">1 · What</p>
          {tab === "files" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${drag ? "border-[var(--m-ink)]! bg-[var(--m-accent-soft)]" : "border-app-border!"}`}
              >
                <UploadCloud size={26} aria-hidden className="text-app-muted" />
                <p className="text-[14px] font-semibold text-app-charcoal">Drop files here</p>
                <p className="text-[12.5px] text-app-muted">PDF, Word, Excel, PowerPoint or images · up to {MAX_UPLOAD_MB} MB each · up to {MAX_FILES} at a time</p>
                <button type="button" onClick={() => input.current?.click()} className="o-btn-ghost mt-1">Browse files</button>
                <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose files" onChange={(e) => e.target.files && addFiles(e.target.files)} />
              </div>
              {files.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {files.map((f) => {
                    const Icon = iconFor(f.file.name);
                    return (
                      <li key={f.id} className="flex items-center gap-3 rounded-xl border border-app-border! p-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-app-orange-container text-app-orange"><Icon size={17} aria-hidden /></span>
                        <div className="min-w-0 flex-1">
                          <input aria-label={`Title for ${f.file.name}`} value={f.title} onChange={(e) => setFiles(files.map((x) => (x.id === f.id ? { ...x, title: e.target.value } : x)))} maxLength={200} className="o-input !py-1.5" />
                          <p className="mt-0.5 truncate text-[11.5px] text-app-muted">{f.file.name} · {kb(f.file.size)}</p>
                        </div>
                        <button type="button" onClick={() => setFiles(files.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.file.name}`} className="grid h-8 w-8 place-items-center rounded-full text-app-muted hover:bg-[var(--m-accent-soft)]"><X size={15} aria-hidden /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
          {tab === "link" && (
            <div className="flex flex-col gap-3">
              <label className="text-[12.5px] font-bold text-app-charcoal">Link<input value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} type="url" placeholder="https://" className="o-input mt-1" /></label>
              <label className="text-[12.5px] font-bold text-app-charcoal">Title<input value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} maxLength={200} className="o-input mt-1" /></label>
            </div>
          )}
          {tab === "note" && (
            <div className="flex flex-col gap-3">
              <label className="text-[12.5px] font-bold text-app-charcoal">Title<input value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} maxLength={200} className="o-input mt-1" /></label>
              <label className="text-[12.5px] font-bold text-app-charcoal">Note<textarea value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} rows={8} maxLength={20000} className="o-input mt-1" placeholder="Write what students should read or do." /></label>
            </div>
          )}
          <label className="text-[12.5px] font-bold text-app-charcoal">A line about it <span className="font-normal text-app-muted">(optional)</span><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className="o-input mt-1" /></label>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-[12px] font-bold uppercase tracking-wide text-app-muted">2 · Who sees it</p>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-app-charcoal">Branches</p>
              {canPickAll && branches.length > 1 && (
                <button type="button" onClick={() => setSelBranches(selBranches.length === branches.length ? [] : branches.map((b) => b.branch))} className="text-[12.5px] font-semibold text-app-orange hover:underline">{selBranches.length === branches.length ? "Clear" : "All branches"}</button>
              )}
            </div>
            {branches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-app-border! p-3 text-[12.5px] text-app-muted">No student has joined with a branch yet. Pick a subject below, or come back once students sign up.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <li key={b.branch}><button type="button" aria-pressed={selBranches.includes(b.branch)} onClick={() => setSelBranches(toggle(selBranches, b.branch))} className={`${CHIP} ${chipTone(selBranches.includes(b.branch))}`}>{b.branch}{b.students > 0 && <span className="ml-1.5 font-normal text-app-muted">{b.students.toLocaleString("en-IN")}</span>}</button></li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-app-charcoal">Year of study</p>
              <button type="button" onClick={() => setSelYears(selYears.length === YEARS.length ? [] : YEARS)} className="text-[12.5px] font-semibold text-app-orange hover:underline">{selYears.length === YEARS.length ? "Clear" : "All years"}</button>
            </div>
            <ul className="flex flex-wrap gap-2">
              {YEARS.map((y) => (
                <li key={y}><button type="button" aria-pressed={selYears.includes(y)} onClick={() => setSelYears(toggle(selYears, y))} className={`${CHIP} ${chipTone(selYears.includes(y))}`}>Year {y}</button></li>
              ))}
            </ul>
          </div>
          {subjects.length > 0 && (
            <label className="text-[12.5px] font-bold text-app-charcoal">Or share with one subject&apos;s class<select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="o-input mt-1"><option value="">Use the branches and years above</option>{subjects.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          )}
          <p className="rounded-xl bg-[var(--m-accent-soft)] px-3.5 py-2.5 text-[12.5px] text-app-charcoal" aria-live="polite">
            {summary ? <>Goes to <b>{summary}</b>.</> : "Choose at least one branch and one year."}
            {tooMany && <span className="block text-app-rose">That is more than {MAX_JOBS} groups. Narrow it down.</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-app-border! px-5 py-4">
        <button type="button" onClick={publish} disabled={!ready} className="o-btn disabled:opacity-50">
          {progress ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Publishing {progress.done} of {progress.total}…</> : "Publish to students"}
        </button>
        {!progress && !ready && <span className="text-[12.5px] text-app-muted">{!contentReady ? (tab === "files" ? "Add a file to continue." : "Fill in the details to continue.") : "Choose who should see it."}</span>}
        {message && <p role={message.ok ? "status" : "alert"} className={`text-[13px] font-medium ${message.ok ? "text-app-success" : "text-app-rose"}`}>{message.text}</p>}
      </div>
    </section>
  );
}

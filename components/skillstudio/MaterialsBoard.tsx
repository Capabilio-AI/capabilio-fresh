"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Link2, StickyNote, X, type LucideIcon } from "lucide-react";
import type { MaterialsView, StudyMaterial } from "@/lib/skillstudio/materials";

type Filter = "all" | StudyMaterial["kind"];
const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, { id: "file", label: "Files" }, { id: "notes", label: "Notes" }, { id: "link", label: "Links" }];
const ICON: Record<StudyMaterial["kind"], LucideIcon> = { file: FileText, notes: StickyNote, link: Link2 };

const sizeLabel = (n: number | null) => (n === null ? "" : n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

function Viewer({ m, onClose }: { m: StudyMaterial; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const mime = m.file?.mime ?? "";
  const previewable = m.file && (mime === "application/pdf" || mime.startsWith("image/"));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={m.title} className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--m-rule)] p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="font-lp-display text-[20px] font-bold leading-snug text-[var(--m-ink)]">{m.title}</h2>
            <p className="mt-0.5 text-[13px] text-app-muted">Shared by <span className="font-bold text-[var(--m-ink)]">{m.sharedBy.name}</span> · {m.sharedBy.role} · {dateLabel(m.sharedAt)}{m.subject ? ` · ${m.subject}` : ""}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {m.file && <a href={m.file.downloadUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-3.5 py-2 text-[13px] font-bold text-white"><Download size={14} aria-hidden />Download</a>}
            {m.link && <a href={m.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-3.5 py-2 text-[13px] font-bold text-white"><ExternalLink size={14} aria-hidden />Open link</a>}
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[var(--m-muted)] hover:bg-[var(--m-ground)]"><X size={18} aria-hidden /></button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--m-ground)]">
          {m.description && <p className="px-5 pt-4 text-[14px] leading-relaxed text-[var(--m-ink)]">{m.description}</p>}
          {m.kind === "notes" && <p className="whitespace-pre-wrap p-5 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{m.body}</p>}
          {m.file && previewable && mime === "application/pdf" && <iframe src={m.file.viewUrl} title={m.title} className="h-[70vh] w-full bg-white" />}
          {m.file && previewable && mime.startsWith("image/") && (
            <div className="p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage URL, shown once at full size */}
              <img src={m.file.viewUrl} alt={m.title} className="mx-auto max-h-[70vh] w-auto" />
            </div>
          )}
          {m.file && !previewable && <p className="p-6 text-[14px] text-app-muted">{m.file.name} can&apos;t be previewed here. Download it to open it on your device.</p>}
          {m.kind === "link" && <p className="p-6 text-[14px] text-app-muted">This is a link to another site. Open it in a new tab.</p>}
        </div>
      </div>
    </div>
  );
}

export function MaterialsBoard({ view }: { view: MaterialsView }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<StudyMaterial | null>(null);
  const shown = useMemo(() => view.items.filter((m) => filter === "all" || m.kind === filter), [view.items, filter]);
  const count = (f: Filter) => (f === "all" ? view.items.length : view.items.filter((m) => m.kind === f).length);

  return (
    <section aria-labelledby="mat-h" className="flex flex-col gap-4">
      <div>
        <h2 id="mat-h" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Materials from your faculty</h2>
        <p className="mt-1 max-w-[70ch] text-[13.5px] text-app-muted">Notes, PDFs and links shared with {view.branch} students at {view.institutionName}. Open one to read it here, or download it.</p>
      </div>
      <div role="group" aria-label="Filter materials" className="flex flex-wrap gap-2">
        {FILTERS.filter((f) => f.id === "all" || count(f.id) > 0).map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${filter === f.id ? "bg-[var(--m-ink)] text-white" : "bg-white text-[var(--m-muted)] hover:text-[var(--m-ink)]"}`}>{f.label} <span className="opacity-60">{count(f.id)}</span></button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--m-off)] bg-white px-6 py-14 text-center text-[14px] text-app-muted">{view.items.length === 0 ? "Nothing has been shared yet. When your professors or mentors share notes and PDFs, they appear here." : "Nothing of this type yet."}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((m) => {
            const Icon = ICON[m.kind];
            return (
              <li key={m.id}>
                <button type="button" onClick={() => setOpen(m)} className="group flex h-full w-full flex-col gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--m-ink)] hover:shadow-[0_8px_20px_-8px_rgba(20,20,20,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--m-accent-soft)] text-[var(--m-accent)]"><Icon size={19} aria-hidden /></span>
                    <span className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{m.kind === "file" ? (m.file?.mime === "application/pdf" ? "PDF" : "File") : m.kind === "notes" ? "Notes" : "Link"}{m.file?.size ? ` · ${sizeLabel(m.file.size)}` : ""}</span>
                  </span>
                  <span className="font-lp-display text-[17px] font-bold leading-snug text-[var(--m-ink)]">{m.title}</span>
                  {m.description && <span className="line-clamp-2 text-[13px] leading-snug text-app-muted">{m.description}</span>}
                  <span className="mt-auto flex items-center gap-2.5 border-t border-[var(--m-rule)] pt-3">
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--m-ink)] text-[11px] font-bold text-white">{initials(m.sharedBy.name)}</span>
                    <span className="min-w-0 text-[12.5px] leading-tight"><span className="block truncate font-bold text-[var(--m-ink)]">{m.sharedBy.name}</span><span className="block truncate text-app-muted">{m.sharedBy.role}{m.subject ? ` · ${m.subject}` : ""} · {dateLabel(m.sharedAt)}</span></span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && <Viewer m={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

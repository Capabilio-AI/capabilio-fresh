"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, FileImage, FileSpreadsheet, FileText, LayoutGrid, Link2, List, Presentation, Search, StickyNote, Trash2, Users, type LucideIcon } from "lucide-react";

export type LibraryKind = "link" | "note" | "pdf" | "excel" | "slides" | "image" | "document";
export interface LibraryItem {
  shareId: string;
  title: string;
  description: string | null;
  kind: LibraryKind;
  /** a few short audience chips, and the full sentence for a tooltip */
  chips: string[];
  audienceFull: string;
  groups: number;
  size: string | null;
  sharedAt: string;
  href: string | null;
  author: string | null;
}
export interface LibraryFilters { q: string; type: string; branch: string; year: string; sort: string; view: string; page: number; pages: number; total: number }

const LOOK: Record<LibraryKind, { icon: LucideIcon; tone: string; label: string }> = {
  link: { icon: Link2, tone: "bg-app-blue-container text-app-blue", label: "Link" },
  note: { icon: StickyNote, tone: "bg-app-warning-container text-app-warning", label: "Note" },
  pdf: { icon: FileText, tone: "bg-app-rose-container text-app-rose", label: "PDF" },
  excel: { icon: FileSpreadsheet, tone: "bg-app-success-container text-app-success", label: "Excel" },
  slides: { icon: Presentation, tone: "bg-app-orange-container text-app-orange", label: "Slides" },
  image: { icon: FileImage, tone: "bg-app-blue-container text-app-blue", label: "Image" },
  document: { icon: FileText, tone: "bg-app-blue-container text-app-blue", label: "Document" },
};
const TYPES = [["", "All types"], ["file", "Files"], ["link", "Links"], ["pdf", "PDF links"], ["notes", "Notes"]] as const;
const SORTS = [["new", "Newest first"], ["old", "Oldest first"], ["name", "Title A to Z"], ["size", "Largest first"]] as const;
const YEARS = ["1", "2", "3", "4"];
const SELECT = "o-input !w-auto !rounded-full !py-2 text-[13px]";
const CHIP = "inline-flex max-w-full items-center truncate rounded-full border border-app-border! px-2.5 py-0.5 text-[11.5px] font-semibold text-app-charcoal";

function Chips({ item }: { item: LibraryItem }) {
  const shown = item.chips.slice(0, 2);
  const more = item.chips.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1.5" title={item.audienceFull}>
      {shown.map((c) => <span key={c} className={CHIP}>{c}</span>)}
      {more > 0 && <span className={`${CHIP} text-app-muted`}>+{more} more</span>}
      {item.groups > 1 && <span className="text-[11.5px] text-app-muted">{item.groups} groups</span>}
    </span>
  );
}

/**
 * The shared-materials library for staff: one row per share (however many branches and years it went to), searchable, filterable, sortable and
 * paged, with a list and a card view and bulk remove. Filters live in the URL, so a view can be shared or reloaded.
 */
export function MaterialsLibrary({ items, branches, filters, canSeeAuthors }: { items: LibraryItem[]; branches: string[]; filters: LibraryFilters; canSeeAuthors: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState(filters.q);

  const go = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) (v ? p.set(k, v) : p.delete(k));
    if (!("page" in next)) p.delete("page");
    setPicked([]);
    router.replace(p.toString() ? `/org/materials?${p}` : "/org/materials", { scroll: false });
  };
  const cards = filters.view === "cards";
  const allOnPage = items.length > 0 && items.every((i) => picked.includes(i.shareId));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function remove(ids: string[], label: string) {
    if (!window.confirm(`Remove ${label}? Students will no longer see ${ids.length === 1 ? "it" : "them"}.`)) return;
    setError(null);
    const res = await fetch("/api/org/materials/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareIds: ids }) });
    if (!res.ok) return setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't remove that.");
    setPicked([]);
    startBusy(() => router.refresh());
  }

  const filtered = Boolean(filters.q || filters.type || filters.branch || filters.year);
  return (
    <section aria-label="Library" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <form role="search" onSubmit={(e) => { e.preventDefault(); go({ q: term.trim() || undefined }); }} className="relative">
          <label>
            <span className="sr-only">Search the library</span>
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search title or file name" className="o-input !w-60 !rounded-full !pl-9" />
          </label>
        </form>
        <select aria-label="Type" value={filters.type} onChange={(e) => go({ type: e.target.value || undefined })} className={SELECT}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {branches.length > 1 && <select aria-label="Branch" value={filters.branch} onChange={(e) => go({ branch: e.target.value || undefined })} className={`${SELECT} max-w-[15rem]`}><option value="">All branches</option>{branches.map((b) => <option key={b} value={b}>{b}</option>)}</select>}
        <select aria-label="Year" value={filters.year} onChange={(e) => go({ year: e.target.value || undefined })} className={SELECT}><option value="">All years</option>{YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}</select>
        <select aria-label="Sort" value={filters.sort} onChange={(e) => go({ sort: e.target.value === "new" ? undefined : e.target.value })} className={SELECT}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {filtered && <button type="button" onClick={() => { setTerm(""); go({ q: undefined, type: undefined, branch: undefined, year: undefined }); }} className="text-[12.5px] font-semibold text-app-orange hover:underline">Clear</button>}
        <span className="ml-auto inline-flex overflow-hidden rounded-full border border-app-border! text-[12.5px] font-semibold" role="group" aria-label="Layout">
          <button type="button" aria-pressed={!cards} onClick={() => go({ view: undefined })} className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${!cards ? "bg-[var(--m-ink)] text-[var(--m-paper,#fff)]" : "text-app-muted hover:bg-[var(--m-accent-soft)]"}`}><List size={13} aria-hidden />List</button>
          <button type="button" aria-pressed={cards} onClick={() => go({ view: "cards" })} className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${cards ? "bg-[var(--m-ink)] text-[var(--m-paper,#fff)]" : "text-app-muted hover:bg-[var(--m-accent-soft)]"}`}><LayoutGrid size={13} aria-hidden />Cards</button>
        </span>
      </div>

      <p className="text-[12.5px] text-app-muted" aria-live="polite">{filters.total.toLocaleString("en-IN")} {filters.total === 1 ? "item" : "items"}{filtered ? " match" : ""}</p>

      {picked.length > 0 && (
        <div role="region" aria-label="Selected items" className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--m-ink)]! bg-[var(--m-accent-soft)] px-4 py-2.5 shadow-sm">
          <span className="text-[13px] font-semibold text-app-charcoal">{picked.length} selected</span>
          <button type="button" onClick={() => void remove(picked, `${picked.length} item${picked.length === 1 ? "" : "s"}`)} disabled={busy} className="o-btn-ghost !px-3 !py-1.5"><Trash2 size={13} aria-hidden />Remove</button>
          <button type="button" onClick={() => setPicked([])} className="text-[12.5px] font-semibold text-app-muted hover:underline">Clear selection</button>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] font-medium text-app-rose">{error}</p>}

      {cards ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((m) => {
            const look = LOOK[m.kind];
            return (
              <li key={m.shareId} className="o-card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${look.tone}`}><look.icon size={19} aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-app-charcoal" title={m.title}>{m.title}</p>
                    <p className="text-[12px] text-app-muted">{look.label}{m.size ? ` · ${m.size}` : ""} · {m.sharedAt}</p>
                  </div>
                  <input type="checkbox" checked={picked.includes(m.shareId)} onChange={() => toggle(m.shareId)} aria-label={`Select ${m.title}`} className="mt-1 h-4 w-4 accent-[var(--m-ink)]" />
                </div>
                {m.description && <p className="line-clamp-2 text-[12.5px] text-app-muted">{m.description}</p>}
                <Chips item={m} />
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-app-border! pt-3">
                  <span className="truncate text-[12px] text-app-muted">{canSeeAuthors && m.author ? `By ${m.author}` : ""}</span>
                  <span className="flex items-center gap-1.5">
                    {m.href && <a href={m.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${m.title}`} className="o-btn-ghost !px-2.5"><ExternalLink size={14} aria-hidden /></a>}
                    <button type="button" onClick={() => void remove([m.shareId], `"${m.title}"`)} aria-label={`Remove ${m.title}`} className="o-btn-ghost !px-2.5"><Trash2 size={14} aria-hidden /></button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="o-card overflow-hidden">
          <div className="hidden items-center gap-3 border-b border-app-border! px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-app-muted md:grid md:grid-cols-[24px_minmax(0,1.6fr)_minmax(0,1.2fr)_72px_104px_88px]">
            <input type="checkbox" checked={allOnPage} onChange={() => setPicked(allOnPage ? [] : items.map((i) => i.shareId))} aria-label="Select all on this page" className="h-4 w-4 accent-[var(--m-ink)]" />
            <span>Material</span><span>Shared with</span><span>Size</span><span>Shared</span><span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-app-border!">
            {items.map((m) => {
              const look = LOOK[m.kind];
              return (
                <li key={m.shareId} className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[24px_minmax(0,1.6fr)_minmax(0,1.2fr)_72px_104px_88px]">
                  <input type="checkbox" checked={picked.includes(m.shareId)} onChange={() => toggle(m.shareId)} aria-label={`Select ${m.title}`} className="h-4 w-4 accent-[var(--m-ink)]" />
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${look.tone}`}><look.icon size={16} aria-hidden /></span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-app-charcoal" title={m.title}>{m.title}</p>
                      <p className="truncate text-[12px] text-app-muted">{look.label}{canSeeAuthors && m.author ? ` · ${m.author}` : ""}{m.description ? ` · ${m.description}` : ""}</p>
                    </div>
                  </div>
                  <div className="col-start-2 flex items-center gap-1.5 md:col-start-auto"><Users size={13} aria-hidden className="shrink-0 text-app-muted" /><Chips item={m} /></div>
                  <span className="col-start-2 text-[12.5px] tabular-nums text-app-muted md:col-start-auto">{m.size ?? "—"}</span>
                  <span className="col-start-2 text-[12.5px] text-app-muted md:col-start-auto">{m.sharedAt}</span>
                  <span className="col-start-2 flex items-center gap-1.5 md:col-start-auto md:justify-end">
                    {m.href && <a href={m.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${m.title}`} className="o-btn-ghost !px-2.5"><ExternalLink size={14} aria-hidden /></a>}
                    <button type="button" onClick={() => void remove([m.shareId], `"${m.title}"`)} aria-label={`Remove ${m.title}`} className="o-btn-ghost !px-2.5"><Trash2 size={14} aria-hidden /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {filters.pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => go({ page: filters.page > 2 ? String(filters.page - 1) : undefined })} disabled={filters.page <= 1} aria-label="Previous page" className="o-btn-ghost !px-2.5"><ChevronLeft size={15} aria-hidden /></button>
          <span className="text-[12.5px] tabular-nums text-app-muted">Page {filters.page} of {filters.pages}</span>
          <button type="button" onClick={() => go({ page: String(filters.page + 1) })} disabled={filters.page >= filters.pages} aria-label="Next page" className="o-btn-ghost !px-2.5"><ChevronRight size={15} aria-hidden /></button>
        </nav>
      )}
    </section>
  );
}

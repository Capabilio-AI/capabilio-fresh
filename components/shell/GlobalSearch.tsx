"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Search, X } from "lucide-react";
import clsx from "clsx";
import type { SearchResults } from "@/lib/pulse/search";
import { Avatar } from "@/components/pulse/Avatar";

const DEBOUNCE_MS = 250;
const MIN = 2;
type Item = { key: string; href: string };

/** Search for people and colleges from anywhere in the app. Debounced, cancels stale requests, fully keyboard operable. */
export function GlobalSearch() {
  const router = useRouter();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [found, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(-1);
  const term = q.trim();
  const results = term.length >= MIN ? found : null;

  useEffect(() => {
    if (term.length < MIN) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!res.ok) throw new Error("bad");
        setResults((await res.json()) as SearchResults);
        setError(false);
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const items: Item[] = [
    ...(results?.people ?? []).map((p) => ({ key: `p-${p.id}`, href: `/pulse/u/${p.id}` })),
    ...(results?.colleges ?? []).map((c) => ({ key: `c-${c.id}`, href: `/o/${c.slug}` })),
  ];
  const fullHref = `/pulse/search?q=${encodeURIComponent(term)}`;
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (items.length > 0) setActive((a) => (e.key === "ArrowDown" ? (a + 1) % items.length : (a - 1 + items.length) % items.length));
    }
    if (e.key === "Enter" && term.length >= MIN) {
      e.preventDefault();
      go(active >= 0 ? items[active].href : fullHref);
    }
  }

  const showPanel = open && term.length >= MIN;
  const empty = results && items.length === 0 && !loading;

  return (
    <div ref={box} className="relative hidden w-full max-w-sm md:block">
      <div className={clsx("flex items-center rounded-full border bg-app-background px-3.5 transition-shadow", open ? "border-app-orange ring-2 ring-app-orange/20" : "border-app-border")}>
        <Search size={15} className="shrink-0 text-app-muted" aria-hidden="true" />
        <input
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={`${id}-list`}
          aria-activedescendant={active >= 0 ? `${id}-${items[active].key}` : undefined}
          aria-autocomplete="list"
          aria-label="Search people and colleges"
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search people and colleges…"
          className="w-full bg-transparent py-2 pl-2.5 pr-1 font-lp-body text-[13px] text-app-charcoal placeholder:text-app-muted focus:outline-none"
        />
        {loading && <Loader2 size={14} className="shrink-0 animate-spin text-app-muted" aria-label="Searching" />}
        {q && !loading && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="shrink-0 rounded-full p-1 text-app-muted hover:text-app-charcoal"><X size={14} /></button>}
      </div>

      {showPanel && (
        <div id={`${id}-list`} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-app-border bg-white p-2 shadow-xl">
          {error && <p role="alert" className="px-3 py-3 font-lp-body text-[12.5px] text-app-rose">Search isn&apos;t working right now. Try again in a moment.</p>}
          {empty && <p className="px-3 py-4 font-lp-body text-[13px] text-app-muted">No people or colleges match “{term}”.</p>}
          {results && results.people.length > 0 && (
            <div>
              <p className="px-3 pb-1 pt-2 font-lp-body text-[11.5px] font-semibold text-app-muted">People</p>
              {results.people.map((p, i) => (
                <Link key={p.id} id={`${id}-p-${p.id}`} role="option" aria-selected={active === i} href={`/pulse/u/${p.id}`} onClick={() => setOpen(false)} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2", active === i ? "bg-app-background" : "hover:bg-app-background")}>
                  <Avatar person={p} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-lp-body text-[13.5px] font-semibold text-app-charcoal">{p.name}</span>
                    <span className="block truncate font-lp-body text-[11.5px] text-app-muted">{p.headline ?? "Capabilio member"}</span>
                  </span>
                  {p.following && <span className="shrink-0 font-lp-mono text-[10.5px] text-app-muted">Following</span>}
                </Link>
              ))}
            </div>
          )}
          {results && results.colleges.length > 0 && (
            <div>
              <p className="px-3 pb-1 pt-2 font-lp-body text-[11.5px] font-semibold text-app-muted">Colleges</p>
              {results.colleges.map((c, j) => {
                const i = results.people.length + j;
                return (
                  <Link key={c.id} id={`${id}-c-${c.id}`} role="option" aria-selected={active === i} href={`/o/${c.slug}`} onClick={() => setOpen(false)} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2", active === i ? "bg-app-background" : "hover:bg-app-background")}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-orange-container text-app-orange"><Building2 size={16} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-lp-body text-[13.5px] font-semibold text-app-charcoal">{c.name}</span>
                      <span className="block truncate font-lp-body text-[11.5px] text-app-muted">{c.location ?? "College page"}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {items.length > 0 && <Link href={fullHref} onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-3 py-2.5 text-center font-lp-body text-[12.5px] font-medium text-app-blue hover:bg-app-background">See all results for “{term}”</Link>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Search, X } from "lucide-react";
import type { Follower } from "@/lib/org/followers";
import { Avatar } from "@/components/pulse/Avatar";
import { FollowButton } from "@/components/pulse/FollowButton";
import { MentorBadge } from "@/components/pulse/MentorBadge";

interface Page {
  people: Follower[];
  total: number;
  nextCursor: string | null;
}

/** Pure. The people whose name, goal, line or class match what was typed. */
export function matchFollowers(people: readonly Follower[], query: string): Follower[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...people];
  return people.filter((p) => [p.name, p.tagline, p.headline, p.detail].some((field) => field?.toLowerCase().includes(q)));
}

function FollowersDialog({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [people, setPeople] = useState<Follower[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed" | "more">("loading");
  const [query, setQuery] = useState("");

  // The first page is requested from the effect; "show more" and "try again" come from buttons, so state is only ever set from a promise or an event.
  const request = useCallback(
    async (before: string | null) => {
      const res = await fetch(`/api/orgs/followers?slug=${encodeURIComponent(slug)}${before ? `&before=${encodeURIComponent(before)}` : ""}`);
      if (!res.ok) throw new Error("bad");
      return (await res.json()) as Page;
    },
    [slug]
  );
  const apply = useCallback((page: Page, append: boolean) => {
    setPeople((current) => (append ? [...current, ...page.people.filter((p) => !current.some((c) => c.id === p.id))] : page.people));
    setTotal(page.total);
    setCursor(page.nextCursor);
    setStatus("ready");
  }, []);
  const loadMore = (before: string | null) => {
    setStatus(before ? "more" : "loading");
    request(before).then((page) => apply(page, Boolean(before)), () => setStatus("failed"));
  };

  useEffect(() => {
    let live = true;
    request(null).then(
      (page) => live && apply(page, false),
      () => live && setStatus("failed")
    );
    return () => {
      live = false;
    };
  }, [request, apply]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const shown = useMemo(() => matchFollowers(people, query), [people, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Followers of ${name}`} className="flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--m-rule)] px-5 py-4">
          <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Followers{total !== null ? ` · ${total.toLocaleString("en-IN")}` : ""}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--m-muted)] hover:bg-[var(--m-ground)]">
            <X size={18} aria-hidden />
          </button>
        </header>

        {people.length > 0 && (
          <div className="border-b border-[var(--m-rule)] px-5 py-3">
            <label className="flex items-center gap-2 rounded-lg border border-[var(--m-rule)] px-3 py-2 focus-within:ring-2 focus-within:ring-app-orange/40">
              <Search size={14} className="text-app-muted" aria-hidden />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search followers" aria-label="Search followers" className="w-full bg-transparent font-lp-body text-[13px] outline-none" />
            </label>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {status === "loading" && (
            <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-app-muted">
              <Loader2 size={15} className="animate-spin" aria-hidden />
              Loading…
            </p>
          )}
          {status === "failed" && (
            <div role="alert" className="py-10 text-center text-[13px] text-app-rose">
              Couldn&apos;t load the followers.{" "}
              <button type="button" onClick={() => loadMore(people.length > 0 ? cursor : null)} className="font-semibold underline">
                Try again
              </button>
            </div>
          )}
          {status !== "loading" && status !== "failed" && people.length === 0 && <p className="py-10 text-center text-[13.5px] text-app-muted">{name} has no followers yet.</p>}
          {people.length > 0 && shown.length === 0 && <p className="py-8 text-center text-[13px] text-app-muted">No one matches &ldquo;{query.trim()}&rdquo; among the {people.length} loaded.</p>}
          {shown.length > 0 && (
            <ul className="flex flex-col gap-4 py-1">
              {shown.map((p) => (
                <li key={p.id} className="flex items-start gap-3">
                  <Link href={`/pulse/u/${p.id}`} onClick={onClose} className="mt-0.5">
                    <Avatar person={p} size="sm" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/pulse/u/${p.id}`} onClick={onClose} className="truncate font-lp-body text-[13.5px] font-semibold text-[var(--m-ink)] hover:underline">
                        {p.name ?? "Capabilio member"}
                      </Link>
                      {p.isMentor && <MentorBadge />}
                      {p.fromThisCollege && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-app-success-container px-2 py-0.5 font-lp-body text-[10.5px] font-semibold text-app-success" title={`Studies or works at ${name}`}>
                          <GraduationCap size={11} aria-hidden /> At this college
                        </span>
                      )}
                    </span>
                    {p.tagline && <p className="truncate font-lp-body text-[12px] font-medium text-app-blue">{p.tagline}</p>}
                    <p className="truncate font-lp-body text-[11.5px] text-app-muted">{[p.headline, p.detail].filter(Boolean).join(" · ") || "Capabilio member"}</p>
                  </div>
                  {!p.isMe && <FollowButton userId={p.id} initialFollowing={p.following} compact />}
                </li>
              ))}
            </ul>
          )}
          {status !== "loading" && status !== "failed" && cursor && (
            <div className="py-3 text-center">
              <button type="button" onClick={() => loadMore(cursor)} disabled={status === "more"} className="rounded-full border border-[var(--m-rule)] px-4 py-1.5 font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)] hover:bg-app-background disabled:opacity-60">
                {status === "more" ? "Loading…" : "Show more"}
              </button>
              {query.trim() && <p className="mt-2 font-lp-body text-[11px] text-app-muted">Search covers the followers loaded so far.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The follower count as a button that opens the list. Someone who is not signed in is sent to sign in, because the list is for Capabilio members.
 */
export function FollowersButton({ slug, name, signedIn, className, children }: { slug: string; name: string; signedIn: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!signedIn) {
    return (
      <Link href="/login" className={className} title="Sign in to see who follows this college">
        {children}
      </Link>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={className} title={`See who follows ${name}`}>
        {children}
      </button>
      {open && <FollowersDialog slug={slug} name={name} onClose={close} />}
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ExternalLink, GraduationCap, Loader2, Search, UserCheck, UserPlus, X } from "lucide-react";
import type { Follower } from "@/lib/org/followers";
import { initialsOf } from "@/lib/org/format";

// Styled only with the college theme's own tokens (text-app-*, border-app-*, o-card, o-btn, o-input, --o-gradient, --o-pop), which both the dark public
// page and the light staff workspace re-colour. Never bg-white / text-white or the student app's --m-* colours: in this theme they flip or do not exist.

interface Page {
  people: Follower[];
  total: number;
  nextCursor: string | null;
}

/** Pure. The people whose name matches what was typed. The list shows names only, so the search looks at names only. */
export function matchFollowers(people: readonly Follower[], query: string): Follower[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...people];
  return people.filter((p) => p.name?.toLowerCase().includes(q));
}

/** Pure. "20 Oct 2026", or null if the date is not usable. */
export function followedOn(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

const nameOf = (p: Pick<Follower, "name">) => p.name?.trim() || "Capabilio member";

/** Profile picture, or the person's initials on the college's gold. */
function Face({ person, size }: { person: Pick<Follower, "name" | "avatarUrl">; size: "md" | "xl" }) {
  const box = size === "xl" ? "h-20 w-20 text-[26px]" : "h-11 w-11 text-[14px]";
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[image:var(--o-gradient)] font-extrabold text-[color:var(--o-ink-on-gold)] ${box}`} aria-hidden="true">
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage-hosted user avatar, arbitrary origin
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(nameOf(person))
      )}
    </span>
  );
}

/** Follow / Following for one person, in the college theme. Optimistic; goes back and says so if the server refuses. */
function PersonFollow({ person, onChange }: { person: Follower; onChange: (following: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle() {
    const next = !person.following;
    setBusy(true);
    setError(null);
    onChange(next);
    try {
      const res = await fetch(`/api/pulse/follow/${person.id}`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        onChange(!next);
        setError(body?.error ?? "Couldn't update. Try again.");
      }
    } catch {
      onChange(!next);
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={person.following} className={person.following ? "o-btn-ghost" : "o-btn"}>
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : person.following ? <UserCheck size={14} aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
        {person.following ? "Following" : "Follow"}
      </button>
      {error && (
        <span role="alert" className="text-[11.5px] text-app-rose">
          {error}
        </span>
      )}
    </span>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-app-border py-3 first:border-t-0">
      <dt className="o-eyebrow">{label}</dt>
      <dd className="text-[13.5px] font-medium text-app-charcoal">{children}</dd>
    </div>
  );
}

/** Everything the college page may show about one follower: public profile facts only, never an email, with a way into their full profile. */
function FollowerDetails({ person, collegeName, onFollowChange }: { person: Follower; collegeName: string; onFollowChange: (following: boolean) => void }) {
  const since = followedOn(person.followedAt);
  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex items-center gap-4">
        <Face person={person} size="xl" />
        <div className="min-w-0">
          <h3 className="break-words text-[19px] font-extrabold leading-tight text-app-charcoal">{nameOf(person)}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {person.isMentor && (
              <span className="inline-flex items-center gap-1 rounded-full bg-app-blue-container px-2 py-0.5 text-[11px] font-bold text-app-blue" title="Approved Capabilio mentor">
                <BadgeCheck size={12} aria-hidden="true" /> Mentor
              </span>
            )}
            {person.fromThisCollege && (
              <span className="inline-flex items-center gap-1 rounded-full bg-app-success-container px-2 py-0.5 text-[11px] font-bold text-app-success">
                <GraduationCap size={12} aria-hidden="true" /> At {collegeName}
              </span>
            )}
            {person.isMe && <span className="rounded-full bg-app-orange-container px-2 py-0.5 text-[11px] font-bold text-app-orange">You</span>}
          </div>
        </div>
      </div>

      <dl>
        {person.headline && <Detail label="On Capabilio">{person.headline}</Detail>}
        {person.detail && <Detail label="Class and branch">{person.detail}</Detail>}
        {person.tagline && <Detail label="Career goal">{person.tagline}</Detail>}
        {since && <Detail label={`Following ${collegeName} since`}>{since}</Detail>}
      </dl>

      <div className="flex flex-wrap items-start gap-2">
        {!person.isMe && <PersonFollow person={person} onChange={onFollowChange} />}
        <Link href={`/pulse/u/${person.id}`} target="_blank" rel="noopener noreferrer" className="o-btn-ghost">
          <ExternalLink size={14} aria-hidden="true" /> Open full profile
        </Link>
      </div>
    </div>
  );
}

function FollowersDialog({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [people, setPeople] = useState<Follower[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed" | "more">("loading");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const selected = people.find((p) => p.id === selectedId) ?? null;
  const setFollowing = (id: string, following: boolean) => setPeople((current) => current.map((p) => (p.id === id ? { ...p, following } : p)));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={selected ? `${nameOf(selected)}, follower of ${name}` : `Followers of ${name}`} className="o-card flex max-h-[84vh] w-full max-w-md flex-col overflow-hidden !bg-[var(--o-pop,#14110c)]">
        <header className="flex items-center justify-between gap-3 border-b border-app-border px-5 py-4">
          {selected ? (
            <button type="button" onClick={() => setSelectedId(null)} className="o-btn-ghost !px-3 !py-1.5">
              <ArrowLeft size={14} aria-hidden="true" /> Followers
            </button>
          ) : (
            <h2 className="text-[17px] font-extrabold text-app-charcoal">Followers{total !== null ? ` · ${total.toLocaleString("en-IN")}` : ""}</h2>
          )}
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="o-btn-ghost !p-2">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        {!selected && people.length > 0 && (
          <div className="border-b border-app-border px-5 py-3">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" aria-label="Search followers by name" className="o-input !pl-9" />
            </label>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {selected ? (
            <FollowerDetails person={selected} collegeName={name} onFollowChange={(f) => setFollowing(selected.id, f)} />
          ) : (
            <>
              {status === "loading" && (
                <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-app-muted">
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  Loading…
                </p>
              )}
              {status === "failed" && (
                <div role="alert" className="py-10 text-center text-[13px] text-app-rose">
                  Couldn&apos;t load the followers.{" "}
                  <button type="button" onClick={() => loadMore(people.length > 0 ? cursor : null)} className="font-bold underline">
                    Try again
                  </button>
                </div>
              )}
              {status !== "loading" && status !== "failed" && people.length === 0 && <p className="py-10 text-center text-[13.5px] text-app-muted">{name} has no followers yet.</p>}
              {people.length > 0 && shown.length === 0 && <p className="py-8 text-center text-[13px] text-app-muted">No one called &ldquo;{query.trim()}&rdquo; among the {people.length} loaded.</p>}
              {shown.length > 0 && (
                <ul className="divide-y divide-app-border">
                  {shown.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <Face person={p} size="md" />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-app-charcoal">
                        {nameOf(p)}
                        {p.isMe && <span className="ml-2 text-[11.5px] font-medium text-app-muted">You</span>}
                      </span>
                      <button type="button" onClick={() => setSelectedId(p.id)} className="o-btn-ghost shrink-0">
                        View details
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {status !== "loading" && status !== "failed" && cursor && (
                <div className="pt-3 text-center">
                  <button type="button" onClick={() => loadMore(cursor)} disabled={status === "more"} className="o-btn-ghost">
                    {status === "more" ? "Loading…" : "Show more"}
                  </button>
                  {query.trim() && <p className="mt-2 text-[11px] text-app-muted">Search covers the followers loaded so far.</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The follower count as a button that opens the list. Someone who is not signed in is sent to sign in, because the list is for Capabilio members.
 *
 * The dialog is drawn at the top level of the college theme, not where the button is. The page header is its own stacking layer (relative z-10) and the tab bar
 * under it has the same level and comes later, so a dialog drawn inside the header ended up beneath the tabs. It goes into the nearest `.org-theme` element
 * (not the document body) so it keeps the theme's colours.
 */
export function FollowersButton({ slug, name, signedIn, className, children }: { slug: string; name: string; signedIn: boolean; className?: string; children: ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  const close = useCallback(() => setHost(null), []);
  if (!signedIn) {
    return (
      <Link href="/login" className={className} title="Sign in to see who follows this college">
        {children}
      </Link>
    );
  }
  return (
    <>
      <button type="button" onClick={(e) => setHost(e.currentTarget.closest(".org-theme") ?? document.body)} aria-haspopup="dialog" className={className} title={`See who follows ${name}`}>
        {children}
      </button>
      {host && createPortal(<FollowersDialog slug={slug} name={name} onClose={close} />, host)}
    </>
  );
}

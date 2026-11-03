"use client";

import { useState } from "react";
import Link from "next/link";
import type { Follower } from "@/lib/org/followers";

const formatDate = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
};

/** Who follows the company, newest first. The first page comes from the server; "Show more" asks the same cursor API the page buttons use. */
export function FollowersTable({ slug, initial, total, nextCursor }: { slug: string; initial: Follower[]; total: number; nextCursor: string | null }) {
  const [people, setPeople] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/followers?slug=${encodeURIComponent(slug)}&before=${encodeURIComponent(cursor)}`);
      if (!res.ok) throw new Error("bad status");
      const page = (await res.json()) as { people: Follower[]; nextCursor: string | null };
      setPeople((prev) => [...prev, ...page.people.filter((p) => !prev.some((q) => q.id === p.id))]);
      setCursor(page.nextCursor);
    } catch {
      setError("Could not load more. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (people.length === 0) return <p className="font-lp-body text-[13px] text-app-muted">No followers yet. Make your page public and share the link, and students can follow you from it.</p>;
  return (
    <div>
      <p className="font-lp-body text-[13px] text-app-muted"><span className="tabular-nums font-semibold text-[var(--m-ink)]">{total.toLocaleString("en-IN")}</span> {total === 1 ? "follower" : "followers"}</p>
      <ul className="mt-3 divide-y divide-[var(--m-rule)] rounded-2xl border border-[var(--m-rule)] bg-[#fff]">
        {people.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{p.name ?? "A Capabilio member"}</p>
              {(p.headline || p.detail) && <p className="truncate font-lp-body text-[12px] text-app-muted">{[p.headline, p.detail].filter(Boolean).join(" · ")}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-lp-body text-[12px] text-app-muted">{formatDate(p.followedAt)}</span>
              <Link href={`/pulse/u/${p.id}`} target="_blank" rel="noopener noreferrer" className="font-lp-body text-[12.5px] font-semibold underline">Profile</Link>
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 font-lp-body text-[12.5px] text-app-rose">{error}</p>}
      {cursor && <button type="button" onClick={more} disabled={busy} className="mt-4 rounded-full border border-[var(--m-soft)] bg-[var(--m-ground)] hover:bg-[var(--m-accent-soft)] px-4 py-1.5 font-lp-body text-[12.5px] font-semibold disabled:opacity-50">{busy ? "Loading…" : "Show more"}</button>}
    </div>
  );
}

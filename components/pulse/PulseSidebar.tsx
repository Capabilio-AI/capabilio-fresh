"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Hash, UserPlus } from "lucide-react";
import type { Suggestion, TrendingTag } from "@/lib/pulse/sidebar";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";

interface SidebarData {
  trending: TrendingTag[];
  suggestions: Suggestion[];
}

const CARD = "rounded-2xl border border-app-border bg-white p-5";

/** Right rail: what people are posting about this week, and people worth following. Both are computed from real activity. */
export function PulseSidebar() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/pulse/sidebar")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((d: SidebarData) => setData(d))
      .catch(() => setFailed(true));
  }, []);

  return (
    <aside aria-label="Trending and suggestions" className="flex flex-col gap-4">
      <section className={CARD}>
        <h2 className="flex items-center gap-2 font-lp-display text-[15px] font-semibold text-app-charcoal"><Hash size={15} className="text-app-orange" aria-hidden="true" /> Trending this week</h2>
        {data === null && !failed ? <div className="mt-4 h-20 animate-pulse rounded-lg bg-app-background" /> : data && data.trending.length > 0 ? (
          <ul className="mt-3 flex flex-col">
            {data.trending.map((t) => (
              <li key={t.tag}>
                <Link href={`/pulse?tag=${t.tag}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-app-background">
                  <span className="font-lp-body text-[13.5px] font-medium text-app-charcoal">#{t.tag}</span>
                  <span className="font-lp-mono text-[11px] text-app-muted">{t.posts} {t.posts === 1 ? "post" : "posts"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-lp-body text-[12.5px] text-app-muted">{failed ? "Couldn't load trending tags." : "Tags people use in posts show up here. Try #projects or #internships."}</p>
        )}
      </section>

      <section className={CARD}>
        <h2 className="flex items-center gap-2 font-lp-display text-[15px] font-semibold text-app-charcoal"><UserPlus size={15} className="text-app-orange" aria-hidden="true" /> People to follow</h2>
        {data === null && !failed ? <div className="mt-4 h-28 animate-pulse rounded-lg bg-app-background" /> : data && data.suggestions.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-3.5">
            {data.suggestions.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Link href={`/pulse/u/${p.id}`}><Avatar person={p} size="sm" /></Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/pulse/u/${p.id}`} className="block truncate font-lp-body text-[13px] font-semibold text-app-charcoal hover:underline">{p.name}</Link>
                  <p className="truncate font-lp-body text-[11.5px] text-app-muted">{p.reason}{p.headline ? ` · ${p.headline}` : ""}</p>
                </div>
                <FollowButton userId={p.id} initialFollowing={false} compact />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-lp-body text-[12.5px] text-app-muted">{failed ? "Couldn't load suggestions." : "No suggestions right now. Use the search bar to find people and colleges."}</p>
        )}
      </section>
    </aside>
  );
}

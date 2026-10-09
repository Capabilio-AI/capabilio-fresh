"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Hash, Newspaper, UserPlus } from "lucide-react";
import type { Suggestion, TrendingTag } from "@/lib/pulse/sidebar";
import type { NewsItem } from "@/lib/pulse/news";
import { GRAPH_CHANGED, onAnnounce } from "@/lib/pulse/live";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { MentorBadge } from "./MentorBadge";

interface SidebarData {
  trending: TrendingTag[];
  suggestions: Suggestion[];
}

const CARD = "rounded-2xl border border-[var(--m-rule)] bg-white p-5";

/** Right rail: people worth following (each with a reason), what is trending, and technical news for the student's own career. */
export function PulseSidebar() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [failed, setFailed] = useState(false);
  const [news, setNews] = useState<{ role: string | null; items: NewsItem[] } | null>(null);

  const loadSidebar = useCallback(() => {
    fetch("/api/pulse/sidebar")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((d: SidebarData) => { setData(d); setFailed(false); })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    loadSidebar();
    fetch("/api/pulse/news").then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad")))).then((d: { role: string | null; items: NewsItem[] }) => setNews(d)).catch(() => setNews({ role: null, items: [] }));
    // someone was followed or unfollowed anywhere on the page: the suggestions change, so re-read them
    return onAnnounce(GRAPH_CHANGED, loadSidebar);
  }, [loadSidebar]);

  return (
    <aside aria-label="Trending and suggestions" className="flex flex-col gap-4">
      <section className={CARD}>
        <h2 className="flex items-center gap-2 font-lp-display text-[15px] font-bold text-[var(--m-ink)]"><UserPlus size={15} className="text-app-orange" aria-hidden="true" /> People to follow</h2>
        {data === null && !failed ? <div className="mt-4 h-28 animate-pulse rounded-lg bg-app-background" /> : data && data.suggestions.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-4">
            {data.suggestions.map((p) => (
              <li key={p.id} className="flex items-start gap-3">
                <Link href={`/pulse/u/${p.id}`}><Avatar person={p} size="sm" /></Link>
                <div className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5"><Link href={`/pulse/u/${p.id}`} className="truncate font-lp-body text-[13px] font-semibold text-[var(--m-ink)] hover:underline">{p.name}</Link>{p.isMentor && <MentorBadge />}</span>
                  {p.tagline && <p className="truncate font-lp-body text-[12px] font-medium text-app-blue">{p.tagline}</p>}
                  <p className="truncate font-lp-body text-[11.5px] text-app-muted">{p.headline ?? p.reason}</p>
                  {p.headline && <p className="truncate font-lp-body text-[11px] text-app-muted/80">{p.reason}</p>}
                </div>
                <FollowButton userId={p.id} initialFollowing={false} compact />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-lp-body text-[12.5px] text-app-muted">{failed ? "Couldn't load suggestions." : "We suggest people from your college, your branch and your career area. Set your college and a career goal to see them. You can also use the search bar."}</p>
        )}
      </section>

      <section className={CARD}>
        <h2 className="flex items-center gap-2 font-lp-display text-[15px] font-bold text-[var(--m-ink)]"><Hash size={15} className="text-app-orange" aria-hidden="true" /> Trending this week</h2>
        {data === null && !failed ? <div className="mt-4 h-20 animate-pulse rounded-lg bg-app-background" /> : data && data.trending.length > 0 ? (
          <ul className="mt-3 flex flex-col">
            {data.trending.map((t) => (
              <li key={t.tag}>
                <Link href={`/pulse?tag=${t.tag}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-app-background">
                  <span className="font-lp-body text-[13.5px] font-medium text-[var(--m-ink)]">#{t.tag}</span>
                  <span className="font-lp-mono text-[11px] text-app-muted">{t.posts} {t.posts === 1 ? "post" : "posts"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-lp-body text-[12.5px] text-app-muted">{failed ? "Couldn't load trending tags." : "Tags people use in posts show up here. Try #projects or #internships."}</p>
        )}
      </section>

      <section className={CARD} aria-label="Technical news">
        <h2 className="flex items-center gap-2 font-lp-display text-[15px] font-bold text-[var(--m-ink)]"><Newspaper size={15} className="text-app-orange" aria-hidden="true" /> {news?.role ? `${news.role} news` : "Tech news"}</h2>
        {news === null ? <div className="mt-4 h-28 animate-pulse rounded-lg bg-app-background" /> : news.items.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-3">
            {news.items.map((n) => (
              <li key={n.id}>
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block rounded-lg px-2 py-1.5 hover:bg-app-background">
                  <span className="block font-lp-body text-[13px] font-semibold leading-snug text-[var(--m-ink)] group-hover:underline">{n.title}</span>
                  <span className="mt-0.5 block font-lp-mono text-[11px] text-app-muted">{n.source} · {n.points} points · {n.comments} comments</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-lp-body text-[12.5px] text-app-muted">{news.role ? "No big stories for your field right now. Check back soon." : "Choose a career direction and the latest technical news for it shows up here."}</p>
        )}
      </section>
    </aside>
  );
}

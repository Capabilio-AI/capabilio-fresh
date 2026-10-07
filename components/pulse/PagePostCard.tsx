"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CalendarDays, ExternalLink, Heart, MapPin, Megaphone } from "lucide-react";
import clsx from "clsx";
import type { PagePost } from "@/lib/pulse/data";
import { relativeTime } from "@/lib/pulse/format";

/** An announcement or event from a college page the person follows or belongs to. */
export function PagePostCard({ page, reason }: { page: PagePost; reason: string | null }) {
  const [liked, setLiked] = useState(page.likedByMe);
  const [count, setCount] = useState(page.likeCount);
  const isEvent = page.type === "event";

  async function toggle() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    const res = await fetch("/api/orgs/like", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: page.id, liked: next }) }).catch(() => null);
    if (!res?.ok) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-app-border bg-white">
      {page.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- college-supplied image, arbitrary origin
        <img src={page.coverImageUrl} alt="" loading="lazy" className="h-40 w-full object-cover" />
      )}
      <div className="p-5">
        {reason && <p className="mb-2 font-lp-body text-[11.5px] font-medium text-app-muted">{reason}</p>}
        <header className="flex items-center gap-3">
          <Link href={`/o/${page.orgSlug}`} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-app-orange-container text-app-orange" aria-label={page.orgName}>
            {page.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- college-supplied logo, arbitrary origin
              <img src={page.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Building2 size={18} aria-hidden="true" />
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/o/${page.orgSlug}`} className="block truncate font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">{page.orgName}</Link>
            <p className="font-lp-body text-[12px] text-app-muted">College page · {relativeTime(page.publishedAt)}</p>
          </div>
          <span className={clsx("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-lp-body text-[11px] font-semibold", isEvent ? "bg-app-blue-container text-app-blue" : "bg-app-orange-container text-app-orange")}>
            {isEvent ? <CalendarDays size={11} aria-hidden="true" /> : <Megaphone size={11} aria-hidden="true" />} {isEvent ? "Event" : "Announcement"}
          </span>
        </header>

        <h3 className="mt-3 font-lp-display text-[17px] font-semibold text-app-charcoal">{page.title}</h3>
        <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{page.body}</p>

        {isEvent && (page.eventStartsAt || page.eventLocation) && (
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-lp-body text-[12.5px] text-app-muted">
            {page.eventStartsAt && <li className="flex items-center gap-1.5"><CalendarDays size={12} aria-hidden="true" /> {new Date(page.eventStartsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</li>}
            {page.eventLocation && <li className="flex items-center gap-1.5"><MapPin size={12} aria-hidden="true" /> {page.eventLocation}</li>}
          </ul>
        )}

        <footer className="mt-4 flex items-center gap-4 border-t border-app-border pt-3">
          <button type="button" onClick={toggle} aria-pressed={liked} className={clsx("flex items-center gap-1.5 font-lp-body text-[13px]", liked ? "text-app-rose" : "text-app-muted hover:text-app-charcoal")}>
            <Heart size={16} className={liked ? "fill-current" : ""} aria-hidden="true" /> {count}<span className="sr-only"> likes</span>
          </button>
          <Link href={`/o/${page.orgSlug}`} className="ml-auto flex items-center gap-1 font-lp-body text-[12.5px] font-medium text-app-blue hover:underline">View page <ExternalLink size={11} aria-hidden="true" /></Link>
          {page.eventLink && /^https?:\/\//i.test(page.eventLink) && <a href={page.eventLink} target="_blank" rel="noopener noreferrer" className="rounded-full bg-app-charcoal px-4 py-1.5 font-lp-body text-[12px] font-semibold text-white">Event details</a>}
        </footer>
      </div>
    </article>
  );
}

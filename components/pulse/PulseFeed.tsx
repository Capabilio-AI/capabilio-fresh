"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import type { FeedItem, FeedPage, PulseComment, PulsePost } from "@/lib/pulse/data";
import type { PostKind } from "@/lib/pulse/format";
import type { AvatarPerson } from "./Avatar";
import { Composer } from "./Composer";
import { PagePostCard } from "./PagePostCard";
import { PostCard } from "./PostCard";
import { StoriesTray } from "./StoriesTray";

export type FeedView =
  | { mode: "for_you" }
  | { mode: "following" }
  | { mode: "tag"; tag: string }
  | { mode: "user"; userId: string; kind?: PostKind }
  | { mode: "trending" }
  | { mode: "mentors" }
  | { mode: "community"; slug: string; canPost: boolean; canModerate: boolean };

const EMPTY: Record<FeedView["mode"], { title: string; body: string }> = {
  for_you: { title: "Your feed is quiet", body: "It shows what the people you follow share. Follow classmates, mentors and people aiming for your career from the suggestions, or share what you're building." },
  following: { title: "Your following feed is empty", body: "Follow classmates, mentors and college pages. What they share shows up here, newest first." },
  trending: { title: "Nothing is trending yet", body: "When posts about your career area get likes and comments this week, they show up here." },
  tag: { title: "No posts with this tag yet", body: "Post something with the tag and it will appear here." },
  user: { title: "No posts yet", body: "When they share something, it shows up here." },
  mentors: { title: "No mentor posts yet", body: "When approved mentors share something, it shows up here." },
  community: { title: "No posts yet", body: "Start the conversation: share a question, a project or something you learned." },
};

const communityBase = (v: { slug: string }) => `/api/pulse/communities/${v.slug}/posts`;
/** Where likes, comments and deletes for a view's posts live. */
const endpointOf = (v: FeedView) => (v.mode === "community" ? communityBase(v) : "/api/pulse/posts");

const RANKED = new Set(["for_you", "following", "trending"]);

function query(view: FeedView, cursor: string | null): string {
  const p = new URLSearchParams({ mode: view.mode });
  if (view.mode === "tag") p.set("tag", view.tag);
  if (view.mode === "user") {
    p.set("userId", view.userId);
    if (view.kind) p.set("kind", view.kind);
  }
  // ranked views continue with an opaque cursor; chronological ones with the time of the last post
  if (cursor) p.set(RANKED.has(view.mode) ? "cursor" : "before", cursor);
  return p.toString();
}

function feedUrl(view: FeedView, before: string | null): string {
  if (view.mode === "community") return `${communityBase(view)}${before ? `?before=${encodeURIComponent(before)}` : ""}`;
  return `/api/pulse/posts?${query(view, before)}`;
}

/** The feed for one view (For You, Following, a #tag, mentors, a community, or one person), with stories and the composer where they belong. */
import { GRAPH_CHANGED, POSTED, announce, onAnnounce } from "@/lib/pulse/live";

const POLL_MS = 60_000;
const itemId = (it: FeedItem | undefined) => (it ? (it.type === "post" ? it.post.id : it.page.id) : null);

export function PulseFeed({ view, viewer }: { view: FeedView; viewer: { id: string } & AvatarPerson }) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const home = view.mode === "for_you" || view.mode === "following";
  const posts = items;
  const key = JSON.stringify(view);

  const router = useRouter();
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  const [fresh, setFresh] = useState<(FeedPage & { role?: string | null }) | null>(null);
  const topId = useRef<string | null>(null);
  useEffect(() => { topId.current = itemId(items?.[0]); }, [items]);

  // a follow or unfollow anywhere on the page changes whose posts belong here
  useEffect(() => onAnnounce(GRAPH_CHANGED, load), [load]);
  // your own new post: show it, and update the counts on your profile card
  const posted = useCallback(() => { setFresh(null); load(); announce(POSTED); router.refresh(); }, [load, router]);

  // look for newer posts every minute and whenever you return to the tab; offer them rather than shuffling the list under your thumb
  useEffect(() => {
    const k = JSON.parse(key) as FeedView;
    if (k.mode === "tag" || k.mode === "user") return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(feedUrl(k, null));
        if (!res.ok) return;
        const data = (await res.json()) as FeedPage & { role?: string | null };
        if (topId.current !== null && itemId(data.items[0]) !== null && itemId(data.items[0]) !== topId.current) setFresh(data);
      } catch { /* a missed check is retried on the next tick */ }
    };
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [key]);
  useEffect(() => {
    let live = true;
    fetch(feedUrl(JSON.parse(key) as FeedView, null))
      .then((res) => (res.ok ? (res.json() as Promise<FeedPage & { role?: string | null }>) : Promise.reject(new Error("bad"))))
      .then((data) => {
        if (!live) return;
        setError(null);
        setFresh(null);
        setItems(data.items);
        setRole(data.role ?? null);
        setCursor(data.nextCursor);
      })
      .catch(() => {
        if (!live) return;
        setError("Couldn't load the feed.");
        setItems((p) => p ?? []);
      });
    return () => {
      live = false;
    };
  }, [key, tick]);

  async function more() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(feedUrl(view, cursor));
      if (!res.ok) throw new Error("bad");
      const data = (await res.json()) as FeedPage;
      setItems((p) => [...(p ?? []), ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      setError("Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  const patch = (id: string, fn: (p: PulsePost) => PulsePost) => setItems((its) => (its ?? []).map((it) => (it.type === "post" && it.post.id === id ? { ...it, post: fn(it.post) } : it)));
  function toggleLike(id: string) {
    const flip = (p: PulsePost): PulsePost => ({ ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) });
    patch(id, flip);
    void fetch(`${endpointOf(view)}/${id}/like`, { method: "POST" })
      .then((r) => {
        if (!r.ok) patch(id, flip);
      })
      .catch(() => patch(id, flip));
  }

  return (
    <div className="flex flex-col gap-4">
      {fresh && (
        <button type="button" onClick={() => { setItems(fresh.items); setCursor(fresh.nextCursor); setRole(fresh.role ?? null); setFresh(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="sticky top-28 z-10 mx-auto rounded-full bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[13px] font-bold text-white shadow-lg">New posts · tap to show</button>
      )}
      {view.mode === "tag" && (
        <div className="flex items-center justify-between rounded-2xl border border-[var(--m-rule)] bg-white px-5 py-3">
          <p className="font-lp-body text-[14px] text-[var(--m-ink)]">Posts tagged <span className="font-semibold text-app-blue">#{view.tag}</span></p>
          <Link href="/pulse" aria-label="Clear tag" className="rounded-full p-1.5 text-app-muted hover:bg-app-background"><X size={15} /></Link>
        </div>
      )}
      {view.mode === "trending" && (
        <div className="rounded-2xl border border-[var(--m-rule)] bg-white px-5 py-4">
          <p className="font-lp-display text-[15px] font-bold text-[var(--m-ink)]">Trending this week{role ? ` for ${role}` : ""}</p>
          <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{role ? "The most-discussed posts from the last 7 days, with the ones about your career goal first." : "The most-discussed posts from the last 7 days. Set a career goal in your dashboard to see the ones that fit it."}</p>
        </div>
      )}
      {home && <StoriesTray me={viewer} />}
      {home && <Composer me={viewer} onPosted={posted} />}
      {view.mode === "community" && view.canPost && <Composer me={viewer} onPosted={load} endpoint={communityBase(view)} placeholder="Start a conversation in this community…" />}
      {view.mode === "community" && !view.canPost && <p className="rounded-2xl border border-dashed border-[var(--m-rule)] bg-white px-5 py-3 text-center font-lp-body text-[12.5px] text-app-muted">Join this community to post.</p>}

      {posts === null ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-app-orange" aria-label="Loading" /></div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--m-rule)] bg-white px-6 py-12 text-center">
          <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{EMPTY[view.mode].title}</p>
          <p className="mx-auto mt-1 max-w-sm font-lp-body text-[13px] text-app-muted">{EMPTY[view.mode].body}</p>
        </div>
      ) : (
        posts.map((it) =>
          it.type === "page" ? (
            <PagePostCard key={`g-${it.page.id}`} page={it.page} reason={it.reason} />
          ) : (
            <PostCard
              key={it.post.id}
              post={it.post}
              viewerId={viewer.id}
              apiBase={endpointOf(view)}
              reportType={view.mode === "community" ? "community_post" : "post"}
              canDelete={view.mode === "community" && (it.post.author.id === viewer.id || view.canModerate)}
              onDeleted={(id) => setItems((its) => (its ?? []).filter((x) => !(x.type === "post" && x.post.id === id)))}
              onToggleLike={() => toggleLike(it.post.id)}
              onComment={(c: PulseComment) => patch(it.post.id, (p) => ({ ...p, comments: [...p.comments, c] }))}
              onHideAuthor={(id) => setItems((its) => (its ?? []).filter((x) => !(x.type === "post" && x.post.author.id === id)))}
            />
          )
        )
      )}
      {error && <p role="alert" className="text-center font-lp-body text-[12.5px] text-app-rose">{error} <button type="button" onClick={load} className="underline">Retry</button></p>}
      {cursor && <button type="button" onClick={more} disabled={loadingMore} className="mx-auto flex items-center gap-2 rounded-full border border-[var(--m-rule)] bg-white px-5 py-2 font-lp-body text-[13px] font-medium text-[var(--m-ink)] hover:bg-app-background disabled:opacity-60">{loadingMore && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Load more</button>}
    </div>
  );
}

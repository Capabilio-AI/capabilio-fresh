"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import type { FeedPage, PulseComment, PulsePost } from "@/lib/pulse/data";
import type { AvatarPerson } from "./Avatar";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { StoriesTray } from "./StoriesTray";

export type FeedView =
  | { mode: "for_you" }
  | { mode: "following" }
  | { mode: "tag"; tag: string }
  | { mode: "user"; userId: string }
  | { mode: "mentors" }
  | { mode: "community"; slug: string; canPost: boolean; canModerate: boolean };

const EMPTY: Record<FeedView["mode"], { title: string; body: string }> = {
  for_you: { title: "Nothing here yet", body: "Be the first to share what you're building." },
  following: { title: "Your following feed is empty", body: "Follow classmates, mentors and people from your college. Their posts show up here, newest first." },
  tag: { title: "No posts with this tag yet", body: "Post something with the tag and it will appear here." },
  user: { title: "No posts yet", body: "When they share something, it shows up here." },
  mentors: { title: "No mentor posts yet", body: "When approved mentors share something, it shows up here." },
  community: { title: "No posts yet", body: "Start the conversation: share a question, a project or something you learned." },
};

const communityBase = (v: { slug: string }) => `/api/pulse/communities/${v.slug}/posts`;
/** Where likes, comments and deletes for a view's posts live. */
const endpointOf = (v: FeedView) => (v.mode === "community" ? communityBase(v) : "/api/pulse/posts");

function query(view: FeedView, before: string | null): string {
  const p = new URLSearchParams({ mode: view.mode });
  if (view.mode === "tag") p.set("tag", view.tag);
  if (view.mode === "user") p.set("userId", view.userId);
  if (before) p.set("before", before);
  return p.toString();
}

function feedUrl(view: FeedView, before: string | null): string {
  if (view.mode === "community") return `${communityBase(view)}${before ? `?before=${encodeURIComponent(before)}` : ""}`;
  return `/api/pulse/posts?${query(view, before)}`;
}

/** The feed for one view (For You, Following, a #tag, mentors, a community, or one person), with stories and the composer where they belong. */
export function PulseFeed({ view, viewer }: { view: FeedView; viewer: { id: string } & AvatarPerson }) {
  const [posts, setPosts] = useState<PulsePost[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const home = view.mode === "for_you" || view.mode === "following";
  const key = JSON.stringify(view);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    fetch(feedUrl(JSON.parse(key) as FeedView, null))
      .then((res) => (res.ok ? (res.json() as Promise<FeedPage>) : Promise.reject(new Error("bad"))))
      .then((data) => {
        if (!live) return;
        setError(null);
        setPosts(data.posts);
        setCursor(data.nextCursor);
      })
      .catch(() => {
        if (!live) return;
        setError("Couldn't load the feed.");
        setPosts((p) => p ?? []);
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
      setPosts((p) => [...(p ?? []), ...data.posts]);
      setCursor(data.nextCursor);
    } catch {
      setError("Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  const patch = (id: string, fn: (p: PulsePost) => PulsePost) => setPosts((ps) => (ps ?? []).map((p) => (p.id === id ? fn(p) : p)));
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
      {view.mode === "tag" && (
        <div className="flex items-center justify-between rounded-2xl border border-app-border bg-white px-5 py-3">
          <p className="font-lp-body text-[14px] text-app-charcoal">Posts tagged <span className="font-semibold text-app-blue">#{view.tag}</span></p>
          <Link href="/pulse" aria-label="Clear tag" className="rounded-full p-1.5 text-app-muted hover:bg-app-background"><X size={15} /></Link>
        </div>
      )}
      {home && <StoriesTray me={viewer} />}
      {home && <Composer me={viewer} onPosted={load} />}
      {view.mode === "community" && view.canPost && <Composer me={viewer} onPosted={load} endpoint={communityBase(view)} placeholder="Start a conversation in this community…" />}
      {view.mode === "community" && !view.canPost && <p className="rounded-2xl border border-dashed border-app-border bg-white px-5 py-3 text-center font-lp-body text-[12.5px] text-app-muted">Join this community to post.</p>}

      {posts === null ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-app-orange" aria-label="Loading" /></div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-app-border bg-white px-6 py-12 text-center">
          <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{EMPTY[view.mode].title}</p>
          <p className="mx-auto mt-1 max-w-sm font-lp-body text-[13px] text-app-muted">{EMPTY[view.mode].body}</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            viewerId={viewer.id}
            apiBase={endpointOf(view)}
            reportType={view.mode === "community" ? "community_post" : "post"}
            canDelete={view.mode === "community" && (post.author.id === viewer.id || view.canModerate)}
            onDeleted={(id) => setPosts((ps) => (ps ?? []).filter((p) => p.id !== id))}
            onToggleLike={() => toggleLike(post.id)}
            onComment={(c: PulseComment) => patch(post.id, (p) => ({ ...p, comments: [...p.comments, c] }))}
            onHideAuthor={(id) => setPosts((ps) => (ps ?? []).filter((p) => p.author.id !== id))}
          />
        ))
      )}
      {error && <p role="alert" className="text-center font-lp-body text-[12.5px] text-app-rose">{error} <button type="button" onClick={load} className="underline">Retry</button></p>}
      {cursor && <button type="button" onClick={more} disabled={loadingMore} className="mx-auto flex items-center gap-2 rounded-full border border-app-border bg-white px-5 py-2 font-lp-body text-[13px] font-medium text-app-charcoal hover:bg-app-background disabled:opacity-60">{loadingMore && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Load more</button>}
    </div>
  );
}

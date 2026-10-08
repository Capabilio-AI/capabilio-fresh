"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { StoryGroup } from "@/lib/pulse/stories";
import { Avatar } from "./Avatar";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";

/** The row of story rings above the feed: add your own, watch the people you follow. */
export function StoriesTray({ me }: { me: { name: string | null; avatarUrl: string | null } }) {
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    fetch("/api/pulse/stories")
      .then((res) => (res.ok ? (res.json() as Promise<{ groups: StoryGroup[] }>) : Promise.reject(new Error("bad"))))
      .then((data) => {
        if (!live) return;
        setGroups(data.groups);
        setFailed(false);
      })
      .catch(() => {
        if (!live) return;
        setFailed(true);
        setGroups((g) => g ?? []);
      });
    return () => {
      live = false;
    };
  }, [tick]);

  const mine = groups?.findIndex((g) => g.isMe) ?? -1;

  function markViewed(storyId: string) {
    setGroups((gs) => (gs ?? []).map((g) => {
      const stories = g.stories.map((s) => (s.id === storyId ? { ...s, viewed: true } : s));
      return { ...g, stories, hasUnviewed: stories.some((s) => !s.viewed) };
    }));
  }
  function removeStory(storyId: string) {
    setGroups((gs) => (gs ?? []).map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== storyId) })).filter((g) => g.stories.length > 0));
  }

  return (
    <section aria-label="Stories" className="rounded-2xl border border-[var(--m-rule)] bg-white p-4">
      <ul className="flex gap-4 overflow-x-auto pb-1">
        <li className="relative shrink-0">
          <button type="button" onClick={() => (mine >= 0 ? setOpen(mine) : setComposing(true))} className="flex w-[68px] flex-col items-center gap-1.5 focus-visible:outline-none">
            <Avatar person={me} size="lg" ring={mine >= 0 ? "seen" : "none"} />
            <span className="w-full truncate text-center font-lp-body text-[11.5px] text-[var(--m-ink)]">Your story</span>
          </button>
          <button type="button" aria-label="Add to your story" onClick={() => setComposing(true)} className="absolute right-0 top-[48px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-app-orange text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-orange/40"><Plus size={13} aria-hidden="true" /></button>
        </li>
        {groups?.map((g, i) => g.isMe ? null : (
          <li key={g.user.id} className="shrink-0">
            <button type="button" onClick={() => setOpen(i)} className="flex w-[68px] flex-col items-center gap-1.5 focus-visible:outline-none">
              <Avatar person={g.user} size="lg" ring={g.hasUnviewed ? "unseen" : "seen"} />
              <span className="w-full truncate text-center font-lp-body text-[11.5px] text-[var(--m-ink)]">{g.user.name?.split(" ")[0] ?? "Someone"}</span>
            </button>
          </li>
        ))}
        {groups !== null && groups.every((g) => g.isMe) && <li className="flex min-w-[200px] items-center font-lp-body text-[12.5px] text-app-muted">Follow people to see their 24-hour stories here.</li>}
      </ul>
      {failed && <p role="alert" className="mt-2 font-lp-body text-[12px] text-app-rose">Couldn&apos;t load stories. <button type="button" onClick={load} className="underline">Retry</button></p>}
      {open !== null && groups && <StoryViewer groups={groups} startAt={open} onClose={() => setOpen(null)} onViewed={markViewed} onDeleted={removeStory} />}
      {composing && <StoryComposer onClose={() => setComposing(false)} onShared={load} />}
    </section>
  );
}

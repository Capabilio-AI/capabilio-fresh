"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Flag, Trash2, X } from "lucide-react";
import type { StoryGroup } from "@/lib/pulse/stories";
import { hoursLeft, relativeTime } from "@/lib/pulse/format";
import { themeBackground, themeInk } from "@/lib/pulse/themes";
import { Avatar } from "./Avatar";
import { ReportDialog } from "./ReportDialog";

const STORY_MS = 6000;
interface Viewer { id: string; name: string | null; avatarUrl: string | null; headline: string | null; viewedAt: string }

/** Full-screen story player: tap right/left or use the arrow keys, hold to pause, Esc to close. Plays through everyone in the tray. */
export function StoryViewer({ groups, startAt, onClose, onViewed, onDeleted }: { groups: StoryGroup[]; startAt: number; onClose: () => void; onViewed: (storyId: string) => void; onDeleted: (storyId: string) => void }) {
  const [g, setG] = useState(startAt);
  const [s, setS] = useState(() => Math.max(0, groups[startAt]?.stories.findIndex((x) => !x.viewed) ?? 0));
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [reporting, setReporting] = useState(false);
  const group = groups[g];
  const story = group?.stories[s];
  const paused = held || viewers !== null || reporting;
  const startedFor = useRef<string | null>(null);

  const next = useCallback(() => {
    if (!group) return onClose();
    if (s < group.stories.length - 1) return setS(s + 1);
    if (g < groups.length - 1) {
      setG(g + 1);
      return setS(0);
    }
    onClose();
  }, [g, s, group, groups.length, onClose]);
  const prev = useCallback(() => {
    if (s > 0) return setS(s - 1);
    if (g > 0) {
      setG(g - 1);
      setS(0);
    }
  }, [g, s]);

  // each new story: reset the bar, tell the server it was seen
  useEffect(() => {
    if (!story || startedFor.current === story.id) return;
    startedFor.current = story.id;
    setProgress(0);
    setViewers(null);
    if (!group.isMe && !story.viewed) {
      onViewed(story.id);
      void fetch(`/api/pulse/stories/${story.id}/view`, { method: "POST" });
    }
  }, [story, group, onViewed]);

  useEffect(() => {
    if (!story || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const np = p + dt / STORY_MS;
        if (np >= 1) {
          queueMicrotask(next);
          return 1;
        }
        return np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story, paused, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  if (!group || !story) return null;

  async function showViewers() {
    const res = await fetch(`/api/pulse/stories/${story.id}/viewers`);
    const json = (await res.json().catch(() => null)) as { viewers?: Viewer[] } | null;
    setViewers(json?.viewers ?? []);
  }
  async function remove() {
    const res = await fetch(`/api/pulse/stories/${story.id}`, { method: "DELETE" });
    if (!res.ok) return;
    onDeleted(story.id);
    next();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" role="dialog" aria-modal="true" aria-label={`${group.user.name ?? "Story"}'s story`}>
      <button type="button" onClick={onClose} aria-label="Close stories" className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/80 hover:bg-white/10"><X size={22} /></button>
      <div className="relative flex h-full max-h-[760px] w-full max-w-[420px] flex-col overflow-hidden bg-black sm:rounded-2xl">
        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-3" aria-hidden="true">
          {group.stories.map((x, i) => (
            <span key={x.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full bg-white" style={{ width: `${i < s ? 100 : i === s ? Math.min(100, progress * 100) : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="absolute inset-x-0 top-5 z-10 flex items-center gap-2.5 px-4 pt-3 text-white">
          <Avatar person={group.user} size="sm" />
          <div className="min-w-0 flex-1">
            <Link href={`/pulse/u/${group.user.id}`} onClick={onClose} className="block truncate font-lp-body text-[13px] font-semibold hover:underline">{group.isMe ? "Your story" : (group.user.name ?? "Someone")}</Link>
            <p className="font-lp-mono text-[10.5px] text-white/70">{relativeTime(story.createdAt)} · {hoursLeft(story.expiresAt)}h left</p>
          </div>
          {group.isMe ? (
            <button type="button" onClick={remove} aria-label="Delete this story" className="rounded-full p-2 text-white/80 hover:bg-white/10"><Trash2 size={16} /></button>
          ) : (
            <button type="button" onClick={() => setReporting(true)} aria-label="Report this story" className="rounded-full p-2 text-white/80 hover:bg-white/10"><Flag size={16} /></button>
          )}
        </div>

        <div
          className="flex flex-1 select-none items-center justify-center"
          style={{ background: story.kind === "text" ? themeBackground(story.theme) : "#000" }}
          onPointerDown={() => setHeld(true)}
          onPointerUp={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
        >
          {story.kind === "image" && story.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
            <img src={story.imageUrl} alt={story.body ?? "Story photo"} className="max-h-full max-w-full object-contain" draggable={false} />
          ) : story.kind === "text" ? (
            <p className="px-8 text-center font-lp-display text-[26px] font-bold leading-snug" style={{ color: themeInk(story.theme) }}>{story.body}</p>
          ) : (
            <p className="px-8 text-center font-lp-body text-[13px] text-white/70">This photo is no longer available.</p>
          )}
          <button type="button" aria-label="Previous story" onClick={prev} className="absolute inset-y-16 left-0 w-1/3 cursor-w-resize focus-visible:outline-none" />
          <button type="button" aria-label="Next story" onClick={next} className="absolute inset-y-16 right-0 w-1/3 cursor-e-resize focus-visible:outline-none" />
        </div>
        {story.kind === "image" && story.body && <p className="absolute inset-x-0 bottom-14 z-10 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-8 text-center font-lp-body text-[14px] text-white">{story.body}</p>}
        {group.isMe && (
          <button type="button" onClick={showViewers} className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 bg-black/60 py-3 font-lp-body text-[13px] text-white hover:bg-black/70"><Eye size={14} aria-hidden="true" /> Who viewed this</button>
        )}

        {viewers !== null && (
          <div className="absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-2xl bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-lp-display text-[15px] font-bold text-[var(--m-ink)]">{viewers.length} {viewers.length === 1 ? "view" : "views"}</h3>
              <button type="button" onClick={() => setViewers(null)} aria-label="Close viewers" className="rounded-full p-1.5 text-app-muted hover:bg-app-background"><X size={16} /></button>
            </div>
            {viewers.length === 0 ? <p className="mt-3 font-lp-body text-[13px] text-app-muted">No one has seen this yet.</p> : (
              <ul className="mt-3 flex flex-col gap-3">
                {viewers.map((v) => (
                  <li key={v.id} className="flex items-center gap-2.5">
                    <Avatar person={v} size="sm" />
                    <div className="min-w-0"><p className="truncate font-lp-body text-[13px] font-medium text-[var(--m-ink)]">{v.name ?? "Someone"}</p><p className="truncate font-lp-mono text-[10.5px] text-app-muted">{v.headline ?? ""}</p></div>
                    <span className="ml-auto shrink-0 font-lp-mono text-[10.5px] text-app-muted">{relativeTime(v.viewedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {reporting && <ReportDialog targetType="story" targetId={story.id} onClose={() => setReporting(false)} />}
    </div>
  );
}

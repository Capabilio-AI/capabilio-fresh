"use client";

import { Suspense, useRef, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookText, Loader2, MessagesSquare, PlayCircle, RotateCw } from "lucide-react";
import clsx from "clsx";
import { useLessonContent, type LessonState } from "./useLessonContent";
import { TheoryView } from "./TheoryView";
import { CheckYourself } from "./CheckYourself";
import { LessonTutor } from "./LessonTutor";
import type { LessonKind } from "@/lib/skillstudio/lesson-content";

// The player and Remotion are heavy, so they load only when someone opens Watch.
const ExplainerPlayer = dynamic(() => import("./ExplainerPlayer"), { ssr: false, loading: () => <Preparing what="the player" /> });

const TABS = [
  { id: "read", label: "Read", icon: BookText },
  { id: "watch", label: "Watch", icon: PlayCircle },
  { id: "ask", label: "Ask your tutor", icon: MessagesSquare },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Preparing({ what }: { what: string }) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-6">
      <p className="flex items-center gap-2 text-[15px] font-bold text-[var(--m-ink)]"><Loader2 size={16} aria-hidden className="animate-spin motion-reduce:animate-none" />Preparing {what}</p>
      <p className="text-[14px] text-[var(--m-muted)]">The first time a lesson is opened it can take 15 to 30 seconds to write. After that it opens straight away.</p>
      {[90, 72, 84].map((w, i) => <span key={i} className="h-3.5 animate-pulse rounded-full bg-[var(--m-rule)] motion-reduce:animate-none" style={{ width: `${w}%` }} />)}
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-6">
      <p className="text-[15px] font-bold text-red-600">{message}</p>
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-4 py-2 text-[13.5px] font-bold text-white"><RotateCw size={14} aria-hidden />Try again</button>
    </div>
  );
}

function Panel<K extends LessonKind>({ state, retry, what, children }: { state: LessonState<K>; retry: () => void; what: string; children: (lesson: Extract<LessonState<K>, { s: "ready" }>["lesson"]) => React.ReactNode }) {
  if (state.s === "error") return <Failed message={state.message} onRetry={retry} />;
  if (state.s !== "ready") return <Preparing what={what} />;
  return <>{children(state.lesson)}</>;
}

function Learn({ nodeKey, title }: { nodeKey: string; title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const asked = params.get("learn");
  const tab: Tab = TABS.some((t) => t.id === asked) ? (asked as Tab) : "read";
  const theory = useLessonContent(nodeKey, "theory", tab === "read");
  const video = useLessonContent(nodeKey, "video", tab === "watch");
  const list = useRef<HTMLDivElement>(null);

  const select = (next: Tab) => {
    const q = new URLSearchParams(params.toString());
    q.set("learn", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i + TABS.length - 1) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    select(TABS[next].id);
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <section aria-label="Learn this lesson" className="flex flex-col gap-4">
      <div ref={list} role="tablist" aria-label="How do you want to learn this?" onKeyDown={onKey} className="glass inline-flex w-full gap-0.5 rounded-full p-1 sm:w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button key={t.id} id={`learn-tab-${t.id}`} role="tab" type="button" aria-selected={on} aria-controls={`learn-panel-${t.id}`} tabIndex={on ? 0 : -1} onClick={() => select(t.id)}
              className={clsx("flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-bold transition-[background-color,color] duration-200 motion-reduce:transition-none sm:flex-none sm:px-5", on ? "glass-thumb text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:bg-white/60 hover:text-[var(--m-ink)]")}>
              <Icon size={16} aria-hidden className={on ? "text-[var(--m-accent)]" : ""} />{t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`learn-panel-${tab}`} aria-labelledby={`learn-tab-${tab}`} tabIndex={0}>
        {tab === "read" && <Panel state={theory.state} retry={theory.retry} what="your written lesson">{(l) => <TheoryView lesson={l} />}</Panel>}
        {tab === "watch" && (
          <Panel state={video.state} retry={video.retry} what="your explainer video">
            {(l) => (
              <div className="flex flex-col gap-5">
                <ExplainerPlayer script={l} />
                <CheckYourself id="video-check" questions={l.check} />
              </div>
            )}
          </Panel>
        )}
        {tab === "ask" && <LessonTutor nodeKey={nodeKey} title={title} />}
      </div>
      <p className="text-[12.5px] text-[var(--m-muted)]">Lessons and videos are written by AI from the topic and can contain mistakes. Check anything important against the resources below.</p>
    </section>
  );
}

/** Three ways into one lesson: read it, watch it, or ask about it. The tab lives in the URL, so a link opens on the same one. */
export function LessonLearn(props: { nodeKey: string; title: string }) {
  return (
    <Suspense fallback={<Preparing what="this lesson" />}>
      <Learn {...props} />
    </Suspense>
  );
}

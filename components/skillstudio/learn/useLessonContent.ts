"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { send } from "@/components/roadmap/v2/api";
import type { LessonKind, TheoryLesson, VideoScript } from "@/lib/skillstudio/lesson-content";

type Content<K extends LessonKind> = K extends "theory" ? TheoryLesson : VideoScript;
export type LessonState<K extends LessonKind> = { s: "idle" } | { s: "loading" } | { s: "error"; message: string } | { s: "ready"; lesson: Content<K> };

const KEY = (nodeKey: string, kind: LessonKind) => `ss:lesson:v1:${nodeKey}:${kind}`;

// A reopened lesson should not wait on the model again, so what was made is kept in this browser. Storage can be blocked, so it is optional.
const read = (k: string): unknown => {
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the lesson still shows */
  }
};

/** Loads a lesson the first time its tab is opened (`active`), from this browser if it was seen before, else from the server. */
export function useLessonContent<K extends LessonKind>(nodeKey: string, kind: K, active: boolean) {
  const [state, setState] = useState<LessonState<K>>({ s: "idle" });
  const started = useRef(false);

  /** `fresh` skips what this browser remembers (a retry after a failure must really ask again). */
  const load = useCallback(async (fresh = false) => {
    const saved = fresh ? null : (read(KEY(nodeKey, kind)) as Content<K> | null);
    if (saved) return setState({ s: "ready", lesson: saved });
    setState({ s: "loading" });
    const r = await send("POST", "/api/skillstudio/lesson", { nodeKey, kind });
    if (!r.ok) return setState({ s: "error", message: r.error ?? "We couldn't prepare this lesson." });
    const lesson = (r.data as { lesson: Content<K> }).lesson;
    write(KEY(nodeKey, kind), lesson);
    setState({ s: "ready", lesson });
  }, [nodeKey, kind]);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    void load();
  }, [active, load]);

  return { state, retry: () => load(true) };
}

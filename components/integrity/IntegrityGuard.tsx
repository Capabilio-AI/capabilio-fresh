"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import type { IntegrityArea, IntegrityCounts, IntegrityKind } from "@/lib/integrity/kinds";

const SHOT_HIDE_MS = 4000;
const NOTICE_MS = 2500;
const FLUSH_MS = 20_000;

/**
 * Keeps a student's work their own on the pages it wraps: copy, cut, paste, right-click and drag are off, text cannot be selected outside
 * the fields they type in, and the page blurs while a screenshot shortcut is held or the window is not in focus. A browser cannot stop
 * a phone camera or a screenshot taken by the operating system, so this raises the cost of copying; it is not a lock.
 */
export function IntegrityGuard({ area, children }: { area: IntegrityArea; children: ReactNode }) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const pending = useRef<IntegrityCounts>({});
  const root = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const [shot, setShot] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const shotTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const count = useCallback((kind: IntegrityKind) => {
    pending.current = { ...pending.current, [kind]: Math.min(500, (pending.current[kind] ?? 0) + 1) };
  }, []);

  /** Sends what has been counted since the last send. sendBeacon survives the page closing; a failed send only loses the count. */
  const flush = useCallback(() => {
    const counts = pending.current;
    if (Object.keys(counts).length === 0) return;
    pending.current = {};
    const body = JSON.stringify({ area, path: pathRef.current.slice(0, 200), counts });
    if (!navigator.sendBeacon?.("/api/integrity/events", new Blob([body], { type: "application/json" }))) {
      fetch("/api/integrity/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    }
  }, [area]);

  const say = useCallback((message: string) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const hideForShot = useCallback(() => {
    count("screenshot");
    setShot(true);
    clearTimeout(shotTimer.current);
    shotTimer.current = setTimeout(() => setShot(false), SHOT_HIDE_MS);
    // a PrintScreen capture lands on the clipboard, so replace it with nothing
    navigator.clipboard?.writeText("").catch(() => undefined);
  }, [count]);

  useEffect(() => {
    const inside = (e: Event) => e.target instanceof Node && Boolean(root.current?.contains(e.target));
    const block = (what: string, kind: IntegrityKind) => (e: Event) => {
      if (!inside(e)) return;
      e.preventDefault();
      count(kind);
      say(`${what} is turned off here so the work you submit is your own.`);
    };
    const onCopy = block("Copying", "copy");
    const onCut = block("Cutting", "cut");
    const onPaste = block("Pasting", "paste");
    const onMenu = (e: Event) => inside(e) && e.preventDefault();
    const onDrag = (e: Event) => inside(e) && e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      // the operating system screenshot shortcuts hold Cmd or Win with Shift, and may swallow the last key, so react to the modifiers
      if (e.key === "PrintScreen" || (e.metaKey && e.shiftKey)) hideForShot();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        count("print");
        say("Printing is turned off here.");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => e.key === "PrintScreen" && hideForShot();
    const onBlur = () => {
      count("blur");
      setAway(true);
    };
    const onFocus = () => setAway(false);
    const onVisibility = () => setAway(document.visibilityState === "hidden");

    const pairs: [string, EventListener][] = [["copy", onCopy], ["cut", onCut], ["paste", onPaste], ["contextmenu", onMenu], ["dragstart", onDrag]];
    for (const [name, fn] of pairs) document.addEventListener(name, fn, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(flush, FLUSH_MS);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", flush);
      flush();
      for (const [name, fn] of pairs) document.removeEventListener(name, fn, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(shotTimer.current);
      clearTimeout(noticeTimer.current);
    };
  }, [say, hideForShot, count, flush]);

  const hidden = away || shot;
  return (
    <>
      <div
        ref={root}
        className={clsx("select-none print:hidden [&_input]:select-text [&_textarea]:select-text [&_img]:pointer-events-none", hidden && "pointer-events-none blur-2xl")}
        aria-hidden={hidden || undefined}
      >
        {children}
      </div>
      {hidden && (
        <div role="status" className="fixed inset-0 z-50 flex items-center justify-center p-6 text-center">
          <p className="flex max-w-sm items-center gap-2 rounded-2xl bg-[var(--m-ink)] px-5 py-4 text-[15px] font-bold text-white">
            <ShieldAlert size={18} aria-hidden className="shrink-0" />
            {shot ? "Screenshots are not allowed on this page." : "Content is hidden while this window is not in focus."}
          </p>
        </div>
      )}
      {notice && !hidden && (
        <p role="status" className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-center text-[14px] font-bold text-white shadow-lg">{notice}</p>
      )}
    </>
  );
}

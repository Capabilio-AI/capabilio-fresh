"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, Maximize, ShieldAlert, TriangleAlert } from "lucide-react";
import { DEFAULT_POLICY, applyViolation, blockedKey, initialExamState, isDuplicateSwitch, noticeFor, parseStrikes, type ExamPolicy, type ExamState, type Violation, type ViolationNotice } from "@/lib/integrity/exam-rules";
import type { IntegrityArea, IntegrityCounts, IntegrityKind } from "@/lib/integrity/kinds";

export interface ExamLockApi {
  /** set when the lock ended the test for too many strikes: the page must now submit what is answered and call release() */
  terminated: Violation | null;
  fullscreenExits: number;
  tabSwitches: number;
  /** lets the student go: leaves fullscreen and stops guarding. Call it when the test is submitted or ended. */
  release: () => void;
}
const Ctx = createContext<ExamLockApi | null>(null);
/** The lock around the current exam, or null on a page that is not locked. */
export const useExamLock = (): ExamLockApi | null => useContext(Ctx);

export const DEFAULT_RULES = [
  "The test opens in full screen and stays there until you submit or end it.",
  "Leaving full screen is recorded. Three exits end your test and submit what you have answered.",
  "Switching to another tab or window is recorded too, and three switches end your test.",
  "Copying, pasting, right-click, printing and developer tools are switched off.",
  "You cannot go back to other pages during the test. Close nothing: your answers are only saved as you go.",
];
const FLUSH_MS = 15_000;
const TOAST_MS = 2600;
const FALLBACK_RELEASE_MS = 20_000;

type Phase = "gate" | "running" | "released";
type FullscreenCapable = { requestFullscreen?: (o?: FullscreenOptions) => Promise<void> };
type KeyboardLockable = { keyboard?: { lock?: (keys: string[]) => Promise<void>; unlock?: () => void } };

/**
 * Takes over the tab for a timed test, the way a public exam does. A start screen explains the rules; the test then runs in full screen. Leaving
 * full screen or switching tabs is a strike with an alert (1 of 3, 2 of 3), the third ends the test, and everything is reported to the college. Copy,
 * paste, right-click, print and developer-tools shortcuts are blocked, the back button and closing the tab are held, and Esc needs a long press
 * where the browser allows it. A browser cannot be locked completely (a second device, a phone camera), so this makes cheating costly and visible.
 */
const readStrikes = (key: string | null): ExamState => {
  if (!key) return initialExamState;
  try { return parseStrikes(window.sessionStorage.getItem(key)); } catch { return initialExamState; }
};

export function ExamLock({ area, title, rules = DEFAULT_RULES, policy = DEFAULT_POLICY, storageKey, onCancel, children }: { area: IntegrityArea; title: string; rules?: string[]; policy?: ExamPolicy; /** identifies this attempt, so strikes survive a refresh and a reload cannot reset them */ storageKey?: string; onCancel?: () => void; children: ReactNode }) {
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const key = storageKey ? `examlock:${storageKey}` : null;
  // strikes survive a refresh; a test that was already ended skips the rules screen so the page can submit it at once
  const [exam, setExam] = useState<ExamState>(() => readStrikes(key));
  const [phase, setPhase] = useState<Phase>(() => (readStrikes(key).terminated ? "running" : "gate"));
  const [agreed, setAgreed] = useState(false);
  const [notice, setNotice] = useState<ViolationNotice | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fullscreenSupported] = useState(() => typeof document !== "undefined" && Boolean(document.fullscreenEnabled));

  const state = useRef(exam);
  const usedFullscreen = useRef(false);
  const releasing = useRef(false);
  const lastExitAt = useRef<number | null>(null);
  const lastSwitchAt = useRef<number | null>(null);
  const pending = useRef<IntegrityCounts>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const count = useCallback((kind: IntegrityKind) => { pending.current = { ...pending.current, [kind]: Math.min(500, (pending.current[kind] ?? 0) + 1) }; }, []);
  const flush = useCallback(() => {
    const counts = pending.current;
    if (Object.keys(counts).length === 0) return;
    pending.current = {};
    const body = JSON.stringify({ area, path: window.location.pathname.slice(0, 200), counts });
    if (!navigator.sendBeacon?.("/api/integrity/events", new Blob([body], { type: "application/json" }))) {
      fetch("/api/integrity/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    }
  }, [area]);
  const say = useCallback((message: string) => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), TOAST_MS); }, []);

  const strike = useCallback((v: Violation) => {
    state.current = applyViolation(state.current, v, policy);
    setExam(state.current);
    if (key) { try { window.sessionStorage.setItem(key, JSON.stringify(state.current)); } catch { /* storage blocked: the count lasts until the refresh */ } }
    setNotice(noticeFor(state.current, v, policy));
    count(v);
    if (state.current.terminated) { count("exam_ended"); flush(); }
  }, [policy, count, flush, key]);

  const enterFullscreen = useCallback(async () => {
    try {
      await (document.documentElement as FullscreenCapable).requestFullscreen?.({ navigationUI: "hide" });
      usedFullscreen.current = Boolean(document.fullscreenElement);
      // holding Esc is then needed to leave, where the browser supports it
      await (navigator as unknown as KeyboardLockable).keyboard?.lock?.(["Escape"]);
    } catch {
      /* a browser that refuses full screen still gets every other protection */
    }
  }, []);

  const release = useCallback(() => {
    releasing.current = true;
    setPhase("released");
    setNotice(null);
    if (key) { try { window.sessionStorage.removeItem(key); } catch { /* nothing stored */ } }
    try { (navigator as unknown as KeyboardLockable).keyboard?.unlock?.(); } catch { /* nothing to unlock */ }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    flush();
  }, [flush, key]);

  async function begin() {
    await enterFullscreen();
    window.history.pushState(null, "", window.location.href);
    setPhase("running");
  }

  useEffect(() => {
    if (phase !== "running") return;
    const onFullscreen = () => {
      if (document.fullscreenElement || !usedFullscreen.current || releasing.current) return;
      lastExitAt.current = Date.now();
      strike("fullscreen_exit");
    };
    const away = () => {
      const now = Date.now();
      if (isDuplicateSwitch(lastExitAt.current, now) || isDuplicateSwitch(lastSwitchAt.current, now)) return;
      lastSwitchAt.current = now;
      strike("tab_switch");
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") away(); };
    // focus moving into a frame of this same page (a code preview) is not leaving it
    const onBlur = () => { if (!(document.activeElement instanceof HTMLIFrameElement)) away(); };
    const block = (what: string, kind: IntegrityKind) => (e: Event) => { e.preventDefault(); count(kind); say(`${what} is switched off during the test.`); };
    const onKey = (e: KeyboardEvent) => {
      const blocked = blockedKey(e);
      if (blocked) {
        e.preventDefault();
        count(blocked === "print" || blocked === "save" ? "print" : "devtools");
        say(blocked === "devtools" || blocked === "view_source" ? "Developer tools are switched off during the test." : "Printing and saving are switched off during the test.");
      } else if (e.key === "PrintScreen") { count("screenshot"); say("Screenshots are not allowed during the test."); }
    };
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onBack = () => { window.history.pushState(null, "", window.location.href); say("Going back is switched off during the test."); };
    const noMenu = (e: Event) => e.preventDefault();

    const handlers: [EventTarget, string, EventListener, boolean?][] = [
      [document, "fullscreenchange", onFullscreen], [document, "visibilitychange", onVisibility], [window, "blur", onBlur],
      [document, "copy", block("Copying", "copy"), true], [document, "cut", block("Cutting", "cut"), true], [document, "paste", block("Pasting", "paste"), true],
      [document, "contextmenu", noMenu, true], [document, "dragstart", noMenu, true], [document, "keydown", onKey as EventListener, true],
      [window, "beforeunload", onUnload as EventListener], [window, "popstate", onBack], [window, "pagehide", flush],
    ];
    for (const [t, n, f, c] of handlers) t.addEventListener(n, f, c);
    const timer = setInterval(flush, FLUSH_MS);
    return () => { clearInterval(timer); for (const [t, n, f, c] of handlers) t.removeEventListener(n, f, c); };
  }, [phase, strike, count, say, flush]);

  // leaving the page by any route lets go of full screen and sends what was counted
  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    try { (navigator as unknown as KeyboardLockable).keyboard?.unlock?.(); } catch { /* nothing to unlock */ }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    flush();
  }, [flush]);

  // a test the lock ended is handed to the page to submit; if the page never lets go, the student is not left locked in
  useEffect(() => {
    if (!exam.terminated || phase !== "running") return;
    const t = setTimeout(release, FALLBACK_RELEASE_MS);
    return () => clearTimeout(t);
  }, [exam.terminated, phase, release]);

  const api = useMemo<ExamLockApi>(() => ({ terminated: exam.terminated, fullscreenExits: exam.fullscreenExits, tabSwitches: exam.tabSwitches, release }), [exam, release]);
  if (!mounted) return null;

  const ended = Boolean(exam.terminated);
  return createPortal(
    <Ctx.Provider value={api}>
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[var(--m-ground)]">
        {phase === "gate" ? (
          <div className="mx-auto flex min-h-full max-w-xl items-center p-4">
            <section className="w-full rounded-2xl border border-[var(--m-rule)] bg-white p-6 shadow-sm sm:p-8" aria-labelledby="exam-gate-h">
              <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--m-muted)]"><ShieldAlert size={15} aria-hidden />Proctored test</p>
              <h2 id="exam-gate-h" className="mt-1 font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">{title}</h2>
              <p className="mt-3 text-[14.5px] text-[var(--m-ink)]">Read these rules before you begin. Once the test starts you finish it or end it.</p>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-[var(--m-ink)]">{rules.map((r) => <li key={r}>{r}</li>)}</ul>
              {!fullscreenSupported && <p role="note" className="mt-4 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">This browser cannot go full screen. You can still take the test, but keep this tab in front: switching away is recorded.</p>}
              <label className="mt-5 flex cursor-pointer items-start gap-3 text-[14px] font-semibold text-[var(--m-ink)]">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--m-ink)]" />
                I have read the rules and I agree to take this test under them.
              </label>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" disabled={!agreed} onClick={() => void begin()} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-6 py-3 text-[15px] font-bold text-white disabled:opacity-50"><Maximize size={16} aria-hidden />Start in full screen</button>
                <button type="button" onClick={onCancel ?? (() => window.history.back())} className="rounded-full px-4 py-3 text-[14px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-ink)]">Not now</button>
              </div>
            </section>
          </div>
        ) : (
          <div className={notice ? "pointer-events-none select-none blur-[2px]" : "select-none [&_input]:select-text [&_textarea]:select-text"} aria-hidden={notice ? true : undefined}>{children}</div>
        )}
      </div>

      {phase === "running" && notice && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" role="alertdialog" aria-modal="true" aria-labelledby="exam-notice-h">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-4"><TriangleAlert size={22} aria-hidden className="text-red-600" /><h3 id="exam-notice-h" className="text-[18px] font-bold text-[var(--m-ink)]">{notice.title}</h3></div>
            <div className="px-5 py-4">
              <p className="text-[15px] leading-relaxed text-[var(--m-ink)]">{notice.message}</p>
              <div className="mt-4 rounded-lg border-l-4 border-red-500 bg-red-50 p-3.5">
                <p className="flex items-baseline justify-between text-[14px] font-semibold text-[var(--m-ink)]"><span>{notice.label}</span><span className="text-[15px] font-bold text-red-600">{notice.count} of {notice.limit}</span></p>
                <p className="mt-1 text-[14px] text-[var(--m-ink)]">{notice.detail}</p>
              </div>
            </div>
            <div className="border-t border-[var(--m-rule)] px-5 py-4 text-center">
              {ended
                ? <p role="status" className="flex items-center justify-center gap-2 text-[14.5px] font-bold text-[var(--m-ink)]"><Loader2 size={16} aria-hidden className="animate-spin" />Submitting your answers…</p>
                : <button type="button" autoFocus onClick={() => { void enterFullscreen(); setNotice(null); }} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-6 py-2.5 text-[15px] font-bold text-white"><Maximize size={16} aria-hidden />{notice.action}</button>}
            </div>
          </div>
        </div>
      )}
      {phase === "running" && toast && !notice && <p role="status" className="fixed bottom-6 left-1/2 z-[90] max-w-[90vw] -translate-x-1/2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-center text-[14px] font-bold text-white shadow-lg">{toast}</p>}
    </Ctx.Provider>,
    document.body,
  );
}

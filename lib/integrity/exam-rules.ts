/** How many times a student may leave the exam before it is ended for them. */
export interface ExamPolicy { maxFullscreenExits: number; maxTabSwitches: number }
export const DEFAULT_POLICY: ExamPolicy = { maxFullscreenExits: 3, maxTabSwitches: 3 };

export type Violation = "fullscreen_exit" | "tab_switch";
export interface ExamState { fullscreenExits: number; tabSwitches: number; terminated: Violation | null }
export const initialExamState: ExamState = { fullscreenExits: 0, tabSwitches: 0, terminated: null };

/** Pure. One more violation. Reaching its limit ends the exam; an exam that has already ended is left exactly as it is. */
export function applyViolation(s: ExamState, v: Violation, policy: ExamPolicy): ExamState {
  if (s.terminated) return s;
  const next = v === "fullscreen_exit" ? { ...s, fullscreenExits: s.fullscreenExits + 1 } : { ...s, tabSwitches: s.tabSwitches + 1 };
  const hit = v === "fullscreen_exit" ? next.fullscreenExits >= policy.maxFullscreenExits : next.tabSwitches >= policy.maxTabSwitches;
  return { ...next, terminated: hit ? v : null };
}

export interface ViolationNotice {
  title: string;
  message: string;
  /** what is being counted, and where the student stands */
  label: string;
  count: number;
  limit: number;
  remaining: number;
  detail: string;
  /** true when this violation ended the exam */
  ends: boolean;
  action: string;
}

const TEXT: Record<Violation, { title: string; message: string; label: string; unit: [string, string]; action: string }> = {
  fullscreen_exit: { title: "Fullscreen exit recorded", message: "Leaving fullscreen is not allowed during the test and each exit is recorded.", label: "Fullscreen exits", unit: ["exit", "exits"], action: "Return to Fullscreen" },
  tab_switch: { title: "Tab switch recorded", message: "Switching to another tab or window is not allowed during the test and each switch is recorded.", label: "Tab switches", unit: ["switch", "switches"], action: "Continue the test" },
};

/** Pure. What the alert says after a violation: the title, the count of limit, and how many more will end the test. */
export function noticeFor(s: ExamState, v: Violation, policy: ExamPolicy): ViolationNotice {
  const t = TEXT[v];
  const count = v === "fullscreen_exit" ? s.fullscreenExits : s.tabSwitches;
  const limit = v === "fullscreen_exit" ? policy.maxFullscreenExits : policy.maxTabSwitches;
  const remaining = Math.max(0, limit - count);
  const ends = s.terminated === v;
  return {
    title: t.title, message: t.message, label: t.label, count, limit, remaining, ends, action: t.action,
    detail: ends ? "Your test has been ended and your answers so far are being submitted." : `${remaining} more ${remaining === 1 ? t.unit[0] : t.unit[1]} will end your test.`,
  };
}

/** One action (Esc, or switching apps) can raise both a fullscreen exit and a blur. A blur this soon after an exit is the same act, not a second one. */
export const DEDUPE_MS = 1500;
export const isDuplicateSwitch = (lastExitAt: number | null, now: number): boolean => lastExitAt !== null && now - lastExitAt < DEDUPE_MS;

export type KeyBlock = "devtools" | "view_source" | "print" | "save";
interface KeyEvent { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }

/** Pure. The shortcuts that open developer tools, show the page source, print or save it. Copy and paste are handled by their own events. */
export function blockedKey(e: KeyEvent): KeyBlock | null {
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === "F12") return "devtools";
  if (mod && e.shiftKey && ["i", "j", "c"].includes(key)) return "devtools";
  if (e.metaKey && e.altKey && ["i", "j", "c"].includes(key)) return "devtools";
  if (mod && key === "u") return "view_source";
  if (mod && key === "p") return "print";
  if (mod && key === "s") return "save";
  return null;
}

/**
 * Pure. Strikes read back from storage after a page refresh, so reloading cannot reset the count. Anything that is not exactly the saved shape,
 * or has been tampered into nonsense, reads as no strikes rather than throwing.
 */
export function parseStrikes(raw: string | null): ExamState {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<ExamState> | null;
    const n = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 100 ? x : 0);
    if (!v || typeof v !== "object") return initialExamState;
    return { fullscreenExits: n(v.fullscreenExits), tabSwitches: n(v.tabSwitches), terminated: v.terminated === "fullscreen_exit" || v.terminated === "tab_switch" ? v.terminated : null };
  } catch {
    return initialExamState;
  }
}

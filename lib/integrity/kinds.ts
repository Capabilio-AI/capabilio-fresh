/** skillstudio and arena are the passive page guard; assessment and crt are timed exams run in the locked exam mode. */
export const INTEGRITY_AREAS = ["skillstudio", "arena", "assessment", "crt"] as const;
export type IntegrityArea = (typeof INTEGRITY_AREAS)[number];

/**
 * What the page guard and the exam lock count. paste / copy / cut / print / screenshot / devtools are attempts blocked or hidden; blur is leaving the
 * window; fullscreen_exit and tab_switch are the exam lock's strikes; exam_ended is a test the lock ended for too many strikes.
 */
export const INTEGRITY_KINDS = ["paste", "copy", "cut", "screenshot", "print", "blur", "fullscreen_exit", "tab_switch", "devtools", "exam_ended"] as const;
export type IntegrityKind = (typeof INTEGRITY_KINDS)[number];

export type IntegrityCounts = Partial<Record<IntegrityKind, number>>;

export const INTEGRITY_LABEL: Record<IntegrityKind, string> = {
  paste: "Paste attempts",
  copy: "Copy attempts",
  cut: "Cut attempts",
  screenshot: "Screenshot attempts",
  print: "Print attempts",
  blur: "Left the window",
  fullscreen_exit: "Fullscreen exits",
  tab_switch: "Tab switches",
  devtools: "Developer-tools attempts",
  exam_ended: "Tests ended by the lock",
};

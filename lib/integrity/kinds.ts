export const INTEGRITY_AREAS = ["skillstudio", "arena"] as const;
export type IntegrityArea = (typeof INTEGRITY_AREAS)[number];

/** What the page guard counts. paste / copy / cut / print / screenshot are attempts it blocked or hid; blur is leaving the window. */
export const INTEGRITY_KINDS = ["paste", "copy", "cut", "screenshot", "print", "blur"] as const;
export type IntegrityKind = (typeof INTEGRITY_KINDS)[number];

export type IntegrityCounts = Partial<Record<IntegrityKind, number>>;

export const INTEGRITY_LABEL: Record<IntegrityKind, string> = {
  paste: "Paste attempts",
  copy: "Copy attempts",
  cut: "Cut attempts",
  screenshot: "Screenshot attempts",
  print: "Print attempts",
  blur: "Left the window",
};

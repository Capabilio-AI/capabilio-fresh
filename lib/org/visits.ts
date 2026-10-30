export const VISIT_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "neutral" | "info" }> = {
  planned: { label: "Planned", tone: "info" },
  registration_open: { label: "Registration open", tone: "ok" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Student-facing wording for a registration's status. The college sets it; the student cannot. */
export const REGISTRATION_LABEL: Record<string, string> = {
  submitted: "Registered",
  shortlisted: "Shortlisted",
  accepted: "Selected",
  rejected: "Not selected",
};

/** Pure. A completed visit is final: it can't be reopened for registration (the page only offers "Open registration" before completion). */
export const canMoveVisit = (from: string, to: string): boolean => !(from === "completed" && to === "registration_open");

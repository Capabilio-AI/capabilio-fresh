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

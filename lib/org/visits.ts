import { csvCell } from "@/lib/org/outcomes";

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

export interface RegistrationRow {
  studentName: string;
  rollNumber: string | null;
  branch: string | null;
  endYear: number | null;
  email: string | null;
  status: string;
  registeredOn: string;
}

/** Pure. One company visit's registered students as CSV: what a college hands to the company (name, student ID, branch, class, contact, status). */
export function registrationsToCsv(rows: readonly RegistrationRow[]): string {
  const header = ["S.No", "Student", "Roll number", "Branch", "Class of", "Email", "Status", "Registered on"];
  const lines = rows.map((r, i) => [i + 1, r.studentName, r.rollNumber ?? "", r.branch ?? "", r.endYear ?? "", r.email ?? "", REGISTRATION_LABEL[r.status] ?? r.status, r.registeredOn.slice(0, 10)].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

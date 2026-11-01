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

export interface VisitDetails {
  role: string;
  location: string | null;
  ctc_offered: string | null;
  drive_date: string | null;
  deadline: string | null;
  eligible_branches: string[] | null;
  eligibility: string | null;
}

const day = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "not set");
const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "") === (b ?? "");
const branchList = (b: string[] | null) => (b && b.length ? b.join(", ") : "all branches");

/**
 * Pure. What a registered student needs to hear after an edit: dates, place, package, role and branches, each as "was -> now". Wording-only
 * changes to the eligibility text are not announced (no point pinging people over a typo), and an empty list means nothing worth a notification changed.
 */
export function describeVisitChanges(before: VisitDetails, after: VisitDetails): string[] {
  const out: string[] = [];
  if (!same(before.drive_date, after.drive_date)) out.push(`Visit date: ${day(before.drive_date)} \u2192 ${day(after.drive_date)}`);
  if (!same(before.deadline, after.deadline)) out.push(`Registration closes: ${day(before.deadline)} \u2192 ${day(after.deadline)}`);
  if (!same(before.location, after.location)) out.push(`Where: ${before.location ?? "not set"} \u2192 ${after.location ?? "not set"}`);
  if (!same(before.ctc_offered, after.ctc_offered)) out.push(`Package: ${before.ctc_offered ?? "not set"} \u2192 ${after.ctc_offered ?? "not set"}`);
  if (!same(before.role, after.role)) out.push(`Role: ${before.role} \u2192 ${after.role}`);
  if (branchList(before.eligible_branches) !== branchList(after.eligible_branches)) out.push(`Open to: ${branchList(before.eligible_branches)} \u2192 ${branchList(after.eligible_branches)}`);
  return out;
}

/**
 * Pure. A student may take back their registration while it is still just a registration (or a shortlisting) and the visit has not finished.
 * Once the college marked them selected or not selected, or the visit is over, the record is the college's and stays.
 */
export const canWithdraw = (applicationStatus: string, visitStatus: string): boolean =>
  (applicationStatus === "submitted" || applicationStatus === "shortlisted") && (visitStatus === "registration_open" || visitStatus === "planned");

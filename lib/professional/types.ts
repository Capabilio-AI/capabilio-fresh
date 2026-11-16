/** How a role in the career timeline was checked. Ordered strongest first; anything else is self-claimed. */
export type VerificationTier = "epfo" | "work_email" | "payslip" | "colleague" | "self_claimed";

export interface TimelineRole {
  id: string;
  company: string;
  title: string;
  /** ISO dates (yyyy-mm-dd); `end` is null for the current job. */
  start: string;
  end: string | null;
  tier: VerificationTier;
}

export interface EpfoRecord {
  establishment: string;
  /** First and last month with a contribution, as ISO dates. */
  from: string;
  to: string | null;
}

export type VisibilityState = "employed" | "notice" | "open";

export interface VisibilitySettings {
  state: VisibilityState;
  /** Last working day, only meaningful while on notice. */
  lastWorkingDay: string | null;
  /** Company names and email domains whose recruiters never see the profile. */
  blocklist: string[];
}

export interface CompanyRating {
  companyId: string;
  /** 1-5 */
  stars: number;
  /** "day30" is the expectation check, "exit" is the experience. */
  kind: "day30" | "exit";
  team: string;
  level: string;
}

export interface MentorReview {
  stars: number;
  tags: string[];
  comment: string | null;
  /** Anonymised, e.g. "Final-year student". */
  reviewerLabel: string;
  at: string;
}

export interface MentorStats {
  ratings: number[];
  sessionsBooked: number;
  sessionsCompleted: number;
  noShowsOrLateCancels: number;
  /** Median hours to answer a booking request. */
  responseHours: number;
  lastSessionAt: string | null;
}

export interface AvailabilityRule {
  /** 0 = Sunday */
  weekday: number;
  /** Minutes from midnight, local to the mentor's time zone. */
  startMin: number;
  endMin: number;
}

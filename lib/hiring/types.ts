export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export const EMPLOYMENT_TYPES = ["full_time", "part_time", "internship", "contract"] as const;
export const OPENING_STATUSES = ["draft", "open", "soon", "closed"] as const;
export const APPLICATION_STATUSES = ["new", "reviewing", "shortlisted", "rejected", "hired"] as const;

export type WorkMode = (typeof WORK_MODES)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type OpeningStatus = (typeof OPENING_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface InterviewStep {
  title: string;
  body: string;
}

export interface Opening {
  id: string;
  slug: string;
  title: string;
  team: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  summary: string;
  about: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  proofBrief: string | null;
  /** What the work looks like day to day: plain paragraphs. */
  dayToDay: string | null;
  firstMonths: string[];
  /** This role's interview steps; empty means the general four steps are shown. */
  interview: InterviewStep[];
  compensation: string | null;
  status: OpeningStatus;
  publishedAt: string | null;
  closesOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationRow {
  id: string;
  openingId: string | null;
  openingTitle: string | null;
  fullName: string;
  email: string;
  workUrl: string;
  proofNote: string;
  resumeUrl: string | null;
  profileUrl: string | null;
  status: ApplicationStatus;
  internalNote: string | null;
  /** set when a signed-in student applied; their Skill Passport can then be opened */
  userId: string | null;
  passportCode: string | null;
  createdAt: string;
}

/** A company role as a student sees it: the role plus who is hiring. */
export interface CompanyOpening extends Opening {
  companyName: string;
}

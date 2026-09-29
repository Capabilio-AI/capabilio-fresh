// Single source of truth for the four-path selector (/get-started).
export interface OnboardingPath {
  id: "student" | "professional" | "executive" | "organisation";
  title: string;
  tagline: string;
  subtext?: string;
  href: string;
  comingSoon: boolean;
}

export const ONBOARDING_PATHS: readonly OnboardingPath[] = [
  {
    id: "student",
    title: "Student / Recently Graduated",
    tagline: "Build your evidence-backed career profile.",
    href: "/signup",
    comingSoon: false,
  },
  {
    id: "professional",
    title: "Working Professional",
    tagline: "Turn your work into verified, evidence-backed capability.",
    href: "/get-started/professional",
    comingSoon: true,
  },
  {
    id: "executive",
    title: "Executive",
    tagline: "Build an evidence-backed leadership and professional profile.",
    subtext: "Startup Founders, CEOs, Directors and other leaders",
    href: "/get-started/executive",
    comingSoon: true,
  },
  {
    id: "organisation",
    title: "Organisation",
    tagline: "Connect, assess, develop, and understand your people.",
    subtext: "Colleges & Universities, Companies",
    href: "/get-started/organisation",
    comingSoon: false,
  },
] as const;

export const GET_STARTED_HREF = "/get-started";

// The plans a recently graduated user picks after login. Prices are display-only placeholders until checkout exists:
// choosing a plan records it on the profile and unlocks its features; nothing is charged.
/**
 * Whether a plan actually restricts features. Off while there is no checkout: nobody can pay yet, so nobody is blocked. Turn this on
 * in the same release that ships billing, and the plan gates (AI Interview) start applying again.
 */
export const ENFORCE_PLANS = false;

export const PLAN_IDS = ["free", "pro", "elite"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type PlanFeature = "aiInterview";

/** One line of the plan comparison. `included: false` renders as a muted "not included" row. */
export interface PlanRow {
  label: string;
  value: string;
  included: boolean;
  /** promised but not built yet: shown with a "Soon" tag so a card never claims more than the product does */
  soon?: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** shown as the big number; "Free" for the free plan */
  price: string;
  cadence: string;
  /** small line under the price, e.g. the per-month equivalent */
  hint?: string;
  blurb: string;
  rows: PlanRow[];
  /** small print under the rows */
  note?: string;
  /** features this plan unlocks beyond the free ones */
  unlocks: PlanFeature[];
  highlight?: string;
}

// Prices are placeholders until checkout exists. Passes are one-time and do not auto-renew: a job search ends when the job starts.
export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    cadence: "",
    blurb: "Find out how job-ready you are, and start practising today.",
    rows: [
      { label: "Arena practice", value: "Weekly spin: 4 to 9 challenges", included: true },
      { label: "Skill gaps", value: "Your top 3 gaps", included: true },
      { label: "AI mock interview", value: "1 free session, then ₹29 each", included: true },
      { label: "Proof portfolio", value: "Up to 3 projects with evidence", included: true },
      { label: "Skill Passport", value: "Shareable link and QR for employers", included: true },
      { label: "Job tracker", value: "Up to 10 applications", included: true },
    ],
    note: "Need more practice? Buy 20-minute mock interviews at ₹29 each, or 5 for ₹99.",
    unlocks: [],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹499",
    cadence: "for 3 months",
    hint: "About ₹166 a month. Pay once, no auto-renew.",
    blurb: "Everything you need to go from practising to getting interview calls.",
    rows: [
      { label: "Arena practice", value: "Weekly spin, with challenges matched to your role and skill gaps, never repeated", included: true, soon: true },
      { label: "Skill gaps", value: "Full analysis and a step-by-step plan, every month", included: true },
      { label: "AI mock interview", value: "8 sessions of 20 minutes", included: true },
      { label: "Proof portfolio", value: "Unlimited projects, with Code DNA from your GitHub", included: true },
      { label: "Skill Passport", value: "With your verified evidence", included: true },
      { label: "Job tracker", value: "Unlimited applications", included: true },
    ],
    unlocks: ["aiInterview"],
    highlight: "Recommended",
  },
  {
    id: "elite",
    name: "Elite",
    price: "₹899",
    cadence: "for 3 months",
    hint: "About ₹300 a month. Pay once, no auto-renew.",
    blurb: "For when you want every edge and a profile that stands out.",
    rows: [
      { label: "Arena practice", value: "Weekly spin, with challenges matched to your role and skill gaps, never repeated", included: true, soon: true },
      { label: "Skill gaps", value: "Full analysis every fortnight", included: true },
      { label: "AI mock interview", value: "15 sessions of 20 minutes", included: true },
      { label: "Proof portfolio", value: "Unlimited, plus a mentor review of your evidence", included: true, soon: true },
      { label: "Skill Passport", value: "With a personal branding video", included: true, soon: true },
      { label: "Job tracker", value: "Unlimited applications", included: true },
    ],
    unlocks: ["aiInterview"],
  },
];

export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && (PLAN_IDS as readonly string[]).includes(v);

export const planById = (id: unknown): Plan | null => PLANS.find((p) => p.id === id) ?? null;

/** Anything not chosen yet counts as no features, so a gate fails closed. */
export function planAllows(id: unknown, feature: PlanFeature): boolean {
  return planById(id)?.unlocks.includes(feature) ?? false;
}

/** Students unlock AI Interview in their final year; graduates need a plan that includes it once plans are enforced; professionals always have it. */
export function interviewUnlocked(stage: "student" | "graduate" | "professional", planId: unknown, finalYearOpen: boolean, enforce: boolean = ENFORCE_PLANS): boolean {
  if (stage === "student") return finalYearOpen;
  if (stage === "graduate") return !enforce || planAllows(planId, "aiInterview");
  return true;
}

/** AI mock interviews included per plan (the plan rows above); an unchosen plan counts as Free. */
const INTERVIEW_QUOTA: Record<PlanId, number> = { free: 1, pro: 8, elite: 15 };

/** True when the student has used every interview their plan includes. Never true while plans are not enforced. */
export function interviewQuotaReached(used: number, planId: unknown, enforce: boolean = ENFORCE_PLANS): boolean {
  if (!enforce) return false;
  return used >= INTERVIEW_QUOTA[isPlanId(planId) ? planId : "free"];
}

/** Why a plan cannot be saved right now, or null. Paid plans need a payment record, which does not exist yet, so once plans are enforced only Free can be chosen. */
export function planSelectionError(planId: PlanId, enforce: boolean = ENFORCE_PLANS): string | null {
  return enforce && planId !== "free" ? "Payments are not available yet. Choose the Free plan for now." : null;
}

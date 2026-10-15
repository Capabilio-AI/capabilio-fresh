// The plans a recently graduated user picks after login. Prices are display-only placeholders until checkout exists:
// choosing a plan records it on the profile and unlocks its features; nothing is charged.
export const PLAN_IDS = ["launch", "accelerate_monthly", "accelerate_quarterly"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type PlanFeature = "aiInterview";

export interface Plan {
  id: PlanId;
  name: string;
  /** shown as the big number; "Free" for the free plan */
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  /** features this plan unlocks beyond the free ones */
  unlocks: PlanFeature[];
  highlight?: string;
}

export const PLANS: readonly Plan[] = [
  {
    id: "launch",
    name: "Launch",
    price: "Free",
    cadence: "",
    blurb: "Everything you need to get an evidence-backed profile in front of employers.",
    features: ["Career assessment and skill graph", "Portfolio and evidence vault", "Launchpad jobs and referrals", "Pulse community"],
    unlocks: [],
  },
  {
    id: "accelerate_monthly",
    name: "Accelerate",
    price: "₹499",
    cadence: "per month",
    blurb: "Practise interviews until the real ones feel familiar.",
    features: ["Everything in Launch", "AI Interview: technical, behavioural and HR rounds", "Cancel any time"],
    unlocks: ["aiInterview"],
  },
  {
    id: "accelerate_quarterly",
    name: "Accelerate Quarterly",
    price: "₹1,299",
    cadence: "every 3 months",
    blurb: "The same plan for the length of a typical job search, for less.",
    features: ["Everything in Accelerate", "Save about 13% against monthly"],
    unlocks: ["aiInterview"],
    highlight: "Best value",
  },
];

export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && (PLAN_IDS as readonly string[]).includes(v);

export const planById = (id: unknown): Plan | null => PLANS.find((p) => p.id === id) ?? null;

/** Anything not chosen yet counts as no features, so a gate fails closed. */
export function planAllows(id: unknown, feature: PlanFeature): boolean {
  return planById(id)?.unlocks.includes(feature) ?? false;
}

/** Students unlock AI Interview in their final year; graduates need a plan that includes it; professionals always have it. */
export function interviewUnlocked(stage: "student" | "graduate" | "professional", planId: unknown, finalYearOpen: boolean): boolean {
  if (stage === "student") return finalYearOpen;
  if (stage === "graduate") return planAllows(planId, "aiInterview");
  return true;
}

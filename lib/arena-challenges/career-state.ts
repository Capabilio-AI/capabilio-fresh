import type { IntentView } from "@/lib/careers/intent";

export type CareerChoice = "primary" | "plan-b";

export type DomainCareerState =
  | { state: "ready"; which: CareerChoice; career: { id: string; key: string; name: string }; planB: string | null; primary: string }
  | { state: "no_plan_b"; primary: string }
  | { state: "exploring" }
  | { state: "unset" };

/**
 * Pure. Which career drives the Domain track. Never guesses: no primary career, or "I am exploring", is its own state.
 * An explicit Plan B request when none is set is reported, not silently answered with the primary career.
 */
export function chooseDomainCareer(intent: Pick<IntentView, "primary" | "secondary" | "isExploring">, which: CareerChoice): DomainCareerState {
  if (!intent.primary) return intent.isExploring ? { state: "exploring" } : { state: "unset" };
  if (which === "plan-b") {
    if (!intent.secondary) return { state: "no_plan_b", primary: intent.primary.name };
    return { state: "ready", which, career: intent.secondary, planB: intent.secondary.name, primary: intent.primary.name };
  }
  return { state: "ready", which: "primary", career: intent.primary, planB: intent.secondary?.name ?? null, primary: intent.primary.name };
}

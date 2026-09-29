import type { CapabilityGroup } from "@/lib/portfolio/view";

export interface PortfolioPersona {
  title: string;
  description: string;
}

/** Curated labels for known capability groups — extend as new Arena roles/skill groups are added. */
const PERSONA_BY_GROUP: Record<string, PortfolioPersona> = {
  "Data Analysis": { title: "The Insight Engine", description: "Data storytelling, business impact, analytical rigor" },
  "Observed in code": { title: "The Builder", description: "Real code, real repositories, real commits" },
};

/**
 * A one-line "professional identity" for the portfolio hero — but derived
 * only from the student's strongest VERIFIED capability group, never from
 * a self-assessment. Returns null when nothing has been demonstrated yet,
 * so the portfolio shows no persona rather than an unearned one.
 */
export function derivePersona(groups: CapabilityGroup[]): PortfolioPersona | null {
  const top = groups[0];
  if (!top || top.capabilities.length === 0) return null;
  return PERSONA_BY_GROUP[top.name] ?? { title: `The ${top.name} Specialist`, description: `Demonstrated through verified ${top.name.toLowerCase()} work` };
}

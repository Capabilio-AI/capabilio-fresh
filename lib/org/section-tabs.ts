import type { SectionTab } from "@/components/org/SectionTabs";

/** Companies, the visits they accepted, and the messages with them: one header entry (Companies), three tabs. */
export const companyTabs = (): SectionTab[] => [
  { label: "Companies", href: "/org/companies", show: true },
  { label: "Company visits", href: "/org/placements", show: true },
  { label: "Messages", href: "/org/companies/messages", show: true },
];

/** Placements, CRT results and the integrity report: one header entry (Outcomes). Integrity shows only to those who may see the student roster. */
export const outcomeTabs = (canSeeOutcomes: boolean, canSeeIntegrity: boolean): SectionTab[] => [
  { label: "Placements", href: "/org/outcomes", show: canSeeOutcomes },
  { label: "CRT", href: "/org/outcomes?tab=crt", show: canSeeOutcomes },
  { label: "Integrity", href: "/org/integrity", show: canSeeIntegrity },
];

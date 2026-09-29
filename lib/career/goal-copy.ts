import type { GoalState } from "./direction";

export const GOAL_OPTIONS: { value: GoalState; label: string; description: string }[] = [
  { value: "job", label: "Getting a job", description: "Portfolio prompts, AI interview practice, and internship and entry-level listings in Launchpad." },
  { value: "higher_studies", label: "Higher studies", description: "GATE, MS abroad and similar. Your profile and Arena stay as they are; we check in now and then." },
  { value: "entrepreneur", label: "Entrepreneur", description: "A curated resource page on incubators and programs." },
  { value: "not_sure", label: "Not sure yet", description: "We'll set you up like the job track and ask again later. It's a fine answer." },
];

export const goalLabel = (g: GoalState | null): string => GOAL_OPTIONS.find((o) => o.value === g)?.label ?? "Not chosen yet";

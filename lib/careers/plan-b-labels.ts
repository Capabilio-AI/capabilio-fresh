import type { PlanBKind } from "./plan-b-rules";

export const PLAN_B_LABEL: Record<PlanBKind, string> = {
  same_role: "Same career role",
  higher_studies: "Higher studies",
  entrepreneur: "Entrepreneur",
  change_role: "Change career role",
  undecided: "Not yet decided",
};

export type SubmitState =
  /** the group is full: any member can submit */
  | "ready"
  /** not full, and this member leads the group: can submit with the people who are in it */
  | "small-lead"
  /** not full, and this member is not the lead: the lead decides */
  | "small-wait"
  | "graded";

/** Pure. What a member may do about submitting, given the group's status, their role and the team size. */
export function submitState(group: { status: string }, isLead: boolean): SubmitState {
  if (group.status === "graded") return "graded";
  if (group.status !== "forming") return "ready";
  return isLead ? "small-lead" : "small-wait";
}

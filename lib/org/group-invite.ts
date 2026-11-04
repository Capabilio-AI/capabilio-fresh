/** Where a group lead's invite link points: the project page, opened on that group. */
export const inviteHref = (projectId: string, groupId: string): string => `/arena/projects/${projectId}?group=${groupId}`;

/** Pure. The two notifications of the join flow, so the wording lives in one place. */
export function joinRequestCopy(requester: string, group: string): { title: string; body: string } {
  return { title: `${requester} wants to join ${group}`, body: "Open the project to accept or reject the request." };
}
export function joinDecisionCopy(group: string, accepted: boolean): { title: string; body: string } {
  return accepted
    ? { title: `You're in: ${group}`, body: "The group lead accepted your request." }
    : { title: `Request declined: ${group}`, body: "The group lead did not accept your request. You can ask another group." };
}

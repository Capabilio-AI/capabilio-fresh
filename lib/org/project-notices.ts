/** Wording of the notifications around project groups and mentors, in one place. */
export const remindCopy = (title: string, deadline: string) => ({ title: `Join a group: ${title}`, body: `You are not in a group yet. Form or join a group before ${deadline}.` });
export const addedToGroupCopy = (group: string, by: string) => ({ title: `You were added to ${group}`, body: `${by} placed you in this group.` });
export const mentorAskCopy = (group: string, project: string) => ({ title: `${group} asks you to mentor them`, body: `Project: ${project}. Accept or reject in Projects.` });
export const mentorAnswerCopy = (mentor: string, group: string, accepted: boolean, reason?: string) =>
  accepted
    ? { title: `${mentor} will mentor ${group}`, body: "Your mentor request was accepted." }
    : { title: `${mentor} cannot mentor ${group}`, body: reason ? `Reason: ${reason}` : "Your mentor request was declined." };

export const feedbackCopy = (staff: string, group: string, week: number, feedback: string) => ({
  title: `${staff} left feedback on ${group}, week ${week}`,
  body: feedback.length > 140 ? `${feedback.slice(0, 137)}...` : feedback,
});

/** Pure. Staff a group may still ask: everyone except people who already declined it or have a request waiting. */
export function askableMentors<T extends { membershipId: string }>(all: T[], requests: { mentorMembershipId: string; status: string }[]): T[] {
  const blocked = new Set(requests.filter((r) => r.status === "pending" || r.status === "rejected" || r.status === "accepted").map((r) => r.mentorMembershipId));
  return all.filter((m) => !blocked.has(m.membershipId));
}

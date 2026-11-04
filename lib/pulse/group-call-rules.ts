/** Group-call rules, PURE. The server applies these; the client mirrors the same words. */
export type ParticipantStatus = "ringing" | "joined" | "declined" | "left" | "missed";
export interface ParticipantLike { userId: string; status: ParticipantStatus }

/** Most people in one call: past this the screen and the connections stop being usable. */
export const MAX_PARTICIPANTS = 8;

/** People still in the call (or being rung): they count towards the limit. */
export const countsTowardLimit = (p: ParticipantLike): boolean => p.status === "ringing" || p.status === "joined";

export const joinedCount = (list: ParticipantLike[]): number => list.filter((p) => p.status === "joined").length;

/** A call with one person left in it is over: nobody is there to talk to. */
export const shouldEnd = (list: ParticipantLike[], leaving: string): boolean => joinedCount(list.filter((p) => p.userId !== leaving)) <= 1;

export type InviteVerdict = { allow: true } | { allow: false; reason: "self" | "already_in" | "full" | "blocked" | "busy" };

/** May this person be added to the call? Someone who declined, left or missed it can be asked again. */
export function inviteVerdict(input: { candidate: string; me: string; participants: ParticipantLike[]; blocked: boolean; busy: boolean }): InviteVerdict {
  if (input.candidate === input.me) return { allow: false, reason: "self" };
  if (input.participants.some((p) => p.userId === input.candidate && countsTowardLimit(p))) return { allow: false, reason: "already_in" };
  if (input.participants.filter(countsTowardLimit).length >= MAX_PARTICIPANTS) return { allow: false, reason: "full" };
  if (input.blocked) return { allow: false, reason: "blocked" };
  if (input.busy) return { allow: false, reason: "busy" };
  return { allow: true };
}

export const INVITE_MESSAGE: Record<Exclude<InviteVerdict, { allow: true }>["reason"], string> = {
  self: "You're already in this call.",
  already_in: "They're already in this call.",
  full: `A call can have up to ${MAX_PARTICIPANTS} people.`,
  blocked: "You can't add this person.",
  busy: "They're on another call.",
};

/** Columns for a grid of n tiles: one fills the screen, two sit side by side, then a grid that stays readable. */
export function gridColumns(n: number): number {
  if (n <= 1) return 1;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 4;
}

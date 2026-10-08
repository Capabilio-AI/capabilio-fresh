/**
 * Who may send a message to whom, PURE. Anyone who is not blocked can message anyone: the message lands straight in the
 * inbox, so people actually receive what is sent to them. Safety is block and report, not a gate on the first message.
 * Older conversations that were created as requests open up on the next message; one the recipient declined stays closed
 * to the person who sent it.
 */
export type ConversationStatus = "pending" | "accepted" | "declined";

export interface ConversationState {
  status: ConversationStatus;
  requestedBy: string;
}

export type SendDecision = { allow: true; status: ConversationStatus } | { allow: false; message: string };

export function decideSend(input: { me: string; blocked: boolean; conversation: ConversationState | null }): SendDecision {
  const { me, blocked, conversation } = input;
  if (blocked) return { allow: false, message: "You can't message this person." };
  // declined: the person who declined may still write, which reopens it; the one who was declined may not
  if (conversation?.status === "declined" && conversation.requestedBy === me) return { allow: false, message: "This person isn't accepting messages from you." };
  return { allow: true, status: "accepted" };
}

/** Pure. The shape of a conversation row from one person's side. */
export function sideOf(c: { user_lo: string; user_hi: string }, me: string): { other: string } | null {
  if (c.user_lo === me) return { other: c.user_hi };
  if (c.user_hi === me) return { other: c.user_lo };
  return null;
}

/** The two ids in the order the table stores them (user_lo < user_hi). */
export const pairOf = (a: string, b: string): { lo: string; hi: string } => (a < b ? { lo: a, hi: b } : { lo: b, hi: a });

export const previewOf = (body: string): string => body.replace(/\s+/g, " ").trim().slice(0, 140);

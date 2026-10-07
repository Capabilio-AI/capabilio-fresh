/**
 * Who may send a message to whom, PURE. Messaging is consent-based: a first message is a request the other person accepts,
 * unless they already follow the sender. While a request is pending the requester gets one message, so a request cannot become spam.
 */
export type ConversationStatus = "pending" | "accepted" | "declined";

export interface ConversationState {
  status: ConversationStatus;
  requestedBy: string;
  /** messages the requester has already sent in this conversation */
  requesterMessages: number;
}

export type SendDecision = { allow: true; status: ConversationStatus } | { allow: false; message: string };

export const REQUEST_MESSAGE_LIMIT = 1;

export function decideSend(input: { me: string; blocked: boolean; recipientFollowsMe: boolean; conversation: ConversationState | null }): SendDecision {
  const { me, blocked, recipientFollowsMe, conversation } = input;
  if (blocked) return { allow: false, message: "You can't message this person." };
  if (!conversation) return { allow: true, status: recipientFollowsMe ? "accepted" : "pending" };

  const iRequested = conversation.requestedBy === me;
  if (conversation.status === "accepted") return { allow: true, status: "accepted" };
  if (conversation.status === "pending") {
    if (!iRequested) return { allow: false, message: "Accept or decline their request to reply." };
    if (conversation.requesterMessages >= REQUEST_MESSAGE_LIMIT) return { allow: false, message: "Your request is waiting. You can send more once they accept." };
    return { allow: true, status: "pending" };
  }
  // declined: the person who declined may still choose to write, which reopens it; the requester may not
  return iRequested ? { allow: false, message: "This person isn't accepting messages from you." } : { allow: true, status: "accepted" };
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

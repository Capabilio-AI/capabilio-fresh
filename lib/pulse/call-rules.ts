/** Call state and rules, PURE. The server applies these; the client mirrors the same words. */
export type CallStatus = "ringing" | "accepted" | "declined" | "cancelled" | "missed" | "ended";
export type CallKind = "voice" | "video";
export type CallAction = "accept" | "decline" | "cancel" | "end";

/** How long the caller's phone rings before it gives up. */
export const RING_SECONDS = 45;
/** The server treats a ringing call older than this as over, even if no one ended it (a closed tab, a dropped connection). */
export const RING_EXPIRY_SECONDS = 60;
/** An accepted call nobody ended is treated as over after this long. */
export const MAX_CALL_HOURS = 4;

export interface CallLike {
  status: CallStatus;
  created_at: string;
  answered_at: string | null;
}

/** A call still counts (a person is "busy") only while it can really be in progress. */
export function isLive(call: CallLike, now = Date.now()): boolean {
  if (call.status === "ringing") return now - new Date(call.created_at).getTime() < RING_EXPIRY_SECONDS * 1000;
  if (call.status === "accepted") return now - new Date(call.answered_at ?? call.created_at).getTime() < MAX_CALL_HOURS * 3_600_000;
  return false;
}

export type Transition = { ok: true; status: CallStatus } | { ok: false; message: string };

/** What an action does to a call. Only the callee answers; only the caller cancels; either side ends one in progress. */
export function transition(call: { status: CallStatus; callerId: string; calleeId: string }, actor: string, action: CallAction): Transition {
  const isCaller = actor === call.callerId;
  const isCallee = actor === call.calleeId;
  if (!isCaller && !isCallee) return { ok: false, message: "Call not found." };
  if (call.status !== "ringing" && call.status !== "accepted") return { ok: false, message: "This call is already over." };
  if (call.status === "ringing") {
    if (action === "accept" && isCallee) return { ok: true, status: "accepted" };
    if ((action === "decline" || action === "end") && isCallee) return { ok: true, status: "declined" };
    if ((action === "cancel" || action === "end") && isCaller) return { ok: true, status: "cancelled" };
    return { ok: false, message: "That isn't available right now." };
  }
  return action === "end" ? { ok: true, status: "ended" } : { ok: false, message: "This call has already started." };
}

export type CallBlock = { allow: true } | { allow: false; message: string };

export function canStartCall(input: { conversationStatus: "pending" | "accepted" | "declined" | null; blocked: boolean; callerBusy: boolean; calleeBusy: boolean }): CallBlock {
  if (input.blocked) return { allow: false, message: "You can't call this person." };
  if (input.conversationStatus !== "accepted") return { allow: false, message: "You can call someone once they've accepted your messages." };
  if (input.callerBusy) return { allow: false, message: "You're already on a call." };
  if (input.calleeBusy) return { allow: false, message: "They're on another call. Try again in a moment." };
  return { allow: true };
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** The line shown in the conversation once a call is over. */
export function callLogText(kind: CallKind, status: CallStatus, durationSeconds: number | null): string {
  const label = kind === "video" ? "video call" : "voice call";
  if (status === "ended") return `${kind === "video" ? "Video" : "Voice"} call · ${formatDuration(durationSeconds ?? 0)}`;
  if (status === "declined") return `Declined ${label}`;
  return `Missed ${label}`;
}

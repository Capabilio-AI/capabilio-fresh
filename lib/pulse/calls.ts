import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith } from "./graph";
import { callLogText, canStartCall, isLive, transition, type CallAction, type CallKind, type CallStatus } from "./call-rules";
import { loadIceConfig, type IceConfig } from "./ice";
import { conversationBetween, notify, toMessage } from "./messages";
import { previewOf } from "./message-rules";
import { loadPeople, type PersonSummary } from "./people";

type Service = SupabaseClient<Database>;

interface CallRow {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  kind: CallKind;
  status: CallStatus;
  created_at: string;
  answered_at: string | null;
}
const COLUMNS = "id, conversation_id, caller_id, callee_id, kind, status, created_at, answered_at";
export const MAX_SIGNAL_CHARS = 20_000;

export interface CallInfo {
  id: string;
  kind: CallKind;
  conversationId: string;
  callerId: string;
  calleeId: string;
}
const info = (c: CallRow): CallInfo => ({ id: c.id, kind: c.kind, conversationId: c.conversation_id, callerId: c.caller_id, calleeId: c.callee_id });

export type CallResult<T = object> = ({ ok: true } & T) | { ok: false; status: number; message: string };
const fail = (status: number, message: string): { ok: false; status: number; message: string } => ({ ok: false, status, message });

async function loadCall(service: Service, id: string): Promise<CallRow | null> {
  const { data } = await untyped(service).from("calls").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as CallRow | null) ?? null;
}

/** Writes the end of a call: status, timing, the line in the conversation, and tells both people. */
async function finalize(service: Service, call: CallRow, status: CallStatus): Promise<void> {
  const db = untyped(service);
  const now = new Date();
  const duration = status === "ended" && call.answered_at ? Math.max(0, Math.round((now.getTime() - new Date(call.answered_at).getTime()) / 1000)) : null;
  const { data: done } = await db.from("calls").update({ status, ended_at: now.toISOString(), duration_seconds: duration }).eq("id", call.id).in("status", ["ringing", "accepted"]).select("id");
  if (!done || done.length === 0) return; // someone else already ended it
  const text = callLogText(call.kind, status, duration);
  const { data: row } = await db.from("dm_messages").insert({ conversation_id: call.conversation_id, sender_id: call.caller_id, body: text, kind: "call" }).select("id, sender_id, body, created_at, deleted_at, kind").single();
  if (row) {
    const message = toMessage(row as Parameters<typeof toMessage>[0]);
    await db.from("dm_conversations").update({ last_message_at: message.createdAt, last_message_preview: previewOf(text), last_sender_id: call.caller_id }).eq("id", call.conversation_id);
    await notify(service, [call.caller_id, call.callee_id], "message", { conversationId: call.conversation_id, status: "accepted", message });
  }
  await notify(service, [call.caller_id, call.callee_id], "call", { type: "ended", callId: call.id, status, duration });
}

/** Closes calls that can no longer be in progress (a closed tab, a dropped connection) so nobody stays "busy". */
async function closeStale(service: Service, userIds: string[]): Promise<void> {
  const ids = userIds.join(",");
  const { data } = await untyped(service).from("calls").select(COLUMNS).in("status", ["ringing", "accepted"]).or(`caller_id.in.(${ids}),callee_id.in.(${ids})`);
  for (const c of (data ?? []) as CallRow[]) if (!isLive(c)) await finalize(service, c, c.status === "ringing" ? "missed" : "ended");
}

async function busy(service: Service, userId: string): Promise<boolean> {
  const { data } = await untyped(service).from("calls").select(COLUMNS).in("status", ["ringing", "accepted"]).or(`caller_id.eq.${userId},callee_id.eq.${userId}`);
  return ((data ?? []) as CallRow[]).some((c) => isLive(c));
}

export async function startCall(service: Service, me: string, otherId: string, kind: CallKind): Promise<CallResult<{ call: CallInfo; ice: IceConfig }>> {
  if (otherId === me) return fail(400, "You can't call yourself.");
  await closeStale(service, [me, otherId]);
  const [conversation, blocked, callerBusy, calleeBusy] = await Promise.all([conversationBetween(service, me, otherId), blockedWith(service, me), busy(service, me), busy(service, otherId)]);
  const verdict = canStartCall({ conversationStatus: conversation?.status ?? null, blocked: blocked.has(otherId), callerBusy, calleeBusy });
  if (!verdict.allow || !conversation) return fail(verdict.allow ? 403 : calleeBusy || callerBusy ? 409 : 403, verdict.allow ? "You can't call this person." : verdict.message);

  const { data, error } = await untyped(service).from("calls").insert({ conversation_id: conversation.id, caller_id: me, callee_id: otherId, kind }).select(COLUMNS).single();
  if (error || !data) return fail(500, "Couldn't start the call. Please try again.");
  const call = data as CallRow;
  const from = (await loadPeople(service, [me])).get(me) as PersonSummary | undefined;
  await notify(service, [otherId], "call", { type: "incoming", call: info(call), from });
  return { ok: true, call: info(call), ice: await loadIceConfig() };
}

export async function respondToCall(service: Service, me: string, callId: string, action: "accept" | "decline"): Promise<CallResult<{ call: CallInfo; ice: IceConfig | null }>> {
  const call = await loadCall(service, callId);
  if (!call) return fail(404, "Call not found.");
  const t = transition({ status: call.status, callerId: call.caller_id, calleeId: call.callee_id }, me, action);
  if (!t.ok) return fail(409, t.message);
  if (!isLive(call)) {
    await finalize(service, call, "missed");
    return fail(410, "This call has ended.");
  }
  if (t.status === "accepted") {
    const { data } = await untyped(service).from("calls").update({ status: "accepted", answered_at: new Date().toISOString() }).eq("id", callId).eq("status", "ringing").select("id");
    if (!data || data.length === 0) return fail(409, "This call is no longer ringing.");
    // the caller starts the connection; the callee's other tabs stop ringing
    await notify(service, [call.caller_id], "call", { type: "accepted", callId });
    await notify(service, [call.callee_id], "call", { type: "handled", callId });
    return { ok: true, call: info(call), ice: await loadIceConfig() };
  }
  await finalize(service, call, "declined");
  return { ok: true, call: info(call), ice: null };
}

/** Hang up, or cancel a ring that has not been answered. */
export async function endCall(service: Service, me: string, callId: string): Promise<CallResult> {
  const call = await loadCall(service, callId);
  if (!call) return fail(404, "Call not found.");
  const action: CallAction = "end";
  const t = transition({ status: call.status, callerId: call.caller_id, calleeId: call.callee_id }, me, action);
  if (!t.ok) return fail(409, t.message);
  await finalize(service, call, t.status);
  return { ok: true };
}

export interface Signal {
  kind: "offer" | "answer" | "candidate";
  data: unknown;
}

/** Passes a WebRTC offer, answer or ICE candidate to the other person, only within a call they are both in. */
export async function relaySignal(service: Service, me: string, callId: string, signal: Signal): Promise<CallResult> {
  const call = await loadCall(service, callId);
  if (!call || (call.caller_id !== me && call.callee_id !== me)) return fail(404, "Call not found.");
  if (call.status !== "accepted") return fail(409, "This call isn't in progress.");
  if (JSON.stringify(signal.data ?? null).length > MAX_SIGNAL_CHARS) return fail(413, "That signal is too large.");
  await notify(service, [me === call.caller_id ? call.callee_id : call.caller_id], "signal", { callId, kind: signal.kind, data: signal.data });
  return { ok: true };
}

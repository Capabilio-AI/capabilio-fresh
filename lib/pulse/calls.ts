import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith } from "./graph";
import { callLogText, canStartCall, isLive, transition, type CallAction, type CallKind, type CallStatus } from "./call-rules";
import { livekitConfig, mintCallToken } from "./livekit";
import { INVITE_MESSAGE, inviteVerdict, shouldEnd, type ParticipantStatus } from "./group-call-rules";
import { conversationBetween, notify, toMessage } from "./messages";
import { previewOf } from "./message-rules";
import { loadPeople, type PersonSummary } from "./people";
import { notify as notifyBell } from "@/lib/notifications/notify";

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
  const rows = await loadParticipants(service, call.id);
  await db.from("call_participants").update({ status: "missed", left_at: now.toISOString() }).eq("call_id", call.id).eq("status", "ringing");
  await db.from("call_participants").update({ status: "left", left_at: now.toISOString() }).eq("call_id", call.id).eq("status", "joined");
  await notify(service, [...new Set([call.caller_id, call.callee_id, ...rows.map((r) => r.user_id)])], "call", { type: "ended", callId: call.id, status, duration });
  if (status === "missed") {
    const from = (await loadPeople(service, [call.caller_id])).get(call.caller_id);
    await notifyBell(service, { userIds: [call.callee_id], actorId: call.caller_id, type: "call_missed", title: `Missed ${call.kind} call from ${from?.name ?? "someone"}`, href: `/pulse/messages?c=${call.conversation_id}`, dedupeKey: `call-missed:${call.id}` });
  }
}

/** Closes calls that can no longer be in progress (a closed tab, a dropped connection) so nobody stays "busy". */
async function closeStale(service: Service, userIds: string[]): Promise<void> {
  const ids = userIds.join(",");
  const { data } = await untyped(service).from("calls").select(COLUMNS).in("status", ["ringing", "accepted"]).or(`caller_id.in.(${ids}),callee_id.in.(${ids})`);
  for (const c of (data ?? []) as CallRow[]) if (!isLive(c)) await finalize(service, c, c.status === "ringing" ? "missed" : "ended");
}

async function busy(service: Service, userId: string): Promise<boolean> {
  const db = untyped(service);
  const { data } = await db.from("calls").select(COLUMNS).in("status", ["ringing", "accepted"]).or(`caller_id.eq.${userId},callee_id.eq.${userId}`);
  if (((data ?? []) as CallRow[]).some((c) => isLive(c))) return true;
  // someone added to a group call is busy too, even though they are neither its caller nor its first callee
  const { data: mine } = await db.from("call_participants").select("call_id").eq("user_id", userId).in("status", ["ringing", "joined"]);
  const ids = ((mine ?? []) as { call_id: string }[]).map((r) => r.call_id);
  if (ids.length === 0) return false;
  const { data: calls } = await db.from("calls").select(COLUMNS).in("id", ids).in("status", ["ringing", "accepted"]);
  return ((calls ?? []) as CallRow[]).some((c) => isLive(c));
}

interface ParticipantRow { user_id: string; status: ParticipantStatus }
async function loadParticipants(service: Service, callId: string): Promise<ParticipantRow[]> {
  const { data } = await untyped(service).from("call_participants").select("user_id, status").eq("call_id", callId);
  return (data ?? []) as ParticipantRow[];
}
const asLike = (rows: ParticipantRow[]) => rows.map((r) => ({ userId: r.user_id, status: r.status }));

/** Tells everyone in the call who is in it and who is still being rung. */
async function broadcastParticipants(service: Service, callId: string): Promise<void> {
  const rows = await loadParticipants(service, callId);
  const people = await loadPeople(service, rows.map((r) => r.user_id));
  const list = rows.map((r) => ({ id: r.user_id, status: r.status, name: people.get(r.user_id)?.name ?? null, avatarUrl: people.get(r.user_id)?.avatarUrl ?? null }));
  await notify(service, rows.filter((r) => r.status === "joined").map((r) => r.user_id), "call", { type: "participants", callId, participants: list });
}

export async function startCall(service: Service, me: string, otherId: string, kind: CallKind): Promise<CallResult<{ call: CallInfo }>> {
  if (otherId === me) return fail(400, "You can't call yourself.");
  if (!livekitConfig()) return fail(503, "Calls aren't available right now. Please try again later.");
  await closeStale(service, [me, otherId]);
  const [conversation, blocked, callerBusy, calleeBusy] = await Promise.all([conversationBetween(service, me, otherId), blockedWith(service, me), busy(service, me), busy(service, otherId)]);
  const verdict = canStartCall({ conversationStatus: conversation?.status ?? null, blocked: blocked.has(otherId), callerBusy, calleeBusy });
  if (!verdict.allow || !conversation) return fail(verdict.allow ? 403 : calleeBusy || callerBusy ? 409 : 403, verdict.allow ? "You can't call this person." : verdict.message);

  const { data, error } = await untyped(service).from("calls").insert({ conversation_id: conversation.id, caller_id: me, callee_id: otherId, kind }).select(COLUMNS).single();
  if (error || !data) return fail(500, "Couldn't start the call. Please try again.");
  const call = data as CallRow;
  await untyped(service).from("call_participants").insert([
    { call_id: call.id, user_id: me, status: "joined", joined_at: new Date().toISOString() },
    { call_id: call.id, user_id: otherId, invited_by: me, status: "ringing" },
  ]);
  const from = (await loadPeople(service, [me])).get(me) as PersonSummary | undefined;
  await notify(service, [otherId], "call", { type: "incoming", call: info(call), from });
  // the live ring only reaches an open tab; the bell keeps a record for anyone who was away
  await notifyBell(service, { userIds: [otherId], actorId: me, type: "call_incoming", title: `${from?.name ?? "Someone"} is calling you`, body: `${kind === "video" ? "Video" : "Voice"} call. Open Messages to call back.`, href: `/pulse/messages?c=${conversation.id}`, dedupeKey: `call:${call.id}` });
  return { ok: true, call: info(call) };
}

/** Someone added to a call who is not its caller or first callee answers (or turns down) the invitation. */
async function respondAsInvitee(service: Service, me: string, call: CallRow, action: "accept" | "decline"): Promise<CallResult<{ call: CallInfo }> | null> {
  const mine = (await loadParticipants(service, call.id)).find((r) => r.user_id === me);
  if (!mine) return null;
  if (call.status !== "accepted" || !isLive(call)) return fail(410, "This call has ended.");
  if (mine.status !== "ringing") return fail(409, "You've already answered this call.");
  const next = action === "accept" ? "joined" : "declined";
  await untyped(service).from("call_participants").update({ status: next, joined_at: action === "accept" ? new Date().toISOString() : null }).eq("call_id", call.id).eq("user_id", me);
  if (action === "accept") await notify(service, [me], "call", { type: "handled", callId: call.id });
  await broadcastParticipants(service, call.id);
  return { ok: true, call: info(call) };
}

export async function respondToCall(service: Service, me: string, callId: string, action: "accept" | "decline"): Promise<CallResult<{ call: CallInfo }>> {
  const call = await loadCall(service, callId);
  if (!call) return fail(404, "Call not found.");
  if (me !== call.caller_id && me !== call.callee_id) {
    const invited = await respondAsInvitee(service, me, call, action);
    return invited ?? fail(404, "Call not found.");
  }
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
    await untyped(service).from("call_participants").update({ status: "joined", joined_at: new Date().toISOString() }).eq("call_id", callId).eq("user_id", call.callee_id);
    await notify(service, [call.caller_id], "call", { type: "accepted", callId });
    await notify(service, [call.callee_id], "call", { type: "handled", callId });
    return { ok: true, call: info(call) };
  }
  await finalize(service, call, "declined");
  return { ok: true, call: info(call) };
}

/**
 * Hang up, or cancel a ring that has not been answered. In a call that is under way, leaving only takes you out of it: the others carry on,
 * and the call ends for everyone once fewer than two people are left in it.
 */
export async function endCall(service: Service, me: string, callId: string): Promise<CallResult> {
  const call = await loadCall(service, callId);
  if (!call) return fail(404, "Call not found.");
  if (call.status === "accepted") {
    const rows = await loadParticipants(service, callId);
    const mine = rows.find((r) => r.user_id === me);
    if (!mine && me !== call.caller_id && me !== call.callee_id) return fail(404, "Call not found.");
    if (shouldEnd(asLike(rows), me)) {
      await finalize(service, call, "ended");
    } else {
      await untyped(service).from("call_participants").update({ status: "left", left_at: new Date().toISOString() }).eq("call_id", callId).eq("user_id", me);
      await broadcastParticipants(service, callId);
    }
    return { ok: true };
  }
  const action: CallAction = "end";
  const t = transition({ status: call.status, callerId: call.caller_id, calleeId: call.callee_id }, me, action);
  if (!t.ok) return fail(409, t.message);
  await finalize(service, call, t.status);
  return { ok: true };
}

/** A short-lived token for one person to join the call's room, only if they are in the call and it is under way. */
export async function issueCallToken(service: Service, me: string, callId: string): Promise<CallResult<{ token: string; url: string }>> {
  const config = livekitConfig();
  if (!config) return fail(503, "Calls aren't available right now. Please try again later.");
  const call = await loadCall(service, callId);
  const mine = call ? (await loadParticipants(service, callId)).find((r) => r.user_id === me) : null;
  if (!call || !mine) return fail(404, "Call not found.");
  if (call.status !== "accepted" || !isLive(call) || mine.status !== "joined") return fail(409, "This call isn't in progress.");
  const name = (await loadPeople(service, [me])).get(me)?.name ?? null;
  return { ok: true, token: await mintCallToken(config, { callId, identity: me, name }), url: config.url };
}

/** Anyone in a call under way can add people to it. Each is rung like a normal call; those who cannot be added are reported, not silently dropped. */
export async function inviteToCall(service: Service, me: string, callId: string, userIds: string[]): Promise<CallResult<{ invited: string[]; skipped: { userId: string; message: string }[] }>> {
  const call = await loadCall(service, callId);
  const rows = call ? await loadParticipants(service, callId) : [];
  if (!call || !rows.some((r) => r.user_id === me && r.status === "joined")) return fail(404, "Call not found.");
  if (call.status !== "accepted" || !isLive(call)) return fail(409, "This call isn't in progress.");

  const blocked = await blockedWith(service, me);
  const from = (await loadPeople(service, [me])).get(me) as PersonSummary | undefined;
  const invited: string[] = [];
  const skipped: { userId: string; message: string }[] = [];
  let participants = asLike(rows);
  for (const id of [...new Set(userIds)]) {
    const verdict = inviteVerdict({ candidate: id, me, participants, blocked: blocked.has(id), busy: await busy(service, id) });
    if (!verdict.allow) { skipped.push({ userId: id, message: INVITE_MESSAGE[verdict.reason] }); continue; }
    const { error } = await untyped(service).from("call_participants").upsert({ call_id: callId, user_id: id, invited_by: me, status: "ringing", invited_at: new Date().toISOString(), joined_at: null, left_at: null }, { onConflict: "call_id,user_id" });
    if (error) { skipped.push({ userId: id, message: "Couldn't add them. Try again." }); continue; }
    participants = [...participants.filter((p) => p.userId !== id), { userId: id, status: "ringing" }];
    invited.push(id);
    await notify(service, [id], "call", { type: "incoming", call: info(call), from, group: true });
    await notifyBell(service, { userIds: [id], actorId: me, type: "call_incoming", title: `${from?.name ?? "Someone"} added you to a call`, body: "Open Capabilio to join.", href: "/pulse/messages", dedupeKey: `call-invite:${callId}:${id}:${Math.floor(Date.now() / 60000)}` });
  }
  if (invited.length) await broadcastParticipants(service, callId);
  return { ok: true, invited, skipped };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith } from "./graph";
import { decideSend, pairOf, previewOf, sideOf, type ConversationStatus } from "./message-rules";
import { loadPeople, type PersonSummary } from "./people";

type Service = SupabaseClient<Database>;

export const MAX_BODY = 2000;
export const THREAD_PAGE = 50;
const LIST_LIMIT = 50;

export interface MessageItem {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  deleted: boolean;
  /** "call" is the line left in the conversation by a voice or video call */
  kind: "text" | "call";
}
export interface ConversationItem {
  id: string;
  other: PersonSummary;
  status: ConversationStatus;
  /** a pending request from the other person that is waiting for me */
  incomingRequest: boolean;
  /** a pending request I sent */
  outgoingRequest: boolean;
  /** I started this conversation (matters once a request is declined: only the other side may reopen it) */
  requestedByMe: boolean;
  lastMessageAt: string;
  preview: string | null;
  lastFromMe: boolean;
  unread: number;
}

interface ConvoRow {
  id: string;
  user_lo: string;
  user_hi: string;
  requested_by: string;
  status: ConversationStatus;
  last_message_at: string;
  last_message_preview: string | null;
  last_sender_id: string | null;
}
interface MessageRow {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  kind?: "text" | "call";
}
const CONVO_COLUMNS = "id, user_lo, user_hi, requested_by, status, last_message_at, last_message_preview, last_sender_id";

export const toMessage = (m: MessageRow): MessageItem => ({ id: m.id, senderId: m.sender_id, body: m.deleted_at ? "" : m.body, createdAt: m.created_at, deleted: Boolean(m.deleted_at), kind: m.kind ?? "text" });

/** Tells the people involved, over each one's private channel. A delivery failure never fails the write: clients also refresh on focus. */
export async function notify(service: Service, userIds: string[], event: string, payload: Record<string, unknown>): Promise<void> {
  await Promise.all(
    [...new Set(userIds)].map(async (id) => {
      const { error } = await service.rpc("pulse_notify" as never, { p_user: id, p_event: event, p_payload: payload } as never);
      if (error) console.error("[pulse-messages] notify failed:", (error as { message?: string }).message);
    })
  );
}

async function findConversation(service: Service, a: string, b: string): Promise<ConvoRow | null> {
  const { lo, hi } = pairOf(a, b);
  const { data } = await untyped(service).from("dm_conversations").select(CONVO_COLUMNS).eq("user_lo", lo).eq("user_hi", hi).maybeSingle();
  return (data as ConvoRow | null) ?? null;
}

/** A conversation the caller belongs to, or null (the caller answers 404 — never reveal that someone else's exists). */
async function ownConversation(service: Service, me: string, id: string): Promise<(ConvoRow & { other: string }) | null> {
  const { data } = await untyped(service).from("dm_conversations").select(CONVO_COLUMNS).eq("id", id).maybeSingle();
  const row = data as ConvoRow | null;
  const side = row ? sideOf(row, me) : null;
  return row && side ? { ...row, other: side.other } : null;
}

export type SendResult = { ok: true; conversationId: string; status: ConversationStatus; message: MessageItem } | { ok: false; status: number; message: string };

export async function sendMessage(service: Service, me: string, otherId: string, rawBody: string, attempt = 0): Promise<SendResult> {
  const body = rawBody.trim();
  if (body.length < 1 || body.length > MAX_BODY) return { ok: false, status: 400, message: `Write a message of up to ${MAX_BODY} characters.` };
  if (otherId === me) return { ok: false, status: 400, message: "You can't message yourself." };
  const db = untyped(service);
  const [{ data: other }, blocked, { data: edge }, convo] = await Promise.all([
    service.from("profiles").select("id").eq("id", otherId).maybeSingle(),
    blockedWith(service, me),
    db.from("follows").select("follower_id").eq("follower_id", otherId).eq("followee_id", me).maybeSingle(),
    findConversation(service, me, otherId),
  ]);
  if (!other) return { ok: false, status: 404, message: "That person doesn't exist." };

  let requesterMessages = 0;
  if (convo && convo.status === "pending" && convo.requested_by === me) {
    const { count } = await db.from("dm_messages").select("id", { count: "exact", head: true }).eq("conversation_id", convo.id).eq("sender_id", me);
    requesterMessages = count ?? 0;
  }
  const decision = decideSend({
    me, blocked: blocked.has(otherId), recipientFollowsMe: Boolean(edge),
    conversation: convo ? { status: convo.status, requestedBy: convo.requested_by, requesterMessages } : null,
  });
  if (!decision.allow) return { ok: false, status: 403, message: decision.message };

  let conversationId = convo?.id;
  if (!conversationId) {
    const { lo, hi } = pairOf(me, otherId);
    const { data: created, error } = await db.from("dm_conversations").insert({ user_lo: lo, user_hi: hi, requested_by: me, status: decision.status }).select("id").single();
    if (error || !created) {
      // two people starting at once: the other insert won; decide again against it
      if (attempt === 0 && (await findConversation(service, me, otherId))) return sendMessage(service, me, otherId, rawBody, 1);
      return { ok: false, status: 500, message: "Couldn't send. Please try again." };
    }
    conversationId = (created as { id: string }).id;
  }

  const { data: row, error: insertError } = await db.from("dm_messages").insert({ conversation_id: conversationId, sender_id: me, body }).select("id, sender_id, body, created_at, deleted_at, kind").single();
  if (insertError || !row) return { ok: false, status: 500, message: "Couldn't send. Please try again." };
  const message = toMessage(row as MessageRow);
  await Promise.all([
    db.from("dm_conversations").update({ status: decision.status, last_message_at: message.createdAt, last_message_preview: previewOf(body), last_sender_id: me }).eq("id", conversationId),
    db.from("dm_reads").upsert({ conversation_id: conversationId, user_id: me, last_read_at: message.createdAt }, { onConflict: "conversation_id,user_id" }),
  ]);
  await notify(service, [me, otherId], "message", { conversationId, status: decision.status, message });
  return { ok: true, conversationId, status: decision.status, message };
}

export async function listConversations(service: Service, me: string): Promise<ConversationItem[]> {
  const db = untyped(service);
  const [{ data }, blocked] = await Promise.all([
    db.from("dm_conversations").select(CONVO_COLUMNS).or(`user_lo.eq.${me},user_hi.eq.${me}`).order("last_message_at", { ascending: false }).limit(LIST_LIMIT),
    blockedWith(service, me),
  ]);
  const rows = ((data ?? []) as ConvoRow[]).flatMap((c) => {
    const side = sideOf(c, me);
    return side && !blocked.has(side.other) ? [{ ...c, other: side.other }] : [];
  });
  if (rows.length === 0) return [];
  const [people, { data: reads }] = await Promise.all([
    loadPeople(service, rows.map((r) => r.other)),
    db.from("dm_reads").select("conversation_id, last_read_at").eq("user_id", me).in("conversation_id", rows.map((r) => r.id)),
  ]);
  const readAt = new Map(((reads ?? []) as { conversation_id: string; last_read_at: string }[]).map((r) => [r.conversation_id, r.last_read_at]));
  const unread = await Promise.all(
    rows.map(async (r) => {
      if (r.status === "declined" || r.last_sender_id === me || r.last_sender_id === null) return 0;
      let q = db.from("dm_messages").select("id", { count: "exact", head: true }).eq("conversation_id", r.id).eq("kind", "text").neq("sender_id", me).is("deleted_at", null);
      const seen = readAt.get(r.id);
      if (seen) q = q.gt("created_at", seen);
      return (await q).count ?? 0;
    })
  );
  return rows.flatMap((r, i) => {
    const other = people.get(r.other);
    if (!other) return [];
    return [{
      id: r.id, other, status: r.status,
      incomingRequest: r.status === "pending" && r.requested_by !== me,
      outgoingRequest: r.status === "pending" && r.requested_by === me, requestedByMe: r.requested_by === me,
      lastMessageAt: r.last_message_at, preview: r.last_message_preview, lastFromMe: r.last_sender_id === me, unread: unread[i],
    } satisfies ConversationItem];
  });
}

export interface Thread {
  conversation: ConversationItem;
  messages: MessageItem[];
  /** when the other person last read the thread, for "Seen" */
  otherReadAt: string | null;
  nextCursor: string | null;
}

/** One page of a thread (oldest first), for a member of the conversation only. */
export async function loadThread(service: Service, me: string, conversationId: string, before: string | null): Promise<Thread | null> {
  const row = await ownConversation(service, me, conversationId);
  if (!row || (await blockedWith(service, me)).has(row.other)) return null;
  const db = untyped(service);
  let q = db.from("dm_messages").select("id, sender_id, body, created_at, deleted_at, kind").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(THREAD_PAGE + 1);
  if (before) q = q.lt("created_at", before);
  const [{ data }, { data: theirRead }, list] = await Promise.all([
    q,
    db.from("dm_reads").select("last_read_at").eq("conversation_id", conversationId).eq("user_id", row.other).maybeSingle(),
    listConversations(service, me),
  ]);
  const rows = (data ?? []) as MessageRow[];
  const page = rows.slice(0, THREAD_PAGE);
  const conversation = list.find((c) => c.id === conversationId);
  if (!conversation) return null;
  return {
    conversation,
    messages: page.map(toMessage).reverse(),
    otherReadAt: (theirRead as { last_read_at: string } | null)?.last_read_at ?? null,
    nextCursor: rows.length > THREAD_PAGE ? page[page.length - 1].created_at : null,
  };
}

export async function markRead(service: Service, me: string, conversationId: string): Promise<boolean> {
  const row = await ownConversation(service, me, conversationId);
  if (!row) return false;
  const at = new Date().toISOString();
  const { error } = await untyped(service).from("dm_reads").upsert({ conversation_id: conversationId, user_id: me, last_read_at: at }, { onConflict: "conversation_id,user_id" });
  if (error) return false;
  await notify(service, [row.other], "read", { conversationId, userId: me, at });
  return true;
}

export type RespondResult = { ok: true; status: ConversationStatus } | { ok: false; status: number; message: string };

/** Accept or decline a pending request. Only the person it was sent to may answer. */
export async function respondToRequest(service: Service, me: string, conversationId: string, action: "accept" | "decline"): Promise<RespondResult> {
  const row = await ownConversation(service, me, conversationId);
  if (!row) return { ok: false, status: 404, message: "Conversation not found." };
  if (row.requested_by === me || row.status === "accepted") return { ok: false, status: 409, message: "There's no request to answer here." };
  const status: ConversationStatus = action === "accept" ? "accepted" : "declined";
  const { error } = await untyped(service).from("dm_conversations").update({ status }).eq("id", conversationId);
  if (error) return { ok: false, status: 500, message: "Couldn't update the request. Please try again." };
  await notify(service, [me, row.other], "conversation", { conversationId, status });
  return { ok: true, status };
}

/** Removes your own message: its text is cleared and the thread shows "message deleted". */
export async function deleteMessage(service: Service, me: string, messageId: string): Promise<boolean> {
  const db = untyped(service);
  const { data } = await db.from("dm_messages").select("id, conversation_id").eq("id", messageId).eq("sender_id", me).is("deleted_at", null).maybeSingle();
  const msg = data as { id: string; conversation_id: string } | null;
  const row = msg ? await ownConversation(service, me, msg.conversation_id) : null;
  if (!msg || !row) return false;
  const { error } = await db.from("dm_messages").update({ deleted_at: new Date().toISOString(), body: "" }).eq("id", messageId);
  if (error) return false;
  await notify(service, [me, row.other], "deleted", { conversationId: msg.conversation_id, messageId });
  return true;
}

export interface MessagingSummary {
  unread: number;
  requests: number;
}
export async function messagingSummary(service: Service, me: string): Promise<MessagingSummary> {
  const list = await listConversations(service, me);
  return { unread: list.filter((c) => c.status === "accepted").reduce((n, c) => n + c.unread, 0), requests: list.filter((c) => c.incomingRequest).length };
}

/** The conversation between two people and its state, or null. Used to decide whether they may call. */
export async function conversationBetween(service: Service, a: string, b: string): Promise<{ id: string; status: ConversationStatus } | null> {
  const row = await findConversation(service, a, b);
  return row ? { id: row.id, status: row.status } : null;
}

/** The existing conversation with someone, if any, so a "Message" button can open it instead of starting a new one. */
export async function conversationWith(service: Service, me: string, otherId: string): Promise<string | null> {
  return (await findConversation(service, me, otherId))?.id ?? null;
}

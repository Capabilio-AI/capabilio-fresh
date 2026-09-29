import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { untyped } from "./db";

export interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  unread: number;
}

export interface ChatMessage {
  id: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

export const GENERAL_CHANNEL = "General";
export const MESSAGE_PAGE = 100;

interface ChannelRow {
  id: string;
  institution_id: string;
  name: string;
  description: string | null;
  is_private: boolean;
}

/** Every college has a General channel; it is created the first time anyone opens chat. */
async function ensureGeneral(service: SupabaseClient<Database>, ctx: OrgContext): Promise<void> {
  const db = untyped(service);
  const { data } = await db.from("org_chat_channels").select("id").eq("institution_id", ctx.institutionId).ilike("name", GENERAL_CHANNEL).maybeSingle();
  if (!data) {
    await db.from("org_chat_channels").insert({ institution_id: ctx.institutionId, name: GENERAL_CHANNEL, description: "Everyone on the team", is_private: false, created_by_membership_id: ctx.membershipId });
  }
}

/** The channels this member can see: every open channel of their college, plus private ones they were added to. */
export async function listChannels(service: SupabaseClient<Database>, ctx: OrgContext): Promise<ChatChannel[]> {
  await ensureGeneral(service, ctx);
  const db = untyped(service);
  const [{ data: all }, { data: mine }, { data: reads }] = await Promise.all([
    db.from("org_chat_channels").select("id, institution_id, name, description, is_private").eq("institution_id", ctx.institutionId).order("created_at"),
    db.from("org_chat_channel_members").select("channel_id").eq("user_id", ctx.userId),
    db.from("org_chat_reads").select("channel_id, last_read_at").eq("user_id", ctx.userId),
  ]);
  const memberOf = new Set(((mine ?? []) as { channel_id: string }[]).map((m) => m.channel_id));
  const readAt = new Map(((reads ?? []) as { channel_id: string; last_read_at: string }[]).map((r) => [r.channel_id, r.last_read_at]));
  const visible = ((all ?? []) as ChannelRow[]).filter((c) => !c.is_private || memberOf.has(c.id));

  const channels: ChatChannel[] = [];
  for (const c of visible) {
    let q = db.from("org_chat_messages").select("id", { count: "exact", head: true }).eq("channel_id", c.id).neq("author_user_id", ctx.userId);
    const since = readAt.get(c.id);
    if (since) q = q.gt("created_at", since);
    const { count } = await q;
    channels.push({ id: c.id, name: c.name, description: c.description, isPrivate: c.is_private, unread: count ?? 0 });
  }
  return channels;
}

/** Same-college and (if private) a member — the only test that lets anyone read or post in a channel. */
export async function canAccessChannel(service: SupabaseClient<Database>, ctx: OrgContext, channelId: string): Promise<ChannelRow | null> {
  const db = untyped(service);
  const { data } = await db.from("org_chat_channels").select("id, institution_id, name, description, is_private").eq("id", channelId).eq("institution_id", ctx.institutionId).maybeSingle();
  const channel = data as ChannelRow | null;
  if (!channel) return null;
  if (!channel.is_private) return channel;
  const { data: member } = await db.from("org_chat_channel_members").select("user_id").eq("channel_id", channel.id).eq("user_id", ctx.userId).maybeSingle();
  return member ? channel : null;
}

export async function loadMessages(service: SupabaseClient<Database>, channelId: string, after?: string): Promise<ChatMessage[]> {
  const db = untyped(service);
  let q = db.from("org_chat_messages").select("id, author_user_id, body, created_at").eq("channel_id", channelId);
  q = after ? q.gt("created_at", after).order("created_at", { ascending: true }).limit(MESSAGE_PAGE) : q.order("created_at", { ascending: false }).limit(MESSAGE_PAGE);
  const rows = ((await q).data ?? []) as { id: string; author_user_id: string | null; body: string; created_at: string }[];
  const ordered = after ? rows : rows.reverse();
  const ids = [...new Set(ordered.map((r) => r.author_user_id).filter((x): x is string => Boolean(x)))];
  const { data: profiles } = ids.length ? await service.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  return ordered.map((r) => ({ id: r.id, authorId: r.author_user_id, authorName: r.author_user_id ? (names.get(r.author_user_id) ?? "Team member") : "Former member", body: r.body, createdAt: r.created_at }));
}

export async function markRead(service: SupabaseClient<Database>, ctx: OrgContext, channelId: string): Promise<void> {
  await untyped(service).from("org_chat_reads").upsert({ channel_id: channelId, user_id: ctx.userId, last_read_at: new Date().toISOString() });
}

/** Staff of the college who hold the chat permission — the people a private channel can include. */
export async function listChatMembers(service: SupabaseClient<Database>, ctx: OrgContext): Promise<{ userId: string; name: string }[]> {
  const db = untyped(service);
  const { data } = await db.from("institution_memberships").select("user_id, role, permissions").eq("institution_id", ctx.institutionId).eq("status", "active").neq("role", "student");
  const { effectivePermissions } = await import("./roles");
  const rows = ((data ?? []) as { user_id: string; role: string; permissions: string[] | null }[]).filter((m) => effectivePermissions(m.role, m.permissions).has("chat") && m.user_id !== ctx.userId);
  if (rows.length === 0) return [];
  const { data: profiles } = await service.from("profiles").select("id, full_name, email").in("id", rows.map((r) => r.user_id));
  return (profiles ?? []).map((p) => ({ userId: p.id, name: p.full_name ?? p.email })).sort((a, b) => a.name.localeCompare(b.name));
}

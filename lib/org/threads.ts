import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { untyped } from "./db";

export interface Thread {
  id: string;
  otherId: string;
  otherName: string;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

export interface ThreadMessage {
  id: string;
  authorId: string | null;
  authorName: string;
  /** the author's side: our own organisation or the other one */
  mine: boolean;
  body: string;
  createdAt: string;
}

export const THREAD_PAGE = 100;

/** The two sides of a thread are always one college and one company. */
export const sideOf = (ctx: Pick<OrgContext, "kind">): "college" | "company" => (ctx.kind === "company" ? "company" : "college");

interface ThreadRow {
  id: string;
  college_id: string;
  company_id: string;
}

/** The thread between this organisation and `otherId`, created on first use. */
export async function getOrCreateThread(service: SupabaseClient<Database>, ctx: Pick<OrgContext, "kind" | "institutionId">, otherId: string): Promise<string> {
  const db = untyped(service);
  const pair = ctx.kind === "company" ? { college_id: otherId, company_id: ctx.institutionId } : { college_id: ctx.institutionId, company_id: otherId };
  const found = await db.from("org_threads").select("id").match(pair).maybeSingle();
  if (found.data) return (found.data as { id: string }).id;
  const made = await db.from("org_threads").insert(pair).select("id").single();
  if (made.data) return (made.data as { id: string }).id;
  // lost a race with the other side creating it
  const again = await db.from("org_threads").select("id").match(pair).single();
  if (again.error) throw new Error(`Thread create failed: ${again.error.message}`);
  return (again.data as { id: string }).id;
}

/** The thread only if this organisation is one of its two sides. Anyone else gets null (answer 404, never reveal it exists). */
export async function ownThread(service: SupabaseClient<Database>, ctx: Pick<OrgContext, "kind" | "institutionId">, threadId: string): Promise<(ThreadRow & { otherId: string }) | null> {
  const { data } = await untyped(service).from("org_threads").select("id, college_id, company_id").eq("id", threadId).maybeSingle();
  const row = data as ThreadRow | null;
  if (!row) return null;
  const mine = ctx.kind === "company" ? row.company_id : row.college_id;
  if (mine !== ctx.institutionId) return null;
  return { ...row, otherId: ctx.kind === "company" ? row.college_id : row.company_id };
}

export async function listThreads(service: SupabaseClient<Database>, ctx: OrgContext): Promise<Thread[]> {
  const db = untyped(service);
  const mineCol = ctx.kind === "company" ? "company_id" : "college_id";
  const { data } = await db.from("org_threads").select("id, college_id, company_id").eq(mineCol, ctx.institutionId);
  const threads = (data ?? []) as ThreadRow[];
  if (threads.length === 0) return [];
  const otherOf = (t: ThreadRow) => (ctx.kind === "company" ? t.college_id : t.company_id);
  const [{ data: names }, { data: reads }] = await Promise.all([
    service.from("institutions").select("id, name").in("id", threads.map(otherOf)),
    db.from("org_thread_reads").select("thread_id, last_read_at").eq("user_id", ctx.userId),
  ]);
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.name]));
  const readAt = new Map(((reads ?? []) as { thread_id: string; last_read_at: string }[]).map((r) => [r.thread_id, r.last_read_at]));
  const out = await Promise.all(
    threads.map(async (t): Promise<Thread> => {
      const { data: last } = await db.from("org_thread_messages").select("body, created_at").eq("thread_id", t.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      let q = db.from("org_thread_messages").select("id", { count: "exact", head: true }).eq("thread_id", t.id).neq("author_institution_id", ctx.institutionId);
      const since = readAt.get(t.id);
      if (since) q = q.gt("created_at", since);
      const { count } = await q;
      const l = last as { body: string; created_at: string } | null;
      return { id: t.id, otherId: otherOf(t), otherName: nameOf.get(otherOf(t)) ?? "Unknown", lastBody: l?.body ?? null, lastAt: l?.created_at ?? null, unread: count ?? 0 };
    })
  );
  return out.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
}

export async function loadThreadMessages(service: SupabaseClient<Database>, ctx: Pick<OrgContext, "institutionId" | "userId">, threadId: string, after?: string): Promise<ThreadMessage[]> {
  const db = untyped(service);
  let q = db.from("org_thread_messages").select("id, author_user_id, author_institution_id, body, created_at").eq("thread_id", threadId);
  q = after ? q.gt("created_at", after).order("created_at", { ascending: true }).limit(THREAD_PAGE) : q.order("created_at", { ascending: false }).limit(THREAD_PAGE);
  const { data, error } = await q;
  if (error) throw new Error(`Messages load failed: ${error.message}`);
  const rows = (data ?? []) as { id: string; author_user_id: string | null; author_institution_id: string; body: string; created_at: string }[];
  const ordered = after ? rows : rows.reverse();
  const ids = [...new Set(ordered.map((r) => r.author_user_id).filter((x): x is string => Boolean(x)))];
  const { data: profiles } = ids.length ? await service.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  return ordered.map((r) => ({ id: r.id, authorId: r.author_user_id, authorName: r.author_user_id ? (names.get(r.author_user_id) ?? "Team member") : "Former member", mine: r.author_institution_id === ctx.institutionId, body: r.body, createdAt: r.created_at }));
}

export async function markThreadRead(service: SupabaseClient<Database>, userId: string, threadId: string): Promise<void> {
  await untyped(service).from("org_thread_reads").upsert({ thread_id: threadId, user_id: userId, last_read_at: new Date().toISOString() });
}

/** Everyone on an organisation who should hear about a new request or message. */
export async function staffToNotify(service: SupabaseClient<Database>, institutionId: string, side: "college" | "company"): Promise<string[]> {
  const q = untyped(service).from("institution_memberships").select("user_id, role, permissions").eq("institution_id", institutionId).eq("status", "active").neq("role", "student");
  const { data } = await q;
  const { effectivePermissions } = await import("./roles");
  return ((data ?? []) as { user_id: string; role: string; permissions: string[] | null }[])
    .filter((m) => side === "company" || effectivePermissions(m.role, m.permissions).has("placements"))
    .map((m) => m.user_id);
}

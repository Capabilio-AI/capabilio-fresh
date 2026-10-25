import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { blockedWith, followingIds } from "@/lib/pulse/graph";
import { loadPeople, type PersonSummary } from "@/lib/pulse/people";
import { untyped } from "./db";

type Service = SupabaseClient<Database>;

export const FOLLOWERS_PAGE = 50;

/** A person who follows a college page, as the viewer sees them: who they are, whether they belong to this college, and whether the viewer follows them. */
export interface Follower extends PersonSummary {
  /** the viewer already follows them on Pulse */
  following: boolean;
  isMe: boolean;
  /** an active member (student or staff) of this college */
  fromThisCollege: boolean;
  followedAt: string;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CURSOR = new RegExp(`^(\\d{4}-\\d{2}-\\d{2}T[0-9:.]+(?:Z|[+-]\\d{2}:?\\d{2}))\\|(${UUID})$`, "i");

/** Pure. A page cursor is the follow time and person of the last row on the previous page. Anything else is not a cursor (it is never put into a query). */
export function parseCursor(raw: string | null | undefined): { at: string; userId: string } | null {
  const m = raw ? CURSOR.exec(raw) : null;
  return m ? { at: m[1], userId: m[2].toLowerCase() } : null;
}

export const cursorOf = (row: { followed_at: string; user_id: string }): string => `${row.followed_at}|${row.user_id}`;

/**
 * The people who follow a college page, newest first, 50 at a time. Blocked people (either way) are left out, and only public profile fields are
 * returned, never an email. The caller has already checked the viewer may see this college.
 */
export async function listOrgFollowers(service: Service, viewerId: string, institutionId: string, cursor: string | null, pageSize: number = FOLLOWERS_PAGE): Promise<{ people: Follower[]; total: number; nextCursor: string | null }> {
  const db = untyped(service);
  const after = parseCursor(cursor);
  let query = db.from("org_follows").select("user_id, followed_at", { count: "exact" }).eq("institution_id", institutionId).order("followed_at", { ascending: false }).order("user_id", { ascending: false }).limit(pageSize + 1);
  if (after) query = query.or(`followed_at.lt.${after.at},and(followed_at.eq.${after.at},user_id.lt.${after.userId})`);
  const [rows, blocked, mine] = await Promise.all([query, blockedWith(service, viewerId), followingIds(service, viewerId)]);

  const all = ((rows.data ?? []) as { user_id: string; followed_at: string }[]);
  const page = all.slice(0, pageSize);
  const nextCursor = all.length > pageSize && page.length > 0 ? cursorOf(page[page.length - 1]) : null;
  const visible = page.filter((r) => !blocked.has(r.user_id));
  const total = rows.count ?? page.length;
  if (visible.length === 0) return { people: [], total, nextCursor };

  const ids = visible.map((r) => r.user_id);
  const [people, members] = await Promise.all([
    loadPeople(service, ids),
    service.from("institution_memberships").select("user_id").eq("institution_id", institutionId).eq("status", "active").in("user_id", ids),
  ]);
  const fromHere = new Set((members.data ?? []).map((m) => m.user_id));
  const followed = new Set(mine);
  return {
    people: visible.flatMap((r) => {
      const p = people.get(r.user_id);
      return p ? [{ ...p, following: followed.has(r.user_id), isMe: r.user_id === viewerId, fromThisCollege: fromHere.has(r.user_id), followedAt: r.followed_at }] : [];
    }),
    total,
    nextCursor,
  };
}

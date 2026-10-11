import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";

export interface Pulse {
  /** Changes whenever anything shown on the portfolio changes; clients compare it and refresh only when it differs. */
  version: string;
  /** When the newest proof of work landed, for the "latest proof" line. */
  latest: string | null;
}

type Row = Record<string, string | null> | null;

/**
 * A tiny fingerprint of everything the portfolio displays: newest row (and count) of each source. Seven one-row reads, so it is cheap to poll.
 * Service client: the caller has already authorised `userId` (owner session or a public portfolio switched on).
 */
export async function portfolioPulse(service: SupabaseClient, userId: string): Promise<Pulse> {
  const db = untyped(service);
  const newest = (table: string, col: string, owner: string, extra?: (q: ReturnType<typeof db.from>) => unknown) => {
    const base = db.from(table).select(col, { count: "exact" }).eq(owner, userId).order(col, { ascending: false, nullsFirst: false }).limit(1);
    return (extra ? extra(base as never) : base) as unknown as PromiseLike<{ data: Row[] | null; count: number | null }>;
  };
  const [elo, attempts, evidence, vault, graph, memberships, profile, github] = await Promise.all([
    newest("elo_events", "created_at", "student_id"),
    newest("challenge_attempts", "submitted_at", "student_id"),
    newest("evidence", "created_at", "user_id"),
    newest("vault_items", "created_at", "user_id"),
    newest("career_skill_graph_snapshots", "created_at", "student_id"),
    newest("institution_memberships", "created_at", "user_id"),
    db.from("profiles").select("updated_at, portfolio_show_contact").eq("id", userId).maybeSingle() as PromiseLike<{ data: Row }>,
    db.from("github_connections").select("last_scanned_at, verification_state").eq("user_id", userId).maybeSingle() as PromiseLike<{ data: Row }>,
  ]);
  const part = (r: { data: Row[] | null; count: number | null }, col: string) => `${r.count ?? 0}:${r.data?.[0]?.[col] ?? ""}`;
  const version = [part(elo, "created_at"), part(attempts, "submitted_at"), part(evidence, "created_at"), part(vault, "created_at"), part(graph, "created_at"), part(memberships, "created_at"),
    profile.data?.updated_at ?? "", profile.data?.portfolio_show_contact ?? "", github.data?.last_scanned_at ?? "", github.data?.verification_state ?? ""].join("|");
  const latest = [elo.data?.[0]?.created_at, attempts.data?.[0]?.submitted_at, evidence.data?.[0]?.created_at].filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
  return { version, latest };
}

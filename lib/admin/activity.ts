import { adminDb, peopleByIds, rowsOf, safe } from "./db";
import { lastDays, perDay } from "./rules";

const DAY = 86_400_000;
const since = (d: number) => new Date(Date.now() - d * DAY).toISOString();

export interface Activity {
  events: { name: string; who: string | null; at: string }[];
  top: { name: string; count: number; users: number }[];
  perDay: { days: string[]; counts: number[] };
  integrity: { kind: string; count: number }[];
  integrityRecent: { who: string | null; kind: string; area: string; n: number; at: string }[];
  ai: { feature: string; calls: number; failures: number; avgMs: number; costCents: number }[];
  aiErrors: { feature: string; error: string | null; at: string }[];
  activeUsers: { day: number; week: number };
}

/** What people are doing in the product (events), how tests are behaving (integrity), and what the AI features cost and how they fail. */
export async function loadActivity(): Promise<Activity> {
  const db = adminDb();
  const [ev, recent, integ, ai] = await Promise.all([
    safe(db.from("product_events").select("name, user_id, created_at").gte("created_at", since(7)).limit(20000), { data: [] } as never, "act.events"),
    safe(db.from("product_events").select("name, user_id, created_at").order("created_at", { ascending: false }).limit(40), { data: [] } as never),
    safe(db.from("integrity_events").select("user_id, area, kind, n, created_at").gte("created_at", since(7)).order("created_at", { ascending: false }).limit(2000), { data: [] } as never),
    safe(db.from("ai_call_log").select("feature, status, latency_ms, cost_cents_estimate, error, created_at").gte("created_at", since(7)).limit(20000), { data: [] } as never),
  ]);
  const events = rowsOf<{ name: string; user_id: string | null; created_at: string }>(ev);
  const recentRows = rowsOf<{ name: string; user_id: string | null; created_at: string }>(recent);
  const integrity = rowsOf<{ user_id: string | null; area: string; kind: string; n: number; created_at: string }>(integ);
  const people = await peopleByIds([...recentRows.map((r) => r.user_id), ...integrity.slice(0, 15).map((r) => r.user_id)].filter((x): x is string => !!x));

  const byName = new Map<string, { count: number; users: Set<string> }>();
  for (const e of events) {
    const cur = byName.get(e.name) ?? { count: 0, users: new Set<string>() };
    cur.count++;
    if (e.user_id) cur.users.add(e.user_id);
    byName.set(e.name, cur);
  }
  const days = lastDays(7);
  const kinds = new Map<string, number>();
  for (const r of integrity) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + (r.n ?? 1));

  const aiRows = rowsOf<{ feature: string; status: string; latency_ms: number | null; cost_cents_estimate: number | null; error: string | null; created_at: string }>(ai);
  const byFeature = new Map<string, { calls: number; failures: number; ms: number; cost: number }>();
  const failed = (s: string) => !!s && !["ok", "success", "completed"].includes(s);
  for (const r of aiRows) {
    const cur = byFeature.get(r.feature) ?? { calls: 0, failures: 0, ms: 0, cost: 0 };
    cur.calls++;
    if (failed(r.status)) cur.failures++;
    cur.ms += r.latency_ms ?? 0;
    cur.cost += Number(r.cost_cents_estimate ?? 0);
    byFeature.set(r.feature, cur);
  }
  const dayAgo = Date.now() - DAY;
  const active = (from: number) => new Set(events.filter((e) => e.user_id && new Date(e.created_at).getTime() >= from).map((e) => e.user_id)).size;
  return {
    events: recentRows.map((r) => ({ name: r.name, who: r.user_id ? people.get(r.user_id)?.name ?? people.get(r.user_id)?.email ?? "Someone" : null, at: r.created_at })),
    top: [...byName].map(([name, v]) => ({ name, count: v.count, users: v.users.size })).sort((a, b) => b.count - a.count).slice(0, 12),
    perDay: { days, counts: perDay(events.map((e) => e.created_at), days) },
    integrity: [...kinds].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    integrityRecent: integrity.slice(0, 15).map((r) => ({ who: r.user_id ? people.get(r.user_id)?.name ?? people.get(r.user_id)?.email ?? null : null, kind: r.kind, area: r.area, n: r.n, at: r.created_at })),
    ai: [...byFeature].map(([feature, v]) => ({ feature, calls: v.calls, failures: v.failures, avgMs: v.calls ? Math.round(v.ms / v.calls) : 0, costCents: Math.round(v.cost) })).sort((a, b) => b.calls - a.calls),
    aiErrors: aiRows.filter((r) => failed(r.status)).slice(0, 8).map((r) => ({ feature: r.feature, error: r.error?.slice(0, 160) ?? null, at: r.created_at })),
    activeUsers: { day: active(dayAgo), week: active(Date.now() - 7 * DAY) },
  };
}

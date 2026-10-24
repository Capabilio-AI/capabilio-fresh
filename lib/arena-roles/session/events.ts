import { z } from "zod";

/**
 * The session log: an append-only list of what happened during a Proof Session, newest last.
 * `source` says who reported it. "server" events come from our own routes (a query we ran, a check we ran, an AI exchange we served) and can be
 * trusted. "client" events are reported by the student's browser (opened the brief, looked at a table) and can be faked, so anything derived
 * from them is labelled lower-trust in the report. Nothing here ever decides pass or fail: that comes only from server-run checks.
 */
const base = { seq: z.number().int().min(1), at: z.string().min(1), stageKey: z.string().min(1), source: z.enum(["server", "client"]) };

export const SessionEvent = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("stage_started") }),
  z.object({ ...base, kind: z.literal("brief_viewed") }),
  z.object({ ...base, kind: z.literal("data_inspected"), target: z.string().min(1).max(120) }),
  z.object({ ...base, kind: z.literal("plan_note"), words: z.number().int().min(0) }),
  z.object({ ...base, kind: z.literal("query_run"), sqlHash: z.string().min(1).max(64), ok: z.boolean() }),
  z.object({ ...base, kind: z.literal("check_run"), passed: z.number().int().min(0), total: z.number().int().min(1) }),
  z.object({ ...base, kind: z.literal("ai_prompt"), chars: z.number().int().min(0) }),
  z.object({ ...base, kind: z.literal("ai_reply"), withheld: z.boolean() }),
  z.object({ ...base, kind: z.literal("submitted"), passed: z.boolean() }),
]);
export type SessionEvent = z.infer<typeof SessionEvent>;

/** Pure. Events for one stage, in order. */
export const forStage = (events: readonly SessionEvent[], stageKey: string): SessionEvent[] => events.filter((e) => e.stageKey === stageKey).sort((a, b) => a.seq - b.seq);

/** Pure. Keeps only valid events, so one malformed row can never break a report. Returns what was dropped so the caller can log it. */
export function parseEvents(rows: unknown[]): { events: SessionEvent[]; dropped: number } {
  const events: SessionEvent[] = [];
  for (const row of rows) {
    const parsed = SessionEvent.safeParse(row);
    if (parsed.success) events.push(parsed.data);
  }
  return { events: events.sort((a, b) => a.seq - b.seq), dropped: rows.length - events.length };
}

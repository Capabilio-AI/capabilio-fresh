import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { INTEGRITY_AREAS, INTEGRITY_KINDS } from "./kinds";

const Count = z.number().int().min(1).max(500);

export const EventsBody = z
  .object({
    area: z.enum(INTEGRITY_AREAS),
    path: z.string().max(200),
    counts: z.object(Object.fromEntries(INTEGRITY_KINDS.map((k) => [k, Count.optional()])) as Record<(typeof INTEGRITY_KINDS)[number], z.ZodOptional<typeof Count>>).strict(),
  })
  .strict();

/** Stores one batch from a student's browser as one row per kind that happened. Returns how many rows were written. */
export async function recordIntegrityBatch(service: SupabaseClient, userId: string, body: z.infer<typeof EventsBody>): Promise<number> {
  const rows = INTEGRITY_KINDS.flatMap((kind) => {
    const n = body.counts[kind];
    return n ? [{ user_id: userId, area: body.area, path: body.path, kind, n }] : [];
  });
  if (rows.length === 0) return 0;
  const { error } = await untyped(service as never).from("integrity_events").insert(rows);
  if (error) throw new Error(`could not store integrity events: ${error.message}`);
  return rows.length;
}

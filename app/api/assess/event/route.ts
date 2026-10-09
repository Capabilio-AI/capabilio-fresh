import { z } from "zod";
import { assessRoute, readJson } from "@/lib/assess/http";
import { CLIENT_EVENTS, track } from "@/lib/assess/db";

const Body = z.object({ name: z.enum(CLIENT_EVENTS as unknown as [string, ...string[]]), props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional() }).strict();

/** Browser-reported analytics, allow-listed: a client can say the banner/popup was seen, nothing that carries scores. */
export const POST = assessRoute("assess_event", 60, async (req, { userId, db }) => {
  const { name, props } = await readJson(req, Body);
  await track(db, userId, name as (typeof CLIENT_EVENTS)[number], props ?? {});
  return { ok: true };
}, { memoryLimit: true });

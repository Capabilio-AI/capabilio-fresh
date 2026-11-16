import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateStructured, type GenerateDeps } from "@/lib/ai/llm";
import type { Stream } from "./stream";
import { STREAM_SUGGESTIONS } from "./stream";

/** Once a stream has this many roles stored, nothing more is generated for it: students are served from the database. */
export const STREAM_ROLES_ENOUGH = 10;
export const STREAM_ROLES_TARGET = 12;

/** The stream's stored career ids in display order. Empty until the stream has been generated, and when the table is not there yet. */
export async function loadStreamRoleIds(db: SupabaseClient, stream: Stream): Promise<string[]> {
  const { data, error } = await db.from("stream_roles").select("career_id").eq("stream", stream).order("position");
  if (error) return [];
  return ((data ?? []) as { career_id: string }[]).map((r) => r.career_id);
}

const TitlesSchema = z.object({ roles: z.array(z.object({ title: z.string().trim().min(3).max(60), kind: z.enum(["it", "core"]).default("core") })).min(4).max(20) });

/** Tidies the model's titles: trims, drops repeats and seniority words, keeps the order. Pure, so it is tested. */
export function cleanTitles(titles: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of titles) {
    const title = raw.replace(/\b(senior|sr\.?|lead|principal|head of|manager)\b/gi, "").replace(/\s+/g, " ").trim();
    const key = title.toLowerCase();
    if (title.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

/** One AI call: entry-level job titles a fresher of this stream can be hired into, mixing roles from software and data with the stream's own core roles. */
export async function proposeStreamTitles(stream: Stream, count = STREAM_ROLES_TARGET, deps: GenerateDeps = {}): Promise<string[]> {
  const label = STREAM_SUGGESTIONS[stream].label;
  const known = STREAM_SUGGESTIONS[stream].roles.join(", ");
  const system = `You advise Indian engineering and degree students on entry-level jobs. Reply with ONE JSON object: {"roles":[{"title","kind"}]}.
Give exactly ${count} different entry-level job titles that a fresher from the stream "${label}" can realistically be hired into in India.
Mix them: about ${stream === "it" ? "all software, data, AI and cloud roles" : "four or five software, data or IT roles that this branch is commonly hired into (kind \"it\"), and the rest core roles of the branch itself (kind \"core\")"}.
Rules: plain, widely used job titles; no company names; no seniority words (no Senior, Lead, Manager); no repeats; each a real job a fresher can start in.`;
  const user = `Stream: ${label}. Roles we already list for it (you may include them, and should add others): ${known || "none"}.`;
  const out = await generateStructured({ task: "role_resolve", system, user, schema: TitlesSchema, temperature: 0.3, maxTokens: 900, promptVersion: "stream-roles.v1" }, deps);
  return cleanTitles(out.value.roles.map((r) => r.title)).slice(0, count);
}

/** Replaces the stream's stored list. Positions follow the order given. */
export async function saveStreamRoles(db: SupabaseClient, stream: Stream, careerIds: readonly string[]): Promise<void> {
  const unique = [...new Set(careerIds)];
  const rows = unique.map((career_id, position) => ({ stream, career_id, position }));
  const { error } = await db.from("stream_roles").upsert(rows, { onConflict: "stream,career_id" });
  if (error) throw error;
}

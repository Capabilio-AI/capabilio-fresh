import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import type { LessonKind } from "./lesson-content";

type Service = SupabaseClient<Database>;

/** Pure. Identifies the prompt a lesson was written from; a stored lesson is reused only while this is unchanged. */
export const promptHash = (system: string, prompt: string): string => createHash("sha256").update(`${system}\n${prompt}`).digest("hex");

/**
 * The lesson for this topic from the database when one was written from the same prompt, otherwise written now and stored for the next student.
 * A stored row that is unreadable or no longer matches the lesson shape is simply written again. Storing never fails the request.
 */
export async function storedOrWritten<T>(
  service: Service,
  key: { careerId: string; nodeKey: string; kind: LessonKind },
  hash: string,
  schema: z.ZodType<T>,
  write: () => Promise<T>
): Promise<{ lesson: T; fromStore: boolean }> {
  const db = untyped(service);
  try {
    const { data } = await db.from("skillstudio_lessons").select("prompt_hash, content").eq("career_id", key.careerId).eq("node_key", key.nodeKey).eq("kind", key.kind).maybeSingle();
    const row = data as { prompt_hash: string; content: unknown } | null;
    const parsed = row && row.prompt_hash === hash ? schema.safeParse(row.content) : null;
    if (parsed?.success) return { lesson: parsed.data, fromStore: true };
  } catch (e) {
    console.error("[skillstudio/lesson-store] read failed:", e instanceof Error ? e.message : e);
  }
  const lesson = await write();
  const { error } = await db.from("skillstudio_lessons").upsert({ career_id: key.careerId, node_key: key.nodeKey, kind: key.kind, prompt_hash: hash, content: lesson, generated_at: new Date().toISOString() }, { onConflict: "career_id,node_key,kind" });
  if (error) console.error("[skillstudio/lesson-store] save failed:", error.message);
  return { lesson, fromStore: false };
}

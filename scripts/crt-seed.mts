// Loads the CRT question bank (lib/crt/content) and training sessions into the database. Safe to run again: a question is matched by its prompt
// and a session by (module, position), so nothing is duplicated and edited sessions are updated in place.
//   npm run crt:seed -- --dry
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { buildBank } from "@/lib/crt/content/bank";
import { SESSIONS } from "@/lib/crt/content/sessions";

const dry = process.argv.includes("--dry");
const bank = buildBank();
const byModule = bank.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.module]: (acc[q.module] ?? 0) + 1 }), {});
console.log(`bank: ${bank.length} questions`, byModule, `| sessions: ${SESSIONS.length}`);
if (dry) process.exit(0);

const db = untyped(createServiceClient());
const { data: existing, error: readError } = await db.from("crt_questions").select("prompt").limit(20000);
if (readError) throw readError;
const have = new Set(((existing ?? []) as { prompt: string }[]).map((r) => r.prompt));
const fresh = bank.filter((q) => !have.has(q.prompt));
for (let i = 0; i < fresh.length; i += 200) {
  const { error } = await db.from("crt_questions").insert(fresh.slice(i, i + 200).map((q) => ({ module: q.module, topic: q.topic, difficulty: q.difficulty, prompt: q.prompt, options: q.options, explanation: q.explanation })));
  if (error) throw error;
}
console.log(`questions: inserted ${fresh.length}, already present ${bank.length - fresh.length}`);

const { error } = await db.from("crt_sessions").upsert(SESSIONS.map((s) => ({ module: s.module, position: s.position, title: s.title, summary: s.summary, minutes: s.minutes, content: s.content, status: "published" })), { onConflict: "module,position" });
if (error) throw error;
console.log(`sessions: upserted ${SESSIONS.length}`);

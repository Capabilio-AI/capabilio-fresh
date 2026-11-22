// Pre-builds verified practice exercises for the language-track lessons, so a student never waits on the model or the runner the first time they open one.
// Each exercise is written by the model, then its reference solution is RUN on the real code runner against every test, and its starter must not already
// solve it; only exercises that pass are kept (lib/practice/verify.ts). Nothing is stored unless you pass --write.
//   npm run exercises:bulk                          dry run over every eligible lesson that has fewer than MIN_STORED exercises
//   npm run exercises:bulk -- --track python        one track
//   npm run exercises:bulk -- --lesson variables-types --track python
//   npm run exercises:bulk -- --limit 5 --write     build and STORE exercises for the first 5 lessons that need them
// Runs one lesson at a time and pauses between them: the shared runner drops parallel requests. Languages the runner cannot verify quickly (Java and C++
// without JUDGE0_URL) are skipped and listed, never stored unverified.
import { createServiceClient } from "@/lib/supabase/service";
import { TRACKS } from "@/lib/languages";
import { allLessons } from "@/lib/languages/types";
import { judge0Configured } from "@/lib/code-execution/judge0";
import { isExerciseLanguage, topicKeyFor } from "@/lib/practice/practice";
import { generateVerified, storeExercises, type TopicInfo } from "@/lib/practice/server";
import { untyped } from "@/lib/org/db";

const MIN_STORED = 3; // a lesson with this many verified exercises is left alone
const PAUSE_MS = 2000;

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const write = process.argv.includes("--write");
const onlyTrack = arg("track");
const onlyLesson = arg("lesson");
const limit = Number(arg("limit") ?? Infinity);

const service = createServiceClient();
const { data } = await untyped(service).from("lesson_exercises").select("topic_key").not("verified_at", "is", null);
const stored = new Map<string, number>();
for (const r of (data ?? []) as { topic_key: string }[]) stored.set(r.topic_key, (stored.get(r.topic_key) ?? 0) + 1);

const todo: TopicInfo[] = [];
const skipped = new Map<string, number>();
for (const track of TRACKS) {
  if (onlyTrack && track.key !== onlyTrack) continue;
  if (!isExerciseLanguage(track.runnerLanguage, judge0Configured())) { skipped.set(track.title, allLessons(track).length); continue; }
  for (const l of allLessons(track)) {
    if (onlyLesson && l.key !== onlyLesson) continue;
    const key = topicKeyFor({ kind: "track", track: track.key, lessonKey: l.key });
    if ((stored.get(key) ?? 0) >= MIN_STORED && !onlyLesson) continue;
    todo.push({ key, title: l.title, summary: l.lesson.summary, language: track.runnerLanguage as TopicInfo["language"] });
  }
}
const batch = todo.slice(0, limit);
console.log(`${write ? "WRITING" : "DRY RUN (nothing stored)"}: ${batch.length} of ${todo.length} lessons need exercises.`);
if (skipped.size) console.log(`Skipped, no runner that can verify them quickly: ${[...skipped].map(([t, n]) => `${t} (${n} lessons)`).join(", ")}. Set JUDGE0_URL to include Java and C++.`);

const rows: { lesson: string; kept: number; dropped: number; stored: string; why: string }[] = [];
for (const topic of batch) {
  try {
    const out = await generateVerified(service, null, topic);
    let wrote = "no";
    if (write && out.kept.length > 0) { await storeExercises(service, topic, out.kept); wrote = "yes"; }
    rows.push({ lesson: topic.key.replace("track:", ""), kept: out.kept.length, dropped: out.dropped.length, stored: wrote, why: out.dropped.map((d) => `${d.infra ? "[runner] " : ""}${d.reason}`).join(" | ").slice(0, 120) });
  } catch (e) {
    rows.push({ lesson: topic.key.replace("track:", ""), kept: 0, dropped: 0, stored: "no", why: `generation failed: ${(e as Error).message.slice(0, 100)}` });
  }
  await new Promise((r) => setTimeout(r, PAUSE_MS));
}
console.table(rows);
const kept = rows.reduce((n, r) => n + r.kept, 0);
console.log(`${kept} verified exercises from ${rows.length} lessons; ${rows.filter((r) => r.kept === 0).length} lessons produced none.${write ? "" : " Re-run with --write to store them."}`);

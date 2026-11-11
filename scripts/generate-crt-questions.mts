// Writes original soft-skills and verbal questions with a model, then has an independent second call answer each one WITHOUT seeing the key.
// A question is stored only when that answer agrees (soft skills: same best and same worst response; verbal: same option). Nothing unchecked is stored.
//   npm run crt:generate -- --module soft_skills --batches 5            dry run: generates and checks, writes nothing
//   npm run crt:generate -- --module verbal --batches 10 --apply        adds the checked questions
//   options: --module soft_skills|verbal, --batches N (8 questions each, spread over topics), --apply
import { generateStructured } from "@/lib/ai/llm";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { shuffle, rng } from "@/lib/crt/content/draft";
import { GENERATED_SOURCE, PickAnswer, RankAnswer, SOFT_TOPICS, SoftBatch, VERBAL_TOPICS, VerbalBatch, hashOf, rankingAgrees, softQuestion, soundResponses, verbalQuestion } from "@/lib/crt/import/generated";
import type { ImportedQuestion } from "@/lib/crt/import/aqua";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const val = (n: string, d: string) => (flag(n) ? args[args.indexOf(`--${n}`) + 1] : d);
const target = val("module", "soft_skills") as "soft_skills" | "verbal";
const batches = Number(val("batches", "3"));
const apply = flag("apply");
const PER_BATCH = 8;
if (target !== "soft_skills" && target !== "verbal") throw new Error("--module must be soft_skills or verbal");

const r = rng(Date.now() % 1_000_000);
const perm = () => shuffle(r, [0, 1, 2, 3]);
const topics = target === "soft_skills" ? SOFT_TOPICS : VERBAL_TOPICS;
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
type Row = ImportedQuestion & { hash: string };
const rows: Row[] = [];
let written = 0, rejected = 0, failed = 0;

const SOFT_SYSTEM = `You write situational-judgement questions for Indian engineering and degree students preparing for campus placements. Each item is a short, realistic situation (campus project, internship, interview, group discussion, first job) followed by four possible responses a student might give.
Rules: write original scenarios, no real company or person names. Give the four responses BEST FIRST: response 1 is clearly the most professional, response 4 clearly the least; 2 and 3 are plausible but weaker, in that order. Each response is one or two plain sentences. Do not make the best response the longest every time. Never use "all of the above". Explain in one sentence why the first is best.
Return ONE JSON object {"items":[{"situation":string,"responses":[string,string,string,string],"why":string}]}.`;
const VERBAL_SYSTEM = `You write verbal-ability multiple-choice questions for Indian placement tests (CRT): clear, unambiguous, with exactly one correct option and three plausible wrong ones. Questions must be original. Every question has a single defensible answer: no opinion questions.
Return ONE JSON object {"items":[{"question":string,"options":[string,string,string,string],"correct":0-3,"why":string}]}.`;

for (let b = 0; b < batches; b++) {
  const topic = topics[b % topics.length];
  try {
    if (target === "soft_skills") {
      const gen = await generateStructured({ task: "question", system: SOFT_SYSTEM, user: `Write ${PER_BATCH} situations on the theme "${topic}". Vary the setting and the severity.`, schema: SoftBatch, temperature: 0.9, maxTokens: 3500, promptVersion: "crt-soft.v1" });
      const items = gen.value.items.filter((i) => soundResponses(i.responses));
      rejected += gen.value.items.length - items.length;
      const orders = items.map(perm);
      const shown = items.map((it, id) => ({ id, situation: it.situation, responses: orders[id].map((o) => it.responses[o]) }));
      const check = await generateStructured({ task: "question_verify", system: `You are an experienced HR professional. For each situation, say which of the four responses (0-3) is the BEST and which is the WORST for a new graduate. Return ONE JSON object {"answers":[{"id":number,"best":0-3,"worst":0-3}]}.`, user: JSON.stringify(shown), schema: RankAnswer, temperature: 0, maxTokens: 1200, promptVersion: "crt-soft-verify.v1" });
      const answers = new Map(check.value.answers.map((a) => [a.id, a]));
      items.forEach((it, id) => {
        const a = answers.get(id);
        if (!a || !rankingAgrees(a, orders[id])) { rejected++; return; }
        const q = softQuestion(topic, it, orders[id]);
        rows.push({ ...q, hash: hashOf(q.prompt, q.options.map((o) => o.text)) });
        written++;
      });
    } else {
      const gen = await generateStructured({ task: "question", system: VERBAL_SYSTEM, user: `Write ${PER_BATCH} questions on "${topic}", mixed easy and medium. Vary the question style.`, schema: VerbalBatch, temperature: 0.8, maxTokens: 3000, promptVersion: "crt-verbal.v1" });
      const orders = gen.value.items.map(perm);
      const shown = gen.value.items.map((it, id) => ({ id, question: it.question, options: orders[id].map((o) => it.options[o]) }));
      const check = await generateStructured({ task: "question_verify", system: `You are a careful English teacher. For each question choose the single best option (0-3). Return ONE JSON object {"answers":[{"id":number,"choice":0-3}]}.`, user: JSON.stringify(shown), schema: PickAnswer, temperature: 0, maxTokens: 1200, promptVersion: "crt-verbal-verify.v1" });
      const answers = new Map(check.value.answers.map((a) => [a.id, a.choice]));
      gen.value.items.forEach((it, id) => {
        const q = verbalQuestion(topic, it, orders[id]);
        if (!q || orders[id][answers.get(id) ?? -1] !== it.correct) { rejected++; return; }
        rows.push({ ...q, hash: hashOf(q.prompt, q.options.map((o) => o.text)) });
        written++;
      });
    }
  } catch (e) {
    failed++;
    console.error(`batch ${b + 1} (${topic}) failed: ${(e as Error).message.slice(0, 160)}`);
    await sleep(8000);
  }
  await sleep(1500);
}

const unique = [...new Map(rows.map((q) => [q.hash, q])).values()];
console.log(`${target}: ${batches} batches -> ${unique.length} checked questions kept, ${rejected} rejected by the checks, ${failed} batches failed`);
console.log("sample:", JSON.stringify({ ...unique[0], hash: undefined }, null, 1).slice(0, 900));
if (!apply) { console.log("\nDry run: nothing was written. Re-run with --apply."); process.exit(0); }

const db = untyped(createServiceClient());
const { data: have, error } = await db.from("crt_questions").select("content_hash").not("content_hash", "is", null).limit(100_000);
if (error) throw error;
const known = new Set(((have ?? []) as { content_hash: string }[]).map((x) => x.content_hash));
const fresh = unique.filter((q) => !known.has(q.hash));
for (let i = 0; i < fresh.length; i += 100) {
  const { error: e } = await db.from("crt_questions").insert(fresh.slice(i, i + 100).map((q) => ({ module: target, topic: q.topic, difficulty: q.difficulty, prompt: q.prompt, options: q.options, explanation: q.explanation, status: "published", source: GENERATED_SOURCE.source, source_license: GENERATED_SOURCE.license, source_ref: "generated and independently verified", content_hash: q.hash })));
  if (e) throw e;
}
console.log(`added ${fresh.length} questions.`);

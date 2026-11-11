// Imports aptitude questions from AQuA-RAT (DeepMind, Apache-2.0, https://huggingface.co/datasets/deepmind/aqua_rat) into the CRT question bank,
// with its source and licence recorded on every question. Each row is checked first (see lib/crt/import/aqua.ts): rows whose own worked solution
// disagrees with the marked answer, that need a picture, or are malformed are left out. The same question is never stored twice.
//   npm run crt:import-aqua                          dry run: fetches and checks rows, reports what would be added, writes nothing
//   npm run crt:import-aqua -- --apply --limit 3000   adds up to 3000 checked questions
//   options: --offset N (where in the dataset to start), --limit N (rows to scan, default 1000)
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { AQUA_SOURCE, parseAquaRow, questionHash, type ImportedQuestion } from "@/lib/crt/import/aqua";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const num = (n: string, d: number) => (flag(n) ? Number(args[args.indexOf(`--${n}`) + 1]) : d);
const apply = flag("apply");
const limit = num("limit", 1000);
const start = num("offset", 0);
const PAGE = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** One page of rows. The public dataset server rate-limits, so pages are spaced out and a 429 is retried after a wait. */
async function page(offset: number, length: number): Promise<{ row: unknown }[]> {
  const url = `https://datasets-server.huggingface.co/rows?dataset=deepmind/aqua_rat&config=raw&split=train&offset=${offset}&length=${length}`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url);
    if (res.ok) return ((await res.json()) as { rows: { row: unknown }[] }).rows;
    if (res.status !== 429 && res.status < 500) throw new Error(`dataset server answered ${res.status}`);
    await sleep(Math.max(3000 * attempt, Number(res.headers.get("retry-after") ?? 0) * 1000));
  }
  throw new Error("dataset server kept rate-limiting; try again in a few minutes");
}

const kept: (ImportedQuestion & { hash: string })[] = [];
const dropped = new Map<string, number>();
let scanned = 0;
for (let offset = start; scanned < limit; offset += PAGE) {
  const rows = await page(offset, Math.min(PAGE, limit - scanned));
  if (rows.length === 0) break;
  await sleep(500);
  for (const { row } of rows) {
    scanned++;
    const p = parseAquaRow(row);
    if (!p.ok) { dropped.set(p.reason, (dropped.get(p.reason) ?? 0) + 1); continue; }
    kept.push({ ...p.question, hash: questionHash(p.question.prompt, p.question.options.map((o) => o.text)) });
  }
}

const unique = [...new Map(kept.map((q) => [q.hash, q])).values()];
const topics = unique.reduce<Record<string, number>>((a, q) => ({ ...a, [q.topic]: (a[q.topic] ?? 0) + 1 }), {});
console.log(`scanned ${scanned} rows -> ${unique.length} usable (${Math.round((unique.length / Math.max(1, scanned)) * 100)}%), ${kept.length - unique.length} duplicates inside the batch`);
console.log("left out:", Object.fromEntries(dropped));
console.log("topics:", topics);
console.log("sample:", JSON.stringify({ ...unique[0], hash: undefined }, null, 1).slice(0, 700));
if (!apply) { console.log("\nDry run: nothing was written. Re-run with --apply to add them."); process.exit(0); }

const db = untyped(createServiceClient());
const { data: existing, error } = await db.from("crt_questions").select("content_hash").not("content_hash", "is", null).limit(100_000);
if (error) throw error;
const have = new Set(((existing ?? []) as { content_hash: string }[]).map((r) => r.content_hash));
const fresh = unique.filter((q) => !have.has(q.hash));
for (let i = 0; i < fresh.length; i += 200) {
  const { error: e } = await db.from("crt_questions").insert(fresh.slice(i, i + 200).map((q) => ({
    module: "aptitude", topic: q.topic, difficulty: q.difficulty, prompt: q.prompt, options: q.options, explanation: q.explanation, status: "published",
    source: AQUA_SOURCE.source, source_license: AQUA_SOURCE.license, source_ref: AQUA_SOURCE.ref, content_hash: q.hash,
  })));
  if (e) throw e;
}
console.log(`added ${fresh.length} questions (${unique.length - fresh.length} were already in the bank). Source: ${AQUA_SOURCE.attribution}.`);

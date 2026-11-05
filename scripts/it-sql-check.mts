// Dry run: builds every SQL workbench task, runs its reference query and reports which tasks are usable. Stores nothing.
import { WORLD_KEYS, buildWorld } from "@/lib/arena-challenges/workbench/sql-bank";
import { computeAnswer } from "@/lib/arena-challenges/workbench/sql-task";

const seeds = Number(process.argv[2] ?? 3);
let ok = 0, bad = 0;
const seen = new Set<string>();
const byDiff: Record<string, number> = {};
for (const w of WORLD_KEYS) for (let s = 1; s <= seeds; s++) for (const t of buildWorld(w, s)) {
  const r = await computeAnswer(t);
  const key = `${t.title}|${JSON.stringify("answer" in r ? r.answer.expected : null)}`;
  if ("reason" in r) { bad++; console.log(`BAD  ${w}#${s} ${t.title}: ${r.reason}`); }
  else if (seen.has(key)) { bad++; console.log(`DUP  ${w}#${s} ${t.title}`); }
  else { seen.add(key); ok++; byDiff[t.difficulty] = (byDiff[t.difficulty] ?? 0) + 1; }
}
console.log(JSON.stringify({ ok, bad, byDiff }));

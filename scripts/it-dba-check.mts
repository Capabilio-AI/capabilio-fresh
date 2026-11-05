import { buildDba } from "@/lib/arena-challenges/workbench/dba-bank";
import { computeScriptAnswer, judgeScript, publicTask } from "@/lib/arena-challenges/workbench/sql-task";
let ok = 0, noopRejected = 0, n = 0, emptyProbe = 0;
for (const seed of [1, 2, 3, 4]) for (const t of buildDba(seed)) {
  const r = await computeScriptAnswer(t.tables, t.setupSql, t.script, t.probes);
  if ("reason" in r) { console.log("FAIL", t.title, r.reason); continue; }
  const task = { ...publicTask({ ...t, query: "", ordered: false, tags: t.tags }), mode: "script" as const, previewQuery: t.previewQuery, setupSql: t.setupSql };
  const good = await judgeScript(task, r.answer, t.script);
  const noop = await judgeScript(task, r.answer, "SELECT 1;");
  n++; if (good.verdict.passed) ok++; if (!noop.verdict.passed) noopRejected++;
  const first = r.answer.expected[0];
  const shown = "error" in first ? `ERROR ${first.error}` : JSON.stringify(first.rows).slice(0, 70);
  if (!("error" in first) && first.rows.length === 0) emptyProbe++;
  if (!good.verdict.passed || noop.verdict.passed) console.log(`${good.verdict.passed ? "ok " : "BAD"} ${noop.verdict.passed ? "NOOP-PASSES" : "noop-fails"}  ${t.title}  -> ${shown}`);
}
console.log({ n, referencePasses: ok, doNothingRejected: noopRejected, emptyFirstProbe: emptyProbe });

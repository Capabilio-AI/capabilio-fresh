import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Database Management Systems: page-I/O cost model. Without an index a query scans every page; with a B+ tree it reads the height plus matching pages.
interface Q { name: string; cols: string[]; freq: number; sel: number }
interface S { rows: number; queries: Q[]; writesPerSec: number; readMax: number; writeMax: number; storageMaxMb: number }

const COLS = ["customer_id", "city", "order_date", "status"];
const ROWS_PER_PAGE = 100;

function cost(s: S, q: Q, idx: string[][]): number {
  const pages = s.rows / ROWS_PER_PAGE;
  const usable = idx.filter((ix) => ix[0] === q.cols[0]);
  if (!usable.length) return pages;
  const covers = usable.some((ix) => q.cols.length > 1 && ix[1] === q.cols[1]);
  const sel = covers && q.cols.length > 1 ? q.sel * 0.05 : q.sel;
  const height = Math.ceil(Math.log(s.rows) / Math.log(200));
  return Math.min(pages, height + Math.max(1, sel * s.rows / ROWS_PER_PAGE) + (sel * s.rows) * (covers ? 0.02 : 0.15));
}
function indexes(st: Settings): string[][] {
  const out: string[][] = [];
  for (const c of COLS) if (st[`i_${c}`] === "yes") out.push([c]);
  if (st.comp === "customer_id + status") out.push(["customer_id", "status"]);
  if (st.comp === "city + order_date") out.push(["city", "order_date"]);
  return out;
}
function analyse(s: S, st: Settings) {
  const idx = indexes(st);
  const per = s.queries.map((q) => cost(s, q, idx));
  const read = s.queries.reduce((a, q, i) => a + q.freq * per[i], 0) / s.queries.reduce((a, q) => a + q.freq, 0);
  return { idx, per, read, write: 1 + idx.length * 3, storageMb: (s.rows * 0.0000125 * 1000 * (1 + idx.length * 0.35)) / 1 };
}

const lab: Lab<S> = {
  key: "db-index",
  family: "it",
  format: "simulation",
  name: "Query tuning lab",
  topic: "Database Management Systems · Indexing and query cost",
  keywords: ["database", "dbms", "sql", "data engineering", "big data", "data warehousing"],
  tools: ["Index creator", "Query workload", "Cost estimator", "Storage meter"],
  skillTags: ["B+ tree indexes", "Query cost", "Write amplification"],
  makeScenario(rng, d) {
    const rows = rng.pick([200_000, 500_000, 1_000_000, 5_000_000, 20_000_000]);
    const queries: Q[] = [
      { name: "orders of one customer", cols: ["customer_id"], freq: rng.int(20, 60), sel: 0.00002 },
      { name: "orders of a customer by status", cols: ["customer_id", "status"], freq: rng.int(5, 30), sel: 0.00002 },
      { name: "orders in a city on a date", cols: ["city", "order_date"], freq: rng.int(5, 30), sel: 0.001 },
      { name: "all pending orders", cols: ["status"], freq: rng.int(1, 8), sel: 0.2 },
    ];
    const base: S = { rows, queries, writesPerSec: rng.pick([50, 200, 800]), readMax: 0, writeMax: 0, storageMaxMb: 0 };
    const ref = rng.pick([...gridSettings(lab.controls(base))]);
    const a = analyse(base, ref);
    return { ...base, readMax: Math.ceil(a.read * (d === "easy" ? 1.15 : d === "medium" ? 1.04 : 1)), writeMax: a.write + (d === "easy" ? 1 : 0), storageMaxMb: Math.ceil(a.storageMb * (d === "easy" ? 1.15 : d === "medium" ? 1.04 : 1.005)) };
  },
  given: (s) => [{ label: "Table", value: `orders, ${s.rows.toLocaleString("en-IN")} rows, ${ROWS_PER_PAGE} rows per page` }, ...s.queries.map((q) => ({ label: `${q.freq}/min`, value: q.name })), { label: "Writes", value: `${s.writesPerSec}/s, each updating every index` }],
  mission: (s) => `Add the indexes that bring the average read to ≤ ${s.readMax} page reads, keep a write at ≤ ${s.writeMax} page writes, and fit in ${s.storageMaxMb} MB.`,
  controls: () => [
    ...COLS.map((c) => ({ kind: "choice" as const, id: `i_${c}`, label: `Index on ${c}`, options: choices(["no", "yes"]), default: "no" })),
    { kind: "choice", id: "comp", label: "Composite index", options: choices(["none", "customer_id + status", "city + order_date"]), default: "none" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("read", `Average read ≤ ${s.readMax} pages`, a.read <= s.readMax, fmt(a.read, 0), "A query with no usable index reads the whole table. Which columns do the frequent queries filter on?"),
      objective("write", `Write ≤ ${s.writeMax} page writes`, a.write <= s.writeMax, String(a.write), "Every index must be updated on each insert and update."),
      objective("store", `Storage ≤ ${s.storageMaxMb} MB`, a.storageMb <= s.storageMaxMb, `${fmt(a.storageMb, 0)} MB`, "Indexes take disk space of their own."),
    ];
    return {
      readings: [gauge("r", "Average read cost", a.read, `${fmt(a.read, 0)} pages`, { min: 0, max: Math.max(s.readMax * 3, a.read * 1.05), high: s.readMax }), info("n", "Indexes", String(a.idx.length)), gauge("w", "Write cost", a.write, String(a.write), { min: 0, max: s.writeMax * 2, high: s.writeMax })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Page reads per query", xLabel: "query", yLabel: "pages read", lines: [{ name: "Cost", pts: a.per.map((c, i): [number, number] => [i + 1, c]), style: "main" }, { name: "Average limit", pts: [[1, s.readMax], [s.queries.length, s.readMax]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Without an index a query reads all ${fmt(s.rows / ROWS_PER_PAGE, 0)} pages. A B+ tree reaches a row in about ${Math.ceil(Math.log(s.rows) / Math.log(200))} page reads, and a composite index can answer a two-column filter by itself. Each index you add costs extra writes (${a.write} page writes per insert here) and disk space, so you index the columns of frequent, selective queries and skip the rest, such as status, which matches a fifth of the table.`;
  },
  fallback: (s) => ({ title: `Speed up the orders table`, story: `An online shop's order table has grown to ${s.rows.toLocaleString("en-IN")} rows and its dashboards crawl, but it also takes ${s.writesPerSec} new orders a second. The database engineer must index it wisely.` }),
};
export default defineLab(lab);

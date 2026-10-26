import { stringify } from "yaml";
import type { Difficulty } from "@/lib/arena-workstations/types";
import type { ExperienceLevel } from "../level";
import { hashSeed } from "../rng";
import { MAX_SUBMISSIONS } from "../file-tasks/types";
import type { Check } from "./checks";
import { ORDERS, PAYMENTS, RIDES, describeDays, type Dataset, type Scenario } from "./scenario";

export const PIPELINE_FILE = "pipeline.yaml";

/** What the student sees. The scenario is input data (the browser rebuilds the same batches for its preview run); the checks stay in the key. */
export interface PipelineContent {
  company: string;
  file: { name: string; content: string };
  scenario: Scenario;
  days: string[];
  requirements: string[];
  deliverable: string;
  maxSubmissions: number;
}
export interface PipelineKey {
  scenario: Scenario;
  checks: Check[];
}
export interface PipelineDraft {
  title: string;
  requester: { name: string; title: string };
  scenario: string;
  skillTags: string[];
  content: PipelineContent;
  key: PipelineKey;
}
export interface PipelineTemplate {
  id: string;
  areas: string[];
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  draft: PipelineDraft;
  /** a correct spec, for tests only: it must pass every check */
  solution: string;
}

const LEAD = { name: "Ananya Rao", title: "Data Engineering Lead" };
const ANALYTICS = { name: "Vikram Joshi", title: "Analytics Manager" };
const PLATFORM = { name: "Farah Siddiqui", title: "Data Platform Engineer" };

type Spec = Record<string, unknown>;
const yaml = (o: Spec) => stringify(o, { lineWidth: 0 });
const chain = (...ids: string[]) => ids.map((id, i) => (i ? { id, depends_on: [ids[i - 1]] } : { id }));

function spec(d: Dataset, load: Spec, extra: Spec = {}): Spec {
  return { pipeline: `${d.target}_daily`, schedule: "30 1 * * *", source: d.source, target: { table: d.target, partition_by: d.eventDate, format: "parquet" }, load, tasks: chain("extract", "transform", "load"), ...extra };
}

interface Def {
  id: string;
  areas: string[];
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  title: string;
  requester: PipelineDraft["requester"];
  story: string;
  tags: string[];
  scenario: Omit<Scenario, "seed" | "dataset">;
  dataset: Dataset;
  starter: Spec;
  solution: Spec;
  checks: Check[];
}

const NONE = { late: false, updates: false, drift: false, flaky: 0, bad: false };

function build(t: Def): PipelineTemplate {
  const scenario: Scenario = { seed: hashSeed("pipeline", t.id), dataset: t.dataset, ...t.scenario };
  return {
    id: t.id, areas: t.areas, difficulty: t.difficulty, minLevel: t.minLevel, solution: yaml(t.solution),
    draft: {
      title: t.title, requester: t.requester, scenario: t.story, skillTags: t.tags,
      content: {
        company: t.dataset.company, file: { name: PIPELINE_FILE, content: yaml(t.starter) }, scenario, days: describeDays(scenario),
        requirements: t.checks.map((c) => c.label), deliverable: `Edit ${PIPELINE_FILE} so the simulated runs meet every requirement. Run the simulation as often as you like; only Submit is graded.`,
        maxSubmissions: MAX_SUBMISSIONS,
      },
      key: { scenario, checks: t.checks },
    },
  };
}

const merge = (d: Dataset, more: Spec = {}) => ({ mode: "incremental", watermark: "ingested_at", write: "merge", unique_key: d.key, order_by: "updated_at", ...more });

const DEFS: Def[] = [
  {
    id: "pipe-schedule-and-dag", areas: ["pipelines"], difficulty: "easy", minLevel: "fresher", dataset: ORDERS, scenario: NONE,
    title: "Get the daily orders job scheduling again", requester: LEAD, tags: ["Airflow concepts", "DAG", "Scheduling"],
    story: "Hi, the nightly fact_orders job never started last week. The scheduler rejected the schedule and the task graph loops back on itself. Please fix the spec so it runs once a night and extract, transform and load run in that order.",
    starter: spec(ORDERS, { mode: "full", write: "overwrite" }, { schedule: "every night at 1:30", tasks: [{ id: "extract", depends_on: ["load"] }, { id: "transform", depends_on: ["extract"] }, { id: "load", depends_on: ["transform"] }] }),
    solution: spec(ORDERS, { mode: "full", write: "overwrite" }),
    checks: [
      { id: "schedule_daily", label: "The job is scheduled once a day with a valid cron expression (or @daily)" },
      { id: "dag_valid", label: "The task graph is valid: every dependency exists and nothing depends on itself in a loop" },
      { id: "dag_order", label: "transform runs after extract", before: "extract", after: "transform" },
      { id: "dag_order", label: "load runs after transform", before: "transform", after: "load" },
      { id: "complete", label: "After the daily runs the table holds every order, once, with its latest values" },
    ],
  },
  {
    id: "pipe-rerun-safe", areas: ["pipelines"], difficulty: "easy", minLevel: "fresher", dataset: PAYMENTS, scenario: { ...NONE, updates: true },
    title: "Re-running the payments load doubles the totals", requester: ANALYTICS, tags: ["Incremental load", "Idempotency", "MERGE / upsert"],
    story: "Hello, whenever someone re-runs the payments job, the finance totals jump. Payments also get corrected upstream and re-sent with the same payment_id, and we end up with both versions. Please make the load safe to re-run and keep only the newest version of each payment.",
    starter: spec(PAYMENTS, { mode: "incremental", watermark: "ingested_at", write: "append" }),
    solution: spec(PAYMENTS, merge(PAYMENTS)),
    checks: [
      { id: "no_duplicates", label: "No payment_id appears twice in the table" },
      { id: "idempotent", label: "Re-running every day (a backfill) leaves the table exactly as it was" },
      { id: "complete", label: "The table holds every payment, once, with its latest values" },
    ],
  },
  {
    id: "pipe-late-arrivals", areas: ["pipelines"], difficulty: "medium", minLevel: "junior", dataset: ORDERS, scenario: { ...NONE, late: true, updates: true },
    title: "Orders that arrive late never reach the table", requester: LEAD, tags: ["Watermarks", "Late-arriving data", "Incremental load"],
    story: "Hi, store tills in two cities sync after midnight, so some of yesterday's orders land in raw_orders the next morning. The incremental load reads by updated_at and skips them, so daily revenue is short. Please fix the load so late rows are picked up without double counting.",
    starter: spec(ORDERS, merge(ORDERS, { watermark: "updated_at" })),
    solution: spec(ORDERS, merge(ORDERS, { watermark: "updated_at", lookback_hours: 24 })),
    checks: [
      { id: "late_data", label: "Orders that arrive after their day's run are still loaded" },
      { id: "no_duplicates", label: "No order_id appears twice in the table" },
      { id: "idempotent", label: "Re-running every day (a backfill) leaves the table exactly as it was" },
      { id: "complete", label: "The table holds every order, once, with its latest values" },
    ],
  },
  {
    id: "pipe-flaky-extract", areas: ["pipelines"], difficulty: "medium", minLevel: "junior", dataset: RIDES, scenario: { ...NONE, flaky: 2 },
    title: "The rides job dies when the source API blips", requester: PLATFORM, tags: ["Retries", "Failure recovery", "Airflow concepts"],
    story: "Hi, the rides source API times out a couple of times some nights, and our job gives up on the first error, so that day's rides are missing until someone notices. Please make the job recover on its own, but do not let it retry forever and hammer the API.",
    starter: spec(RIDES, merge(RIDES)),
    solution: spec(RIDES, merge(RIDES), { retries: { max: 3, delay_minutes: 10 } }),
    checks: [
      { id: "retries_bounded", label: `Retries are bounded: between 1 and 5 retries, with a delay of at least 1 minute` },
      { id: "runs_recover", label: "Every daily run finishes, even on the night the extract fails" },
      { id: "dag_valid", label: "The task graph is valid: every dependency exists and there are no loops" },
      { id: "complete", label: "The table holds every ride, once, with its latest values" },
    ],
  },
  {
    id: "dq-block-corrupt-export", areas: ["data-quality"], difficulty: "easy", minLevel: "fresher", dataset: ORDERS, scenario: { ...NONE, bad: true },
    title: "Stop a corrupt export from reaching the orders table", requester: ANALYTICS, tags: ["Data quality", "Quality gates", "Great Expectations concepts"],
    story: "Hello, last month a broken upstream export loaded orders with no order_id and negative amounts, and the CFO's dashboard showed a loss. Our quality step only runs after the data is already published, and it only warns. Please put a real gate in front of the load.",
    starter: spec(ORDERS, merge(ORDERS), { tasks: chain("extract", "transform", "load", "quality"), quality: { on_fail: "warn", checks: [{ check: "row_count_min", value: 1 }] } }),
    solution: spec(ORDERS, merge(ORDERS), { tasks: chain("extract", "transform", "quality", "load"), quality: { on_fail: "block", checks: [{ check: "row_count_min", value: 1 }, { check: "not_null", column: "order_id" }, { check: "min", column: "amount_inr", value: 0 }] } }),
    checks: [
      { id: "quality_blocks", label: "The corrupt day is blocked: no row with a missing order_id or a negative amount reaches the table" },
      { id: "dag_order", label: "The quality checks run before load publishes the data", before: "quality", after: "load" },
      { id: "complete", label: "Every good order is still loaded, once, with its latest values" },
    ],
  },
  {
    id: "dq-schema-drift", areas: ["data-quality"], difficulty: "medium", minLevel: "junior", dataset: PAYMENTS, scenario: { ...NONE, updates: true, drift: true },
    title: "The payments vendor added a column and the job stopped", requester: PLATFORM, tags: ["Schema evolution", "Deduplication", "dbt concepts"],
    story: "Hi, the payments vendor now sends device_type, and our job has been failing since. Before that, the uniqueness check kept blocking whole days because corrected payments are re-sent with the same payment_id. We want the new column kept and corrected payments to replace the old version.",
    starter: spec(PAYMENTS, { mode: "incremental", watermark: "ingested_at", write: "append", on_schema_change: "fail" }, { quality: { on_fail: "block", checks: [{ check: "unique", column: "payment_id" }] } }),
    solution: spec(PAYMENTS, merge(PAYMENTS, { on_schema_change: "append_new_columns" }), { quality: { on_fail: "block", checks: [{ check: "unique", column: "payment_id" }] } }),
    checks: [
      { id: "schema_drift", label: "The new device_type column is kept, and the day it appears still loads" },
      { id: "runs_recover", label: "Every daily run finishes" },
      { id: "no_duplicates", label: "No payment_id appears twice in the table" },
      { id: "complete", label: "The table holds every payment, once, with its latest values" },
    ],
  },
  {
    id: "store-partition-format", areas: ["partitioning-and-storage"], difficulty: "easy", minLevel: "fresher", dataset: ORDERS, scenario: NONE,
    title: "The daily sales report reads the whole orders table", requester: ANALYTICS, tags: ["Partitioning", "Parquet", "Big data storage"],
    story: "Hello, every daily sales report filters on one order_date, yet it reads the whole fact_orders table, and the files are plain CSV. Please lay the table out so a one-day report reads only that day, in a columnar format, and without thousands of tiny partitions.",
    starter: spec(ORDERS, { mode: "full", write: "overwrite" }, { target: { table: ORDERS.target, partition_by: "customer_id", format: "csv" } }),
    solution: spec(ORDERS, { mode: "full", write: "overwrite" }),
    checks: [
      { id: "partition_pruning", label: "A report for one order_date reads only that day's rows, and the table has at most 10 partitions", maxPartitions: 10 },
      { id: "columnar", label: "The table is stored in a columnar format" },
      { id: "complete", label: "The table holds every order, once, with its latest values" },
    ],
  },
  {
    id: "store-partition-bucket", areas: ["partitioning-and-storage"], difficulty: "medium", minLevel: "junior", dataset: RIDES, scenario: { ...NONE, updates: true },
    title: "Lay out the rides table for date filters and rider joins", requester: LEAD, tags: ["Partitioning", "Bucketing", "Spark concepts"],
    story: "Hi, fact_rides is partitioned by ride_id, so it has one partition per ride and date filters read everything. Reports filter by ride_date and join to the riders table on rider_id. Fares get corrected and re-sent with the same ride_id. Please fix the layout and keep the corrected fares right.",
    starter: spec(RIDES, merge(RIDES, { write: "overwrite_partitions" }), { target: { table: RIDES.target, partition_by: "ride_id", format: "orc" } }),
    solution: spec(RIDES, merge(RIDES), { target: { table: RIDES.target, partition_by: "ride_date", format: "orc", bucket_by: "rider_id", buckets: 8 } }),
    checks: [
      { id: "partition_pruning", label: "A report for one ride_date reads only that day's rows, and the table has at most 10 partitions", maxPartitions: 10 },
      { id: "bucketing", label: "The table is bucketed on the column it is joined on, into 2 to 64 buckets", column: "rider_id", min: 2, max: 64 },
      { id: "idempotent", label: "Re-running every day (a backfill) leaves the table exactly as it was" },
      { id: "complete", label: "The table holds every ride, once, with its latest fare" },
    ],
  },
];

/** Fixed tickets; each has a known-good spec that the tests run through the simulator. */
export const PIPELINE_TEMPLATES: PipelineTemplate[] = DEFS.map(build);

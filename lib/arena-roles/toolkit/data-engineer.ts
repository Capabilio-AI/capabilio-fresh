import type { RoleToolkit } from "./types";

/** IT-05 Data Engineer, the Big Data Analytics entry role. SQL Studio (W01) for the SQL areas, Pipeline Lab (W08) for pipelines, quality and storage. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "data-engineer-sql",
  roleId: "IT-05",
  stream: "Big Data Analytics",
  headline: "Load, de-duplicate and check data every day, and lay out big tables so reports stay fast: the work of a fresher data engineer.",
  workstations: [
    {
      name: "SQL Studio",
      mirrors: ["DBeaver", "pgAdmin", "BigQuery console"],
      toolType: "sql_workspace",
      tier: "R",
      runsIn: "server",
      summary: "Write SQL against the company warehouse: analytical queries, loads, merges and fixes to broken queries.",
    },
    {
      name: "Pipeline Lab",
      mirrors: ["Apache Airflow", "dbt", "Apache Spark", "Great Expectations"],
      toolType: "pipeline_workspace",
      tier: "S",
      runsIn: "server",
      summary: "Edit a pipeline spec (schedule, tasks, watermark, merge key, quality checks, partitions, retries) and watch it run over several days of data.",
    },
  ],
  environment: [
    { label: "Warehouse", detail: "A fictional company's tables on PostgreSQL, rebuilt fresh for each ticket." },
    { label: "Pipeline spec", detail: "One pipeline.yaml in our own small format, using Airflow / dbt / Spark words. A field reference sits next to the editor." },
    { label: "Synthetic batches", detail: "Several days of rows for a fictional Indian company, with late rows, re-sent rows, a new column, a flaky extract or a corrupt export, as the ticket says." },
    { label: "Simulation", detail: "Run the simulation in your browser as often as you like to see each day's run, the backfill and the table's partitions. Only Submit is graded, on the server." },
  ],
  firstWeek: [
    "Fix a nightly job whose schedule and task order are broken",
    "Make a payments load safe to re-run without doubling totals",
    "Pick up orders that arrive after their day's run",
    "Put a quality gate in front of the load to stop a corrupt export",
    "Partition the orders table so a one-day report reads only that day",
    "Merge yesterday's changes into a warehouse table with SQL",
  ],
  portfolioArtifacts: [
    "Graded pipeline specs with per-check results (idempotency, late data, duplicates, quality gate, partitioning, retries)",
    "Graded SQL tickets on the warehouse, with the submitted SQL kept for the explain-your-work interview",
  ],
  honestLimits: [
    "Pipeline Lab is a simulator: it models Spark, Airflow and dbt ideas but runs none of them, and no cluster is used.",
    "Data volumes are tiny; speed, memory, shuffles and cost at scale are not assessed.",
    "Streaming (Kafka) and lineage across many jobs are not assessed yet.",
    "Partitioning and bucketing are graded as decisions in the spec, not by inspecting real files.",
  ],
};

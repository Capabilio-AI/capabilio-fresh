import type { RoleBlueprint } from "../blueprint";

/**
 * IT-05 Data Engineer, the Big Data Analytics entry role (role_key data-engineer-sql). The four SQL areas mirror the live rows from
 * supabase/migrations/104_database_roles.sql and 107_database_role_areas.sql; the three pipeline areas come from 131_data_engineer_big_data.sql,
 * which is NOT yet applied.
 *
 * - SQL areas are "executed": the student's SQL runs on the ticket's warehouse and its result is compared with the server's.
 * - Pipeline areas are "evaluated-spec": the student's pipeline spec is parsed and simulated over synthetic daily batches (late rows, re-sent rows,
 *   a new column, a flaky extract, a corrupt export) and the output is checked against invariants. A model of Spark / Airflow / dbt concepts, not
 *   those products; nothing runs on a cluster or scheduler.
 */
export const DATA_ENGINEER: RoleBlueprint = {
  roleId: "IT-05",
  domainRoleKey: "data-engineer-sql",
  name: "Data Engineer (Big Data)",
  competencies: [
    { id: "de.sql", label: "Analytical SQL" },
    { id: "de.transformation", label: "Loading, merging and transforming data with SQL" },
    { id: "de.debugging", label: "Finding and fixing broken SQL" },
    { id: "de.orchestration", label: "Scheduling and task dependencies (DAGs)" },
    { id: "de.incremental", label: "Incremental loads, watermarks, late data and idempotent re-runs" },
    { id: "de.recovery", label: "Failure recovery with bounded retries" },
    { id: "de.quality", label: "Data quality gates and schema changes" },
    { id: "de.storage", label: "Partitioning, bucketing and file formats as layout decisions" },
  ],
  unassessed: [
    { id: "de.streaming", label: "Streaming (Kafka, Spark Structured Streaming)" },
    { id: "de.cluster", label: "Cluster sizing, Spark tuning and cost on a real cluster" },
    { id: "de.lineage", label: "Lineage tracing across many jobs" },
  ],
  areas: [
    { areaKey: "transformation", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["de.transformation"] },
    { areaKey: "queries", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["de.sql"] },
    { areaKey: "data-changes", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["de.transformation"] },
    { areaKey: "debugging", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["de.debugging"] },
    { areaKey: "pipelines", toolType: "pipeline_workspace", generationVersion: "pipeline.gen.v1", gradingVersion: "pipeline.grade.v1", executionMode: "evaluated-spec", status: "enabled", competencies: ["de.orchestration", "de.incremental", "de.recovery"] },
    { areaKey: "data-quality", toolType: "pipeline_workspace", generationVersion: "pipeline.gen.v1", gradingVersion: "pipeline.grade.v1", executionMode: "evaluated-spec", status: "enabled", competencies: ["de.quality", "de.incremental"] },
    { areaKey: "partitioning-and-storage", toolType: "pipeline_workspace", generationVersion: "pipeline.gen.v1", gradingVersion: "pipeline.grade.v1", executionMode: "evaluated-spec", status: "enabled", competencies: ["de.storage"] },
  ],
  limitations: [
    "Pipeline Lab simulates runs in TypeScript over small synthetic batches; it models Spark, Airflow and dbt concepts but runs none of them, and performance at scale is not measured.",
    "Partitioning and bucketing are graded as modelled decisions (pruning, partition count, join key), not by measuring a real file layout.",
    "Pipeline tickets are fixed, tested templates; there is no AI-generated pipeline ticket yet.",
  ],
};

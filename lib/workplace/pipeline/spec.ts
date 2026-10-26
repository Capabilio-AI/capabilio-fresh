import { z } from "zod";
import { parse as parseYaml } from "yaml";

/**
 * The pipeline spec the student edits (YAML, or JSON, which YAML also reads). Its words follow what Airflow, dbt and Spark call the same ideas
 * (schedule, depends_on, unique_key, on_schema_change, partition_by ...), but it is our own small format, not any of those products' files.
 */
const name = z.string().min(1).max(60);
const QualityCheck = z.discriminatedUnion("check", [
  z.object({ check: z.literal("not_null"), column: name }),
  z.object({ check: z.literal("unique"), column: name }),
  z.object({ check: z.literal("min"), column: name, value: z.number() }),
  z.object({ check: z.literal("accepted_values"), column: name, values: z.array(z.union([z.string(), z.number()])).min(1).max(30) }),
  z.object({ check: z.literal("row_count_min"), value: z.number().int().min(0) }),
]);
export type QualityCheck = z.infer<typeof QualityCheck>;

export const SpecSchema = z.object({
  pipeline: z.string().max(80).optional(),
  schedule: z.string().max(60).optional(),
  source: name,
  target: z.object({
    table: name,
    partition_by: name.optional(),
    format: z.string().max(30).optional(),
    bucket_by: name.optional(),
    buckets: z.number().int().optional(),
  }),
  load: z.object({
    mode: z.enum(["full", "incremental"]),
    watermark: name.optional(),
    lookback_hours: z.number().min(0).max(24 * 31).optional(),
    write: z.enum(["append", "merge", "overwrite", "overwrite_partitions"]),
    unique_key: name.optional(),
    order_by: name.optional(),
    on_schema_change: z.enum(["fail", "ignore", "append_new_columns"]).optional(),
  }),
  quality: z.object({ on_fail: z.enum(["block", "warn"]).optional(), checks: z.array(QualityCheck).max(20).optional() }).optional(),
  tasks: z.array(z.object({ id: name, depends_on: z.array(name).max(20).optional() })).min(1).max(20),
  // left loose on purpose: an unbounded or odd value is graded as a failing check, not refused as unreadable
  retries: z.object({ max: z.union([z.number(), z.string()]).optional(), delay_minutes: z.union([z.number(), z.string()]).optional() }).optional(),
});
export type PipelineSpec = z.infer<typeof SpecSchema>;

export type Parsed = { ok: true; spec: PipelineSpec } | { ok: false; error: string };

/** A real spec is under 2 KB. The parser is synchronous, so reject files that are long or built from deep flow collections before parsing. */
const MAX_SPEC_LINES = 200;
const MAX_SPEC_CHARS = 4000;

export function parseSpec(text: string): Parsed {
  if (text.length > MAX_SPEC_CHARS || text.split("\n").length > MAX_SPEC_LINES || /[[{]{8,}/.test(text)) return { ok: false, error: "The file is too large or too deeply nested for a pipeline spec." };
  let raw: unknown;
  try {
    raw = parseYaml(text, { logLevel: "error", maxAliasCount: 10, uniqueKeys: true });
  } catch (e) {
    return { ok: false, error: `The file is not valid YAML: ${(e as Error).message.split("\n")[0].slice(0, 160)}` };
  }
  const r = SpecSchema.safeParse(raw);
  if (r.success) return { ok: true, spec: r.data };
  const issue = r.error.issues[0];
  return { ok: false, error: `${issue.path.join(".") || "(file)"}: ${issue.message}` };
}

/** Field reference shown next to the editor so the allowed words are never a guess. */
export const SPEC_REFERENCE: string[] = [
  "schedule: cron (minute hour day month weekday), e.g. \"30 1 * * *\", or @daily",
  "source / target.table: table names",
  "target.partition_by: one column; target.format: csv | json | parquet | orc; target.bucket_by + target.buckets (optional)",
  "load.mode: full | incremental; load.watermark: a timestamp column; load.lookback_hours: re-read this far behind the watermark",
  "load.write: append | merge | overwrite | overwrite_partitions; load.unique_key: the row's key; load.order_by: newest version wins",
  "load.on_schema_change: fail | ignore | append_new_columns",
  "quality.on_fail: block | warn; quality.checks: not_null, unique, min (value), accepted_values (values), row_count_min (value)",
  "tasks: list of { id, depends_on: [ids] }; retries: { max, delay_minutes }",
];

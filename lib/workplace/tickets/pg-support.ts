import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { Probe, ScriptDraft, TicketTemplate } from "./types";

/** Constraints a real shop database has, applied to the BrightCart warehouse on PostgreSQL. */
export const PG_WORLD_SETUP = `
ALTER TABLE customers ADD PRIMARY KEY (customer_id);
ALTER TABLE products ADD PRIMARY KEY (product_id);
ALTER TABLE orders ADD PRIMARY KEY (order_id);
ALTER TABLE order_items ADD PRIMARY KEY (item_id);
ALTER TABLE orders ADD CONSTRAINT orders_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (customer_id);
ALTER TABLE order_items ADD CONSTRAINT items_order_fk FOREIGN KEY (order_id) REFERENCES orders (order_id);
ALTER TABLE order_items ADD CONSTRAINT items_product_fk FOREIGN KEY (product_id) REFERENCES products (product_id);
`.trim();

export const LINE = "oi.quantity * oi.unit_price";

export const probe = (label: string, sql: string, compare = true): Probe => ({ label, sql, compare });

/** Probes that record whether a statement is allowed or refused, for tasks about rules the database must enforce. */
export const LOG_TABLE = probe("Set up the check log", "CREATE TABLE probe_log (step integer, outcome text)", false);
export const attempt = (step: number, statement: string): Probe =>
  probe(`Try something the rules should decide (${step})`, `DO $$ BEGIN ${statement}; INSERT INTO probe_log VALUES (${step}, 'allowed'); EXCEPTION WHEN others THEN INSERT INTO probe_log VALUES (${step}, 'refused'); END $$`, false);
// one text cell per step ("1:refused"), because results are compared as a bag of values and a swapped pair would look identical
export const readLog = (label: string) => probe(label, "SELECT step::text || ':' || outcome AS result FROM probe_log ORDER BY step");

type Def = Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind" | "areas">;
type Parts = Omit<ScriptDraft, "kind" | "difficulty" | "minLevel" | "taskKind" | "templateId" | "skillTags">;

export const makeScript = (d: Def, skillTags: string[], parts: Parts): ScriptDraft => ({ kind: "script", templateId: d.id, difficulty: d.difficulty, minLevel: d.minLevel, taskKind: d.taskKind, skillTags, ...parts });

export const emptyTable = (name: string, columns: Dataset["columns"]): Dataset => ({ name, columns, rows: [] });

/**
 * Probes that capture the query plan Postgres chooses with sequential scans switched off, so a ticket can check that the user's index really gets used
 * (and not only that an index with a certain name exists). Run these first, then ask `planUses`.
 */
export const planCapture = (query: string): Probe[] => [
  probe("Prefer indexes for the plan check", "SET enable_seqscan = off", false),
  probe("Make room for the plan", "CREATE TEMP TABLE plan_lines (line text)", false),
  probe("Record the plan", `DO $$ DECLARE r record; BEGIN FOR r IN EXECUTE 'EXPLAIN ${query.replace(/'/g, "''")}' LOOP INSERT INTO plan_lines VALUES (r."QUERY PLAN"); END LOOP; END $$`, false),
];
export const planUses = (label: string, pattern: string): Probe =>
  probe(label, `SELECT CASE WHEN COUNT(*) FILTER (WHERE line ILIKE '%${pattern}%') > 0 THEN 1 ELSE 0 END AS used FROM plan_lines`);

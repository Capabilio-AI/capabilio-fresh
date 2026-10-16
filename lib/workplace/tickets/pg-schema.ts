import { BRIGHTCART } from "../worlds/brightcart";
import type { TicketTemplate } from "./types";
import { attempt, LOG_TABLE, makeScript, probe, readLog } from "./pg-support";

const { cast } = BRIGHTCART;

const D = {
  statusCheck: { id: "pg-status-check", difficulty: "easy", minLevel: "junior", taskKind: "constraint", areas: ["schema", "integrity"] },
  priority: { id: "pg-priority-column", difficulty: "easy", minLevel: "junior", taskKind: "schema", areas: ["schema"] },
  cascade: { id: "pg-cascade-delete", difficulty: "medium", minLevel: "mid", taskKind: "constraint", areas: ["schema", "integrity"] },
  matview: { id: "pg-materialized-view", difficulty: "medium", minLevel: "junior", taskKind: "view", areas: ["schema", "views"] },
  partial: { id: "pg-partial-index", difficulty: "hard", minLevel: "mid", taskKind: "index", areas: ["schema", "performance"] },
} as const satisfies Record<string, Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind" | "areas">>;

const NEW_ORDER = (status: string) => `INSERT INTO orders (order_id, customer_id, order_date, status, channel) VALUES (9001, 1, '2026-09-01', '${status}', 'web')`;

export const PG_SCHEMA: TicketTemplate[] = [
  {
    ...D.statusCheck,
    build() {
      const all = ["delivered", "cancelled", "returned", "shipped"];
      const check = (list: string[]) => `ALTER TABLE orders ADD CONSTRAINT orders_status_chk CHECK (status IN (${list.map((s) => `'${s}'`).join(", ")}));`;
      return makeScript(D.statusCheck, ["PostgreSQL", "CHECK constraints", "Data integrity"], {
        title: "Stop invalid order statuses at the door",
        requester: cast.engineering,
        scenario: "Hi, a bug in the mobile app wrote the status 'teleported' into orders and half our reports broke. The database should refuse anything that is not a real status. The four we use are delivered, cancelled, returned and shipped.",
        deliverable: "Add a CHECK constraint to orders so status can only be 'delivered', 'cancelled', 'returned' or 'shipped'. The existing data must still be valid.",
        referenceScript: check(all),
        mistakeScript: check(["delivered", "shipped"]),
        probes: [LOG_TABLE, attempt(1, NEW_ORDER("teleported")), attempt(2, NEW_ORDER("shipped")), readLog("Bad statuses are refused, good ones accepted")],
        previewQuery: "SELECT DISTINCT status FROM orders ORDER BY status",
      });
    },
  },
  {
    ...D.priority,
    build() {
      const script = (update: string) => `ALTER TABLE orders ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'express'));\n${update}`;
      return makeScript(D.priority, ["PostgreSQL", "ALTER TABLE", "DEFAULT and NOT NULL"], {
        title: "Add an express-delivery flag to orders",
        requester: cast.sales,
        scenario: "Hello, operations wants to flag express orders. Every order needs a priority, normal unless said otherwise, and nothing but 'normal' or 'express' should ever be stored. Orders that came through the app and are still in transit are the express ones today.",
        deliverable: "Add a text column priority to orders that cannot be NULL, defaults to 'normal' and only allows 'normal' or 'express'. Then set priority to 'express' for orders with channel 'app' and status 'shipped'.",
        referenceScript: script("UPDATE orders SET priority = 'express' WHERE channel = 'app' AND status = 'shipped';"),
        mistakeScript: script(""),
        probes: [probe("The right orders are express", "SELECT priority, COUNT(*) AS orders FROM orders GROUP BY priority"), LOG_TABLE, attempt(1, "UPDATE orders SET priority = 'urgent' WHERE order_id = 1"), readLog("Other values are refused")],
        previewQuery: "SELECT channel, status, COUNT(*) AS orders FROM orders GROUP BY channel, status ORDER BY channel, status",
      });
    },
  },
  {
    ...D.cascade,
    build() {
      const fk = (action: string) => `ALTER TABLE order_items DROP CONSTRAINT items_order_fk;\nALTER TABLE order_items ADD CONSTRAINT items_order_fk FOREIGN KEY (order_id) REFERENCES orders (order_id) ${action};`;
      return makeScript(D.cascade, ["PostgreSQL", "Foreign keys", "ON DELETE"], {
        title: "Deleting an order should take its items with it",
        requester: cast.engineering,
        scenario: "Hi, our order-deletion job keeps failing with a foreign key error because order_items still point at the order. We don't want to delete items by hand in the app; the database should do it. Items never exist without their order.",
        deliverable: "Change the foreign key items_order_fk on order_items.order_id so that deleting an order automatically deletes its items.",
        referenceScript: fk("ON DELETE CASCADE"),
        mistakeScript: fk("ON DELETE SET NULL"),
        probes: [
          LOG_TABLE,
          attempt(1, "DELETE FROM orders WHERE order_id = (SELECT MIN(order_id) FROM orders)"),
          probe("The order and its items are gone", "SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM order_items) AS items, (SELECT COUNT(*) FROM order_items WHERE order_id IS NULL) AS orphans"),
          readLog("The delete is allowed"),
        ],
        previewQuery: "SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'order_items'::regclass AND contype = 'f'",
      });
    },
  },
  {
    ...D.matview,
    build() {
      const body = "SELECT p.category, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status = 'delivered' GROUP BY p.category";
      return makeScript(D.matview, ["PostgreSQL", "Materialized views", "Indexes"], {
        title: "Pre-compute category revenue for the slow dashboard",
        requester: cast.data,
        scenario: "Hello, the category revenue tile recalculates the whole year on every page load and takes seconds. Please store the result so it loads instantly, and make sure we can refresh it without blocking readers.",
        deliverable: "Create a MATERIALIZED VIEW mv_category_revenue with columns category and revenue (delivered revenue, sum of quantity × unit_price, rounded to 2 decimals), and a UNIQUE index on category so it can be refreshed concurrently.",
        referenceScript: `CREATE MATERIALIZED VIEW mv_category_revenue AS ${body};\nCREATE UNIQUE INDEX mv_category_revenue_category ON mv_category_revenue (category);`,
        mistakeScript: `CREATE VIEW mv_category_revenue AS ${body};\nCREATE UNIQUE INDEX mv_category_revenue_category ON mv_category_revenue (category);`,
        probes: [
          probe("It is a materialized view", "SELECT relkind::text AS kind FROM pg_class WHERE relname = 'mv_category_revenue'"),
          probe("It holds the right numbers", "SELECT category, revenue FROM mv_category_revenue"),
          probe("It has a unique index", "SELECT COUNT(*)::int AS unique_indexes FROM pg_indexes WHERE tablename = 'mv_category_revenue' AND indexdef ILIKE 'CREATE UNIQUE%'"),
        ],
        previewQuery: "SELECT relname, relkind::text AS kind FROM pg_class WHERE relkind IN ('m', 'v') AND relnamespace = 'public'::regnamespace",
      });
    },
  },
  {
    ...D.partial,
    build(rng) {
      const [column, status] = rng.pick([["order_date", "shipped"], ["customer_id", "shipped"], ["order_date", "returned"]] as const);
      const found = `SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END AS has_partial_index FROM pg_indexes WHERE tablename = 'orders' AND indexdef ILIKE '%(${column})%' AND indexdef ILIKE '%WHERE%${status}%'`;
      return makeScript(D.partial, ["PostgreSQL", "Partial indexes", "Performance"], {
        title: `A lean index for the '${status}' orders screen`,
        requester: cast.engineering,
        scenario: `Hi, the courier screen only ever looks at orders with status '${status}', sorted by ${column}. A full index on a big table wastes space and slows every write. Can you create an index just for those rows?`,
        deliverable: `Create a partial index on orders (${column}) that covers only the rows where status = '${status}'.`,
        referenceScript: `CREATE INDEX idx_orders_${status}_${column} ON orders (${column}) WHERE status = '${status}';`,
        mistakeScript: `CREATE INDEX idx_orders_${column} ON orders (${column});`,
        probes: [probe(`A partial index on ${column} for '${status}' exists`, found)],
        previewQuery: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'orders'",
      });
    },
  },
];

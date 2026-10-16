import { BRIGHTCART } from "../worlds/brightcart";
import type { Probe, ScriptDraft, TicketTemplate } from "./types";

const { cast } = BRIGHTCART;
const LINE = "quantity * unit_price";
const CLEAN = (c: string) => `UPPER(SUBSTR(TRIM(${c}), 1, 1)) || LOWER(SUBSTR(TRIM(${c}), 2))`;

const probe = (label: string, sql: string, compare = true): Probe => ({ label, sql, compare });

type Parts = Omit<ScriptDraft, "kind" | "difficulty" | "minLevel" | "taskKind" | "templateId" | "skillTags"> & Partial<Pick<ScriptDraft, "skillTags">>;
const make = (t: Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind">, skillTags: string[], parts: Parts): ScriptDraft => ({
  kind: "script", templateId: t.id, difficulty: t.difficulty, minLevel: t.minLevel, taskKind: t.taskKind, skillTags, ...parts,
});

const defs = {
  staleShipped: { id: "stale-shipped", difficulty: "easy", minLevel: "fresher", taskKind: "update" },
  fixCities: { id: "fix-city-text", difficulty: "easy", minLevel: "fresher", taskKind: "update" },
  priceChange: { id: "price-change", difficulty: "easy", minLevel: "fresher", taskKind: "update" },
  backfill: { id: "backfill-order-value", difficulty: "medium", minLevel: "junior", taskKind: "schema" },
  view: { id: "monthly-revenue-view", difficulty: "medium", minLevel: "junior", taskKind: "view" },
  index: { id: "add-index", difficulty: "medium", minLevel: "junior", taskKind: "index" },
  cleanup: { id: "purge-cancelled", difficulty: "medium", minLevel: "junior", taskKind: "cleanup" },
  trigger: { id: "status-audit-trigger", difficulty: "hard", minLevel: "mid", taskKind: "trigger" },
  normalise: { id: "normalise-cities", difficulty: "hard", minLevel: "senior", taskKind: "migration" },
} as const satisfies Record<string, Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind">>;

export const SCRIPT_TEMPLATES: TicketTemplate[] = [
  {
    ...defs.staleShipped,
    build(rng) {
      const date = rng.pick(["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"]);
      const day = (d: string) => `${Number(d.slice(8))} ${["", "January", "February", "March", "April", "May", "June", "July", "August", "September"][Number(d.slice(5, 7))]} 2026`;
      return make(defs.staleShipped, ["SQL", "UPDATE", "Data maintenance"], {
        title: `Close orders stuck in "shipped" before ${day(date)}`,
        requester: cast.success,
        scenario: `Hi, our support queue is full of customers asking about parcels that never arrived. Any order still marked "shipped" that was placed before ${day(date)} should be treated as lost and marked "cancelled". Please don't touch newer orders, those are still on their way.`,
        deliverable: `Write an UPDATE that sets status to 'cancelled' for orders whose status is 'shipped' and whose order_date is before ${date}. Nothing else may change.`,
        referenceScript: `UPDATE orders SET status = 'cancelled' WHERE status = 'shipped' AND order_date < '${date}';`,
        mistakeScript: `UPDATE orders SET status = 'cancelled' WHERE status = 'shipped';`,
        probes: [probe("Only the stale shipped orders were cancelled", "SELECT status, COUNT(*) AS orders FROM orders GROUP BY status")],
        previewQuery: "SELECT status, COUNT(*) AS orders FROM orders GROUP BY status",
      });
    },
  },
  {
    ...defs.fixCities,
    build() {
      return make(defs.fixCities, ["SQL", "UPDATE", "String functions"], {
        title: "Fix the city names once and for all",
        requester: cast.sales,
        scenario: "Hi, every regional report I build splits Mumbai into three rows because people typed the city by hand. Can you fix the data itself so I don't have to clean it in every query? Each city should be written with a capital first letter and the rest small, with no stray spaces.",
        deliverable: "Write an UPDATE on customers that trims the spaces from city and writes it with a capital first letter and lowercase rest (for example 'mumbai ' becomes 'Mumbai').",
        referenceScript: `UPDATE customers SET city = ${CLEAN("city")};`,
        mistakeScript: "UPDATE customers SET city = TRIM(city);",
        probes: [
          probe("No city has stray spaces or odd capitals left", `SELECT COUNT(*) AS messy FROM customers WHERE city <> ${CLEAN("city")}`),
          probe("Customers per city are unchanged in total", "SELECT city, COUNT(*) AS customers FROM customers GROUP BY city"),
        ],
        previewQuery: "SELECT city, COUNT(*) AS customers FROM customers GROUP BY city ORDER BY city",
      });
    },
  },
  {
    ...defs.priceChange,
    build(rng) {
      const category = rng.pick(BRIGHTCART.categories);
      const pct = rng.pick([5, 8, 10]);
      return make(defs.priceChange, ["SQL", "UPDATE", "Arithmetic"], {
        title: `${category} price revision of ${pct}%`,
        requester: cast.category,
        scenario: `Hello, suppliers have raised their costs, so ${category} list prices go up by ${pct}% from today. Please update the catalogue. Every other category stays as it is.`,
        deliverable: `Write an UPDATE on products that raises list_price by ${pct}% for the ${category} category only, rounded to 2 decimals.`,
        referenceScript: `UPDATE products SET list_price = ROUND(list_price * ${1 + pct / 100}, 2) WHERE category = '${category}';`,
        mistakeScript: `UPDATE products SET list_price = ROUND(list_price * ${1 + pct / 100}, 2);`,
        probes: [probe("Only that category's prices changed, by the right amount", "SELECT category, ROUND(SUM(list_price), 2) AS total_price FROM products GROUP BY category")],
        previewQuery: "SELECT category, product_name, list_price FROM products ORDER BY category, product_name",
      });
    },
  },
  {
    ...defs.backfill,
    build() {
      return make(defs.backfill, ["SQL", "ALTER TABLE", "UPDATE", "Subqueries"], {
        title: "Store the order value on each order",
        requester: cast.finance,
        scenario: "Hi, finance keeps joining orders to order_items just to get an order's total. Please add the total to the orders table itself so reports are simpler, and fill it in for all existing orders.",
        deliverable: "Add a REAL column called order_value to orders, then set it for every order to the sum of quantity × unit_price of that order's items.",
        referenceScript: `ALTER TABLE orders ADD COLUMN order_value REAL; UPDATE orders SET order_value = (SELECT SUM(${LINE}) FROM order_items WHERE order_items.order_id = orders.order_id);`,
        mistakeScript: `ALTER TABLE orders ADD COLUMN order_value REAL; UPDATE orders SET order_value = (SELECT SUM(unit_price) FROM order_items WHERE order_items.order_id = orders.order_id);`,
        probes: [probe("Every order has a value and the total is right", "SELECT COUNT(order_value) AS orders_with_value, ROUND(SUM(order_value), 2) AS total FROM orders")],
        previewQuery: "SELECT order_id, order_value FROM orders ORDER BY order_id LIMIT 10",
      });
    },
  },
  {
    ...defs.view,
    build() {
      const body = (filter: string) => `SELECT SUBSTR(o.order_date, 1, 7) AS month, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id ${filter} GROUP BY 1`;
      return make(defs.view, ["SQL", "Views"], {
        title: "A monthly revenue view for the dashboard team",
        requester: cast.finance,
        scenario: "Hi, the dashboard team keeps copying my monthly revenue query. Can you save it as a view they can just select from? Delivered orders only, as always.",
        deliverable: "Create a view called v_monthly_revenue with two columns: month (YYYY-MM) and revenue (delivered revenue, sum of quantity × unit_price, rounded to 2 decimals), one row per month.",
        referenceScript: `CREATE VIEW v_monthly_revenue AS ${body("WHERE o.status = 'delivered'")};`,
        mistakeScript: `CREATE VIEW v_monthly_revenue AS ${body("")};`,
        probes: [probe("The view returns the right months and revenue", "SELECT month, revenue FROM v_monthly_revenue")],
        previewQuery: "SELECT month, revenue FROM v_monthly_revenue ORDER BY month",
      });
    },
  },
  {
    ...defs.index,
    build(rng) {
      const [table, column, other] = rng.pick([["orders", "customer_id", "order_date"], ["order_items", "order_id", "product_id"], ["order_items", "product_id", "order_id"]] as const);
      const found = (c: string) => `SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END AS has_index FROM sqlite_master WHERE type = 'index' AND tbl_name = '${table}' AND sql LIKE '%(${c}%'`;
      return make(defs.index, ["SQL", "Indexes", "Performance"], {
        title: `Lookups by ${column} on ${table} are slow`,
        requester: cast.sales,
        scenario: `Hello, the ${table} screen in our admin tool takes forever when we look rows up by ${column}. Engineering says the database needs an index. Can you add the right one?`,
        deliverable: `Create an index on ${table} that starts with the ${column} column (any index name).`,
        referenceScript: `CREATE INDEX idx_${table}_${column} ON ${table}(${column});`,
        mistakeScript: `CREATE INDEX idx_${table}_${other} ON ${table}(${other});`,
        probes: [probe(`An index on ${table}.${column} exists`, found(column))],
        previewQuery: `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = '${table}'`,
      });
    },
  },
  {
    ...defs.cleanup,
    build(rng) {
      const date = rng.pick(["2026-04-01", "2026-05-01", "2026-06-01"]);
      return make(defs.cleanup, ["SQL", "DELETE", "Referential integrity"], {
        title: `Purge old cancelled orders (before ${date})`,
        requester: cast.finance,
        scenario: `Hi, the warehouse is cluttered. Cancelled orders placed before ${date} can go, along with their items, because nothing refers to them any more. Be careful not to leave item rows pointing at orders that no longer exist.`,
        deliverable: `Delete the cancelled orders placed before ${date} and all their rows in order_items. No order_items row may be left without its order.`,
        referenceScript: `DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE status = 'cancelled' AND order_date < '${date}'); DELETE FROM orders WHERE status = 'cancelled' AND order_date < '${date}';`,
        mistakeScript: `DELETE FROM orders WHERE status = 'cancelled' AND order_date < '${date}';`,
        probes: [
          probe("The right orders were removed", "SELECT COUNT(*) AS orders FROM orders"),
          probe("The right items were removed", "SELECT COUNT(*) AS items FROM order_items"),
          probe("No orphaned items remain", "SELECT COUNT(*) AS orphans FROM order_items WHERE order_id NOT IN (SELECT order_id FROM orders)"),
        ],
        previewQuery: "SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM order_items) AS items",
      });
    },
  },
  {
    ...defs.trigger,
    build() {
      const audit = { name: "order_audit", columns: [{ name: "order_id", type: "number" as const }, { name: "old_status", type: "text" as const }, { name: "new_status", type: "text" as const }], rows: [] };
      const trigger = (when: string) => `CREATE TRIGGER trg_order_status_audit AFTER UPDATE OF status ON orders ${when} BEGIN INSERT INTO order_audit (order_id, old_status, new_status) VALUES (OLD.order_id, OLD.status, NEW.status); END;`;
      return make(defs.trigger, ["SQL", "Triggers", "Auditing"], {
        title: "Keep an audit trail of order status changes",
        requester: cast.finance,
        scenario: "Hello, the auditors asked who changed what on our orders. We can't log users yet, but we must record every real status change. An update that leaves the status as it was is not a change, so it must not be logged. The empty table order_audit is already waiting for you.",
        deliverable: "Create a trigger on orders that, after the status column is updated to a different value, inserts a row into order_audit with the order_id, the old status and the new status. Updates that keep the same status must not be logged.",
        referenceScript: trigger("WHEN OLD.status <> NEW.status"),
        mistakeScript: trigger(""),
        extraTables: [audit],
        probes: [
          probe("Change some statuses", "UPDATE orders SET status = 'cancelled' WHERE status = 'shipped' AND order_date < '2026-07-01'", false),
          probe("Touch a status without changing it", "UPDATE orders SET status = status WHERE order_id <= 10", false),
          probe("Only the real changes were logged", "SELECT order_id, old_status, new_status FROM order_audit ORDER BY order_id"),
        ],
        previewQuery: "SELECT COUNT(*) AS audit_rows FROM order_audit",
      });
    },
  },
  {
    ...defs.normalise,
    build() {
      const script = (city: string) => `CREATE TABLE cities (city_id INTEGER PRIMARY KEY, city TEXT); INSERT INTO cities (city) SELECT DISTINCT ${city} FROM customers ORDER BY 1; ALTER TABLE customers ADD COLUMN city_id INTEGER; UPDATE customers SET city_id = (SELECT city_id FROM cities WHERE cities.city = ${city});`;
      return make(defs.normalise, ["SQL", "Schema design", "Data migration", "Normalisation"], {
        title: "Move cities into their own table without losing a customer",
        requester: cast.sales,
        scenario: "Hi, we are about to add city-level targets, so cities need to be a proper table instead of free text. Please migrate the data safely: clean the names first, create the lookup table, point every customer at it, and don't lose or duplicate a single customer.",
        deliverable: "Create a table cities(city_id INTEGER PRIMARY KEY, city TEXT) holding each cleaned city (trimmed, capital first letter, lowercase rest) exactly once. Add customers.city_id and set it for every customer to the matching city.",
        referenceScript: script(CLEAN("city")),
        mistakeScript: script("TRIM(city)"),
        probes: [
          probe("Each city exists once", "SELECT COUNT(*) AS cities FROM cities"),
          probe("Every customer points at a city", "SELECT COUNT(*) AS unlinked FROM customers WHERE city_id IS NULL"),
          probe("No customer was lost", "SELECT COUNT(*) AS customers FROM customers"),
          probe("Customers per city are right", "SELECT ci.city, COUNT(*) AS customers FROM customers c JOIN cities ci ON ci.city_id = c.city_id GROUP BY ci.city"),
        ],
        previewQuery: "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      });
    },
  },
];

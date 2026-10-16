import { BRIGHTCART } from "../worlds/brightcart";
import type { TicketTemplate } from "./types";
import { LINE, attempt, emptyTable, LOG_TABLE, makeScript, probe, readLog } from "./pg-support";

const { cast } = BRIGHTCART;
const AREAS = ["programmability"];

const D = {
  total: { id: "pg-order-total-function", difficulty: "easy", minLevel: "junior", taskKind: "function", areas: AREAS },
  tier: { id: "pg-customer-tier-function", difficulty: "medium", minLevel: "junior", taskKind: "function", areas: AREAS },
  cancel: { id: "pg-cancel-order-procedure", difficulty: "medium", minLevel: "mid", taskKind: "procedure", areas: AREAS },
  trigger: { id: "pg-status-audit-trigger", difficulty: "hard", minLevel: "mid", taskKind: "trigger", areas: AREAS },
  topN: { id: "pg-top-customers-function", difficulty: "hard", minLevel: "mid", taskKind: "function", areas: AREAS },
} as const satisfies Record<string, Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind" | "areas">>;

const BIGGEST_ORDER = "(SELECT order_id FROM order_items GROUP BY order_id ORDER BY COUNT(*) DESC, order_id LIMIT 1)";

export const PG_PROGRAMMABILITY: TicketTemplate[] = [
  {
    ...D.total,
    build() {
      const fn = (wrap: (e: string) => string) => `CREATE FUNCTION order_total(p_order_id integer) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT ${wrap(`SUM(quantity * unit_price)`)} FROM order_items WHERE order_id = p_order_id $$;`;
      return makeScript(D.total, ["PostgreSQL", "Functions", "SQL"], {
        title: "A reusable function for the value of an order",
        requester: cast.engineering,
        scenario: "Hi, three different services each calculate an order's value their own way and the numbers never match. Can you put the calculation in the database as a function so everyone calls the same thing?",
        deliverable: "Create a function order_total(p_order_id integer) that returns the sum of quantity × unit_price of that order's items as numeric. For an order that does not exist (or has no items) it must return 0, not NULL.",
        referenceScript: fn((e) => `COALESCE(${e}, 0)`),
        mistakeScript: fn((e) => e),
        probes: [
          probe("It totals a real order correctly", `SELECT order_total(${BIGGEST_ORDER}) AS total`),
          probe("It returns 0 for an order that does not exist", "SELECT order_total(999999) AS total"),
        ],
        previewQuery: `SELECT order_id, ROUND(SUM(${LINE}), 2) AS total FROM order_items oi GROUP BY order_id ORDER BY order_id LIMIT 5`,
      });
    },
  },
  {
    ...D.tier,
    build(rng) {
      const [gold, silver] = rng.pick([[6000, 2500], [5000, 2000], [7000, 3000]] as const);
      const fn = (statusFilter: string) => `CREATE FUNCTION customer_tier(p_customer_id integer) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE v numeric;
BEGIN
  SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) INTO v FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.customer_id = p_customer_id ${statusFilter};
  RETURN CASE WHEN v >= ${gold} THEN 'Gold' WHEN v >= ${silver} THEN 'Silver' ELSE 'Bronze' END;
END $$;`;
      return makeScript(D.tier, ["PostgreSQL", "PL/pgSQL", "Functions"], {
        title: "Loyalty tier of a customer, in one function",
        requester: cast.marketing,
        scenario: `Hello, we are launching a loyalty programme and the app needs to ask the database "what tier is this customer?". Gold starts at ₹${gold.toLocaleString("en-IN")} of delivered spend, Silver at ₹${silver.toLocaleString("en-IN")}, everyone else is Bronze. Returned and cancelled orders should not count towards a tier.`,
        deliverable: `Create a function customer_tier(p_customer_id integer) returning text: 'Gold' when the customer's delivered spend (sum of quantity × unit_price on delivered orders) is at least ${gold}, 'Silver' when at least ${silver}, otherwise 'Bronze'. Use PL/pgSQL.`,
        referenceScript: fn("AND o.status = 'delivered'"),
        mistakeScript: fn(""),
        probes: [
          probe("Customers per tier are right", "SELECT customer_tier(customer_id) AS tier, COUNT(*) AS customers FROM customers GROUP BY 1"),
          probe("The first customers get the right tier", "SELECT customer_id, customer_tier(customer_id) AS tier FROM customers ORDER BY customer_id LIMIT 15"),
        ],
        previewQuery: "SELECT customer_id, name FROM customers ORDER BY customer_id LIMIT 5",
      });
    },
  },
  {
    ...D.cancel,
    build() {
      const proc = (guard: string) => `CREATE PROCEDURE cancel_order(p_order_id integer) LANGUAGE plpgsql AS $$
BEGIN
  ${guard}
  UPDATE orders SET status = 'cancelled' WHERE order_id = p_order_id;
END $$;`;
      const guard = `IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = p_order_id AND status = 'shipped') THEN RAISE EXCEPTION 'only shipped orders can be cancelled'; END IF;`;
      return makeScript(D.cancel, ["PostgreSQL", "Stored procedures", "Error handling"], {
        title: "A safe 'cancel order' procedure for the support team",
        requester: cast.success,
        scenario: "Hi, support agents cancel orders by hand-editing rows and last week someone cancelled an order that was already delivered. Please give them a procedure that only cancels orders that are still in transit, and refuses anything else with a clear error.",
        deliverable: "Create a procedure cancel_order(p_order_id integer). It sets the order's status to 'cancelled' only if the current status is 'shipped'; for any other order it must raise an exception with the message 'only shipped orders can be cancelled' and change nothing.",
        referenceScript: proc(guard),
        mistakeScript: proc(""),
        probes: [
          LOG_TABLE,
          // CALL cannot take a subquery, so a tiny helper finds an order in the wanted status
          probe("Helper that finds an order", "CREATE FUNCTION pick_order(s text) RETURNS integer LANGUAGE sql AS $$ SELECT MIN(order_id) FROM orders WHERE status = s $$", false),
          probe("Cancel a shipped order", "CALL cancel_order(pick_order('shipped'))", false),
          attempt(1, "CALL cancel_order(pick_order('delivered'))"),
          probe("Only the shipped order was cancelled", "SELECT status, COUNT(*) AS orders FROM orders GROUP BY status"),
          readLog("A delivered order is refused"),
        ],
        previewQuery: "SELECT status, COUNT(*) AS orders FROM orders GROUP BY status",
      });
    },
  },
  {
    ...D.trigger,
    build() {
      const trigger = (when: string) => `CREATE FUNCTION log_order_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO order_audit (order_id, old_status, new_status) VALUES (OLD.order_id, OLD.status, NEW.status);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_order_status AFTER UPDATE OF status ON orders FOR EACH ROW ${when} EXECUTE FUNCTION log_order_status();`;
      return makeScript(D.trigger, ["PostgreSQL", "Triggers", "PL/pgSQL", "Auditing"], {
        title: "Audit every real change to an order's status",
        requester: cast.finance,
        scenario: "Hello, the auditors want a history of order status changes. Whatever updates an order, the database itself must record the change. Saving a row without changing its status is noise and must not be logged. The empty order_audit table is ready for you.",
        deliverable: "Create a trigger (and its function) on orders so that, after the status column is updated to a different value, one row is inserted into order_audit with order_id, old_status and new_status. Updates that leave the status as it was must not be logged.",
        referenceScript: trigger("WHEN (OLD.status IS DISTINCT FROM NEW.status)"),
        mistakeScript: trigger(""),
        extraTables: [emptyTable("order_audit", [{ name: "order_id", type: "number" }, { name: "old_status", type: "text" }, { name: "new_status", type: "text" }])],
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
    ...D.topN,
    build() {
      const fn = (order: string) => `CREATE FUNCTION top_customers(p_limit integer) RETURNS TABLE (customer_id integer, name text, revenue numeric) LANGUAGE sql STABLE AS $$
  SELECT c.customer_id, c.name, ROUND(SUM(oi.quantity * oi.unit_price), 2)
  FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'delivered' GROUP BY c.customer_id, c.name ORDER BY ${order} LIMIT p_limit
$$;`;
      return makeScript(D.topN, ["PostgreSQL", "Set-returning functions", "Ranking"], {
        title: "A top-customers function the dashboard can call",
        requester: cast.data,
        scenario: "Hi, the dashboard needs a 'top N customers' tile where N changes with the screen size. Rather than rebuild the query in the app, can you expose it as a function that returns a table?",
        deliverable: "Create a function top_customers(p_limit integer) returning a table (customer_id integer, name text, revenue numeric): the p_limit customers with the highest delivered revenue (sum of quantity × unit_price, rounded to 2 decimals), highest first.",
        referenceScript: fn("3 DESC, 1"),
        mistakeScript: fn("COUNT(DISTINCT o.order_id) DESC, 1"),
        probes: [probe("Top 3 customers are right", "SELECT customer_id, name, revenue FROM top_customers(3)"), probe("Top 5 customers are right", "SELECT customer_id, name, revenue FROM top_customers(5)")],
        previewQuery: "SELECT customer_id, name FROM customers ORDER BY customer_id LIMIT 5",
      });
    },
  },
];

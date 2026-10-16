import { BRIGHTCART } from "../worlds/brightcart";
import type { QueryDraft, TicketTemplate } from "./types";
import { monthName, monthWindow } from "./time";
import { LINE, LOG_TABLE, attempt, makeScript, probe, readLog } from "./pg-support";

const { cast } = BRIGHTCART;
type Def = Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind" | "areas">;
type QueryParts = Omit<QueryDraft, "kind" | "templateId" | "difficulty" | "minLevel" | "taskKind" | "skillTags">;

const QUERY_AREAS = ["queries", "views"];
const D = {
  cohort: { id: "pg-expert-cohort-retention", difficulty: "hard", minLevel: "expert", taskKind: "analytics", areas: QUERY_AREAS },
  pareto: { id: "pg-expert-revenue-concentration", difficulty: "hard", minLevel: "expert", taskKind: "analytics", areas: QUERY_AREAS },
  reorder: { id: "pg-expert-reorder-gap", difficulty: "hard", minLevel: "expert", taskKind: "analytics", areas: QUERY_AREAS },
  streak: { id: "pg-expert-buying-streak", difficulty: "hard", minLevel: "expert", taskKind: "analytics", areas: QUERY_AREAS },
  summary: { id: "pg-monthly-summary-table", difficulty: "medium", minLevel: "mid", taskKind: "view", areas: ["transformation", "views"] },
  snapshot: { id: "pg-latest-order-snapshot", difficulty: "medium", minLevel: "mid", taskKind: "view", areas: ["transformation"] },
  changedOnly: { id: "pg-expert-changed-only-upsert", difficulty: "hard", minLevel: "expert", taskKind: "upsert", areas: ["transformation"] },
  running: { id: "pg-debug-running-total", difficulty: "hard", minLevel: "senior", taskKind: "debug", areas: ["debugging"] },
  average: { id: "pg-debug-average-orders", difficulty: "medium", minLevel: "mid", taskKind: "debug", areas: ["debugging"] },
  oneActive: { id: "pg-expert-one-active-subscription", difficulty: "hard", minLevel: "expert", taskKind: "constraint", areas: ["integrity"] },
} as const satisfies Record<string, Def>;

const query = (d: Def, skillTags: string[], parts: QueryParts): QueryDraft => ({ kind: "query", templateId: d.id, difficulty: d.difficulty, minLevel: d.minLevel, taskKind: d.taskKind, skillTags: ["PostgreSQL", ...skillTags], ...parts });
const debug = (d: Def, skillTags: string[], parts: Omit<QueryParts, "referenceQuery" | "mistakeQuery" | "starterQuery"> & { broken: string; fixed: string }): QueryDraft => {
  const { broken, fixed, ...rest } = parts;
  return query(d, ["SQL debugging", ...skillTags], { referenceQuery: fixed, mistakeQuery: broken, starterQuery: broken, ...rest });
};

/**
 * The deepest Postgres tickets: business questions where the metric's definition matters, loads that must touch only what changed,
 * and rules that apply to some rows only. The plausible wrong answer is the one most people reach for first.
 */
export const PG_EXPERT: TicketTemplate[] = [
  {
    ...D.cohort,
    build() {
      const q = (retained: string) => `WITH c AS (SELECT customer_id, to_char(signup_date, 'YYYY-MM') AS cohort, date_trunc('month', signup_date)::date AS m0, (date_trunc('month', signup_date) + interval '1 month')::date AS m1 FROM customers), r AS (SELECT c.cohort, c.customer_id, MAX(CASE WHEN o.status = 'delivered' AND ${retained} THEN 1 ELSE 0 END) AS retained FROM c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.cohort, c.customer_id) SELECT cohort, COUNT(*) AS customers, SUM(retained) AS retained, ROUND(100.0 * SUM(retained) / COUNT(*), 1) AS retention_pct FROM r GROUP BY cohort ORDER BY cohort`;
      return query(D.cohort, ["Cohort analysis", "Retention", "CTEs", "Date arithmetic"], {
        title: "Month-1 retention by signup cohort", requester: cast.marketing,
        scenario: "Hi, I keep being asked whether the customers we win actually stay. Define it like this: a customer is retained if they get a delivered order in the calendar month after the month they signed up. I need that for each signup-month cohort, with the number of customers and how many were retained. Be careful with the definition, last time someone counted the signup month itself.",
        deliverable: "One row per signup month, ordered by cohort: cohort (YYYY-MM), customers (signed up that month), retained (those with at least one delivered order in the following calendar month) and retention_pct (retained ÷ customers × 100, one decimal).",
        referenceQuery: q("o.order_date >= c.m1 AND o.order_date < (c.m1 + interval '1 month')"), mistakeQuery: q("o.order_date >= c.m0 AND o.order_date < c.m1"),
      });
    },
  },
  {
    ...D.pareto,
    build(rng) {
      const w = monthWindow(rng.int(6, 9));
      const q = (order: string) => `WITH rev AS (SELECT o.customer_id, SUM(${LINE}) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND o.order_date < '${w.end}' GROUP BY o.customer_id), ranked AS (SELECT revenue, ROW_NUMBER() OVER (ORDER BY revenue ${order}, customer_id) AS rn FROM rev), cut AS (SELECT (COUNT(*) + 4) / 5 AS top_n FROM rev) SELECT (SELECT top_n FROM cut) AS top_customers, ROUND(100.0 * SUM(CASE WHEN rn <= (SELECT top_n FROM cut) THEN revenue ELSE 0 END) / SUM(revenue), 1) AS top_share_pct FROM ranked`;
      return query(D.pareto, ["Window functions", "Concentration", "Pareto analysis"], {
        title: `How concentrated is our revenue, up to ${monthName(Number(w.start.slice(5, 7)))}?`, requester: cast.finance,
        scenario: "Hello, the board asks whether we depend on a few big customers. Take every customer who has a delivered order up to the end of the month named above, rank them by delivered revenue, and tell me how many make up the top 20% (round up) and what share of the revenue they bring.",
        deliverable: "One row: top_customers (20% of the customers who bought, rounded up) and top_share_pct (their share of total delivered revenue, as a percentage with one decimal).",
        referenceQuery: q("DESC"), mistakeQuery: q("ASC"),
      });
    },
  },
  {
    ...D.reorder,
    build(rng) {
      const w = monthWindow(rng.int(7, 9));
      const q = (second: string) => `WITH d AS (SELECT o.customer_id, o.order_date, ROW_NUMBER() OVER (PARTITION BY o.customer_id ORDER BY o.order_date, o.order_id) AS rn FROM orders o WHERE o.status = 'delivered' AND o.order_date < '${w.end}'), g AS (SELECT a.customer_id, b.order_date - a.order_date AS gap FROM d a JOIN d b ON a.customer_id = b.customer_id AND a.rn = 1 AND b.rn ${second}) SELECT c.segment, COUNT(*) AS customers, ROUND(AVG(g.gap), 1) AS avg_days FROM g JOIN customers c ON c.customer_id = g.customer_id GROUP BY c.segment ORDER BY c.segment`;
      return query(D.reorder, ["Window functions", "Self-joins", "Customer behaviour"], {
        title: "How long do customers wait before buying again?", requester: cast.marketing,
        scenario: "Hi, we want to time our win-back message. For customers with at least two delivered orders, how many days pass between their first and their second delivered order, on average, for each customer segment? Only orders up to the end of the month named above count.",
        deliverable: "One row per segment, ordered by segment: customers (with at least two delivered orders) and avg_days (average days between their first and second delivered order, one decimal).",
        referenceQuery: q("= 2"), mistakeQuery: q("= (SELECT MAX(rn) FROM d d2 WHERE d2.customer_id = a.customer_id)"),
      });
    },
  },
  {
    ...D.streak,
    build(rng) {
      const w = monthWindow(rng.int(7, 9));
      const months = `SELECT DISTINCT customer_id, date_trunc('month', order_date)::date AS mon FROM orders WHERE status = 'delivered' AND order_date < '${w.end}'`;
      const reference = `WITH m AS (${months}), g AS (SELECT customer_id, (EXTRACT(YEAR FROM mon) * 12 + EXTRACT(MONTH FROM mon))::int - ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY mon)::int AS grp FROM m), s AS (SELECT customer_id, COUNT(*) AS len FROM g GROUP BY customer_id, grp) SELECT COUNT(DISTINCT customer_id) AS loyal_customers FROM s WHERE len >= 3`;
      const mistake = `WITH m AS (${months}) SELECT COUNT(*) AS loyal_customers FROM (SELECT customer_id FROM m GROUP BY customer_id HAVING COUNT(*) >= 3) x`;
      return query(D.streak, ["Gaps and islands", "Window functions", "Customer loyalty"], {
        title: "Who buys three months in a row?", requester: cast.success,
        scenario: "Hello, we want to reward loyal customers: those who bought something (a delivered order) in three consecutive calendar months at some point. Customers who bought in three months with a gap in between are not the same thing. Only orders up to the end of the month named above count.",
        deliverable: "One row: loyal_customers, the number of customers with delivered orders in at least three consecutive calendar months.",
        referenceQuery: reference, mistakeQuery: mistake,
      });
    },
  },
  {
    ...D.summary,
    build(rng) {
      const w = monthWindow(rng.int(1, 4));
      const script = (filter: string) => `CREATE TABLE monthly_category_revenue AS SELECT to_char(o.order_date, 'YYYY-MM') AS month, p.category, ROUND(SUM(${LINE}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.order_date >= '${w.start}'${filter} GROUP BY 1, 2;`;
      return makeScript(D.summary, ["PostgreSQL", "CREATE TABLE AS", "Aggregation", "Reporting tables"], {
        title: "Pre-compute monthly revenue by category for the dashboards", requester: cast.finance,
        scenario: `Hi, the dashboards recompute revenue by category on every refresh and it is slow. Please build a small summary table once. Only delivered orders count as revenue, and we only need months from ${w.label} onwards.`,
        deliverable: `Create a table monthly_category_revenue with columns month (YYYY-MM), category and revenue (delivered revenue rounded to 2 decimals), one row per month and category, for orders placed on or after ${w.start}.`,
        referenceScript: script(" AND o.status = 'delivered'"), mistakeScript: script(""),
        probes: [
          probe("Each month holds the right figures", "SELECT month, COUNT(*) AS rows, SUM(revenue) AS revenue FROM monthly_category_revenue GROUP BY month ORDER BY month"),
          probe("Each category holds the right figures", "SELECT category, COUNT(*) AS rows, SUM(revenue) AS revenue FROM monthly_category_revenue GROUP BY category ORDER BY category"),
        ],
        previewQuery: "SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY status",
      });
    },
  },
  {
    ...D.snapshot,
    build() {
      const script = (order: string) => `CREATE TABLE customer_last_order AS SELECT DISTINCT ON (customer_id) customer_id, order_id, order_date FROM orders WHERE status <> 'cancelled' ORDER BY customer_id, order_date ${order}, order_id ${order};`;
      return makeScript(D.snapshot, ["PostgreSQL", "DISTINCT ON", "CREATE TABLE AS", "Snapshots"], {
        title: "Keep each customer's most recent order in one table", requester: cast.success,
        scenario: "Hello, the support team keeps asking \"when did this customer last order, and which order was it?\" and the answer should not need a query on the big orders table each time. Please build a table with exactly one row per customer: their latest order that was not cancelled. If a customer has two orders on the same day, take the one with the higher order_id.",
        deliverable: "Create a table customer_last_order with columns customer_id, order_id and order_date: one row per customer who has at least one non-cancelled order, holding their most recent such order.",
        referenceScript: script("DESC"), mistakeScript: script("ASC"),
        probes: [probe("Every customer has their latest order", "SELECT COUNT(*) AS customers, SUM(order_id) AS order_total, SUM(order_date - DATE '2026-01-01') AS day_total FROM customer_last_order")],
        previewQuery: "SELECT customer_id, order_id, order_date, status FROM orders WHERE customer_id <= 3 ORDER BY customer_id, order_date, order_id",
      });
    },
  },
  {
    ...D.changedOnly,
    build(rng) {
      const moved = rng.shuffle(Array.from({ length: 12 }, (_, i) => i + 1)).slice(0, 4);
      const conflict = (guard: string) => `INSERT INTO customer_city_dim (customer_id, city, updated_at) SELECT customer_id, city, DATE '2026-10-01' FROM customer_updates ON CONFLICT (customer_id) DO UPDATE SET city = EXCLUDED.city, updated_at = EXCLUDED.updated_at${guard};`;
      return makeScript(D.changedOnly, ["PostgreSQL", "UPSERT", "IS DISTINCT FROM", "Incremental loads"], {
        title: "Load the customer feed, but only touch rows that really changed", requester: cast.data,
        scenario: "Hi, the nightly feed in customer_updates lists the city of every customer it knows about, but only a few have actually moved. The dimension table keeps an updated_at date that downstream jobs use to find changes, and last night every row got stamped as changed, so they re-processed everything. Please load the feed so that new customers are added and existing ones are updated only when their city really differs.",
        deliverable: "Write one statement that loads customer_updates into customer_city_dim: new customers are inserted, and an existing customer gets the new city and updated_at = 2026-10-01 only if the city differs from the one stored. Rows whose city is unchanged must keep their old updated_at.",
        referenceScript: conflict(" WHERE customer_city_dim.city IS DISTINCT FROM EXCLUDED.city"), mistakeScript: conflict(""),
        extraSetupSql: [
          "CREATE TABLE customer_city_dim AS SELECT customer_id, INITCAP(TRIM(city)) AS city, DATE '2000-01-01' AS updated_at FROM customers;",
          "ALTER TABLE customer_city_dim ADD PRIMARY KEY (customer_id);",
          "CREATE TABLE customer_updates AS SELECT customer_id, INITCAP(TRIM(city)) AS city FROM customers WHERE customer_id <= 12;",
          `UPDATE customer_updates SET city = 'Mysuru' WHERE customer_id IN (${moved.join(", ")}) AND city <> 'Mysuru';`,
          "INSERT INTO customer_updates VALUES (101, 'Pune'), (102, 'Kochi');",
        ].join("\n"),
        probes: [
          probe("Only changed rows are stamped", "SELECT COUNT(*) FILTER (WHERE updated_at = DATE '2026-10-01') AS touched, COUNT(*) AS total FROM customer_city_dim"),
          probe("Cities are right after the load", "SELECT city, COUNT(*) AS customers FROM customer_city_dim GROUP BY city ORDER BY city"),
        ],
        previewQuery: "SELECT u.customer_id, u.city AS feed_city, d.city AS stored_city FROM customer_updates u LEFT JOIN customer_city_dim d USING (customer_id) ORDER BY u.customer_id",
      });
    },
  },
  {
    ...D.running,
    build(rng) {
      const w = monthWindow(rng.int(3, 8));
      const q = (over: string) => `WITH t AS (SELECT o.order_id, o.order_date, SUM(${LINE}) AS order_total FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND o.order_date >= '${w.start}' AND o.order_date < '${w.start.slice(0, 8)}21' GROUP BY o.order_id, o.order_date) SELECT order_id, order_date, ROUND(order_total, 2) AS order_total, ROUND(SUM(order_total) OVER (${over}), 2) AS running_total FROM t ORDER BY order_date, order_id`;
      return debug(D.running, ["Window functions", "Window frames"], {
        title: "Fix: the running total repeats itself on busy days", requester: cast.finance,
        scenario: `Hello, in the cash report for the first 20 days of ${w.label} the running total is identical for every order placed on the same day, as if the whole day arrived at once. It should grow with each order, in order of order_id within a day. The query uses a window function and I cannot see what is wrong.`,
        deliverable: `Fix the query so running_total grows order by order across the first 20 days of ${w.label}: ordered by order_date and then order_id, each row adding its own order_total to everything before it.`,
        broken: q("ORDER BY order_date"), fixed: q("ORDER BY order_date, order_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW"),
      });
    },
  },
  {
    ...D.average,
    build(rng) {
      const w = monthWindow(rng.int(4, 9));
      const frame = (counted: string) => `SELECT ROUND(AVG(n), 2) AS avg_orders FROM (${counted}) x`;
      return debug(D.average, ["LEFT JOIN", "Aggregation grain", "NULL handling"], {
        title: "Fix: the average orders per customer looks too good", requester: cast.sales,
        scenario: `Hi, the board slide says each customer places about ${monthName(Number(w.start.slice(5, 7)))}-to-date delivered orders at a rate that feels too high compared with what I see on the ground. The average seems to leave out customers who haven't ordered at all.`,
        deliverable: `Fix the query so avg_orders is the average number of delivered orders per customer up to the end of ${w.label}, counting every customer, including those with no delivered order (they count as 0).`,
        broken: frame(`SELECT customer_id, COUNT(*) AS n FROM orders WHERE status = 'delivered' AND order_date < '${w.end}' GROUP BY customer_id`),
        fixed: frame(`SELECT c.customer_id, COUNT(o.order_id) AS n FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered' AND o.order_date < '${w.end}' GROUP BY c.customer_id`),
      });
    },
  },
  {
    ...D.oneActive,
    build() {
      const script = (index: string) => `${index};`;
      return makeScript(D.oneActive, ["PostgreSQL", "Partial unique index", "Business rules", "Data integrity"], {
        title: "A customer may have only one active subscription", requester: cast.engineering,
        scenario: "Hello, support found customers billed twice because they ended up with two active subscriptions. A customer may have many cancelled subscriptions over the years, but never more than one active at a time. Please make the database enforce that, since the application has failed to.",
        deliverable: "Create a unique index one_active_subscription on subscriptions (customer_id) that applies only to rows with status 'active', so a second active subscription is refused while any number of cancelled ones is still allowed.",
        referenceScript: script("CREATE UNIQUE INDEX one_active_subscription ON subscriptions (customer_id) WHERE status = 'active'"), mistakeScript: script("CREATE UNIQUE INDEX one_active_subscription ON subscriptions (customer_id, status)"),
        extraSetupSql: [
          "CREATE TABLE subscriptions (sub_id integer PRIMARY KEY, customer_id integer NOT NULL, status text NOT NULL);",
          "INSERT INTO subscriptions SELECT customer_id, customer_id, 'active' FROM customers WHERE customer_id <= 30;",
          "INSERT INTO subscriptions SELECT 100 + customer_id, customer_id, 'cancelled' FROM customers WHERE customer_id <= 10;",
        ].join("\n"),
        probes: [
          LOG_TABLE,
          attempt(1, "INSERT INTO subscriptions VALUES (900, 1, 'active')"),
          attempt(2, "INSERT INTO subscriptions VALUES (901, 1, 'cancelled')"),
          attempt(3, "INSERT INTO subscriptions VALUES (902, 40, 'active')"),
          readLog("A second active subscription is refused, anything else is allowed"),
        ],
        previewQuery: "SELECT customer_id, status, COUNT(*) AS subscriptions FROM subscriptions WHERE customer_id <= 3 GROUP BY customer_id, status ORDER BY customer_id, status",
      });
    },
  },
];

import { BRIGHTCART } from "../worlds/brightcart";
import type { TicketTemplate } from "./types";
import { monthName, quarterWindow } from "./time";

const { cast } = BRIGHTCART;
const LINE = "oi.quantity * oi.unit_price";

export const HARD_TEMPLATES: TicketTemplate[] = [
  {
    id: "mom-growth",
    difficulty: "hard",
    minLevel: "mid",
    taskKind: "retrieval",
    build(rng) {
      const month = rng.int(5, 9);
      const end = month === 9 ? "2026-10-01" : `2026-0${month + 1}-01`;
      const monthly = `SELECT SUBSTR(o.order_date, 1, 7) AS month, ROUND(SUM(${LINE}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND o.order_date < '${end}' GROUP BY 1`;
      return {
        templateId: "mom-growth",
        difficulty: "hard",
        kind: "query",
        minLevel: "mid",
        taskKind: "retrieval",
        title: `Month-on-month growth up to ${monthName(month)}`,
        requester: cast.finance,
        scenario: `Hi, for the investor update I need the revenue trend, not just totals. Show each month's delivered revenue and how much it grew or shrank against the month before, as a percentage.`,
        deliverable: `One row per month from January 2026 to ${monthName(month)} 2026, ordered by month: month (YYYY-MM), revenue (delivered, rounded to 2 decimals) and mom_growth_pct ((revenue − previous month revenue) ÷ previous month revenue × 100, one decimal; the first month has no previous month, so leave it empty).`,
        referenceQuery: `WITH m AS (${monthly}) SELECT month, revenue, ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month)) / LAG(revenue) OVER (ORDER BY month), 1) AS mom_growth_pct FROM m ORDER BY month`,
        mistakeQuery: `WITH m AS (${monthly}) SELECT month, revenue, ROUND(revenue - LAG(revenue) OVER (ORDER BY month), 1) AS mom_growth_pct FROM m ORDER BY month`,
        skillTags: ["SQL", "Window functions", "CTEs"],
      };
    },
  },
  {
    id: "win-back",
    difficulty: "hard",
    minLevel: "mid",
    taskKind: "retrieval",
    build(rng) {
      const w = quarterWindow(rng.int(2, 3));
      const lapsed = `SELECT DISTINCT customer_id FROM orders WHERE status = 'delivered' AND order_date < '${w.start}' AND customer_id NOT IN (SELECT customer_id FROM orders WHERE status = 'delivered' AND order_date >= '${w.start}' AND order_date < '${w.end}')`;
      return {
        templateId: "win-back",
        difficulty: "hard",
        kind: "query",
        minLevel: "mid",
        taskKind: "retrieval",
        title: `Win-back list for ${w.label}`,
        requester: cast.marketing,
        scenario: `Hello, we want to send a "we miss you" offer. Who used to buy from us but did not complete a single order in ${w.label}? I need to know how many people that is and how much they spent with us before, so I can size the offer.`,
        deliverable: `One row: lapsed_customers (customers with a delivered order before ${w.start} and no delivered order during ${w.label}) and past_revenue (their total delivered revenue before ${w.start}, rounded to 2 decimals).`,
        referenceQuery: `WITH lapsed AS (${lapsed}) SELECT COUNT(DISTINCT l.customer_id) AS lapsed_customers, ROUND(SUM(${LINE}), 2) AS past_revenue FROM lapsed l JOIN orders o ON o.customer_id = l.customer_id AND o.status = 'delivered' AND o.order_date < '${w.start}' JOIN order_items oi ON oi.order_id = o.order_id`,
        mistakeQuery: `SELECT COUNT(*) AS lapsed_customers, ROUND(0, 2) AS past_revenue FROM customers WHERE customer_id NOT IN (SELECT customer_id FROM orders WHERE status = 'delivered' AND order_date >= '${w.start}' AND order_date < '${w.end}')`,
        skillTags: ["SQL", "Anti-join", "Subqueries"],
      };
    },
  },
  {
    id: "running-total",
    difficulty: "hard",
    minLevel: "mid",
    taskKind: "retrieval",
    build(rng) {
      const category = rng.pick(BRIGHTCART.categories);
      const monthly = `SELECT SUBSTR(o.order_date, 1, 7) AS month, SUM(${LINE}) AS rev FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status = 'delivered' AND p.category = '${category}' GROUP BY 1`;
      return {
        templateId: "running-total",
        difficulty: "hard",
        kind: "query",
        minLevel: "mid",
        taskKind: "retrieval",
        title: `${category}: revenue so far this year`,
        requester: cast.category,
        scenario: `Hi, I'm tracking ${category} against its yearly target. Show me how revenue builds up month by month, with a running total, so I can see when we cross the halfway mark.`,
        deliverable: `One row per month in which ${category} had delivered revenue, ordered by month: month (YYYY-MM), revenue (rounded to 2 decimals) and running_total (cumulative revenue up to and including that month, rounded to 2 decimals).`,
        referenceQuery: `WITH m AS (${monthly}) SELECT month, ROUND(rev, 2) AS revenue, ROUND(SUM(rev) OVER (ORDER BY month), 2) AS running_total FROM m ORDER BY month`,
        mistakeQuery: `WITH m AS (${monthly}) SELECT month, ROUND(rev, 2) AS revenue, ROUND(rev, 2) AS running_total FROM m ORDER BY month`,
        skillTags: ["SQL", "Window functions", "Cumulative totals"],
      };
    },
  },
  {
    id: "signup-conversion",
    difficulty: "hard",
    minLevel: "mid",
    taskKind: "retrieval",
    build(rng) {
      const month = rng.int(1, 4);
      const start = `2026-0${month}-01`;
      const end = `2026-0${month + 1}-01`;
      const status = (clause: string, window: string) => `WITH cohort AS (SELECT customer_id, signup_date FROM customers WHERE signup_date >= '${start}' AND signup_date < '${end}'), conv AS (SELECT c.customer_id, CASE WHEN EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id ${clause} AND o.order_date >= c.signup_date${window}) THEN 1 ELSE 0 END AS ok FROM cohort c) SELECT COUNT(*) AS cohort_size, SUM(ok) AS converted, ROUND(100.0 * SUM(ok) / COUNT(*), 1) AS conversion_pct FROM conv`;
      return {
        templateId: "signup-conversion",
        difficulty: "hard",
        kind: "query",
        minLevel: "mid",
        taskKind: "retrieval",
        title: `Did ${monthName(month)}'s signups actually buy?`,
        requester: cast.marketing,
        scenario: `Hi, signups look healthy but I don't trust the vanity number. Of the people who joined in ${monthName(month)}, how many completed a purchase within 30 days of signing up?`,
        deliverable: `One row for customers whose signup_date is in ${monthName(month)} 2026: cohort_size, converted (customers with at least one delivered order placed within 30 days after signing up, the signup day included) and conversion_pct (converted ÷ cohort_size × 100, one decimal).`,
        referenceQuery: status(`AND o.status = 'delivered'`, ` AND o.order_date <= DATE(c.signup_date, '+30 day')`),
        mistakeQuery: status(`AND o.status = 'delivered'`, ""),
        skillTags: ["SQL", "Cohorts", "Date functions", "Correlated subqueries"],
      };
    },
  },
];

import { BRIGHTCART } from "../worlds/brightcart";
import type { QueryDraft, TicketTemplate } from "./types";
import { LINE } from "./pg-support";

const { cast } = BRIGHTCART;
const AREAS = ["queries", "views"];

type Def = Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind" | "areas">;
const D = {
  rolling: { id: "pg-rolling-average", difficulty: "medium", minLevel: "junior", taskKind: "analytics", areas: AREAS },
  bestPerCategory: { id: "pg-best-per-category", difficulty: "medium", minLevel: "junior", taskKind: "analytics", areas: AREAS },
  quartiles: { id: "pg-spend-quartiles", difficulty: "hard", minLevel: "mid", taskKind: "analytics", areas: AREAS },
  quietDays: { id: "pg-quiet-days", difficulty: "hard", minLevel: "mid", taskKind: "analytics", areas: AREAS },
} as const satisfies Record<string, Def>;

const make = (d: Def, skillTags: string[], parts: Omit<QueryDraft, "kind" | "templateId" | "difficulty" | "minLevel" | "taskKind" | "skillTags">): QueryDraft => ({
  kind: "query", templateId: d.id, difficulty: d.difficulty, minLevel: d.minLevel, taskKind: d.taskKind, skillTags, ...parts,
});

export const PG_QUERIES: TicketTemplate[] = [
  {
    ...D.rolling,
    build(rng) {
      const month = rng.int(5, 9);
      const end = month === 9 ? "2026-10-01" : `2026-0${month + 1}-01`;
      const monthly = `SELECT date_trunc('month', o.order_date)::date AS month, SUM(${LINE}) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND o.order_date < '${end}' GROUP BY 1`;
      const q = (frame: string) => `WITH m AS (${monthly}) SELECT to_char(month, 'YYYY-MM') AS month, ROUND(revenue, 2) AS revenue, ROUND(AVG(revenue) OVER (ORDER BY month${frame}), 2) AS moving_avg FROM m ORDER BY month`;
      return make(D.rolling, ["PostgreSQL", "Window functions", "Moving averages"], {
        title: `Smooth the revenue trend up to month ${month}`,
        requester: cast.finance,
        scenario: "Hi, month-to-month revenue jumps around too much for the board deck. Can you show each month's delivered revenue next to a three-month moving average so the trend is clear?",
        deliverable: `One row per month from January 2026 to the end of month ${month}, ordered by month: month (YYYY-MM), revenue (delivered, rounded to 2 decimals) and moving_avg (average of that month and the two months before it, rounded to 2 decimals; the first months average only the months they have).`,
        referenceQuery: q(" ROWS BETWEEN 2 PRECEDING AND CURRENT ROW"),
        mistakeQuery: q(""),
      });
    },
  },
  {
    ...D.bestPerCategory,
    build(rng) {
      const quarter = rng.int(1, 3);
      const start = `2026-0${(quarter - 1) * 3 + 1}-01`;
      const end = quarter === 3 ? "2026-10-01" : `2026-0${quarter * 3 + 1}-01`;
      const q = (dir: string) => `SELECT DISTINCT ON (p.category) p.category, p.product_name, ROUND(SUM(${LINE}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status = 'delivered' AND o.order_date >= '${start}' AND o.order_date < '${end}' GROUP BY p.category, p.product_id, p.product_name ORDER BY p.category, SUM(${LINE}) ${dir}`;
      return make(D.bestPerCategory, ["PostgreSQL", "DISTINCT ON", "Top-N per group"], {
        title: `The star product in every category, Q${quarter}`,
        requester: cast.category,
        scenario: `Hello, for the Q${quarter} review I want one line per category: which product earned the most there? Delivered orders only.`,
        deliverable: `One row per category: category, product_name of the product with the highest delivered revenue in Q${quarter} 2026, and its revenue (sum of quantity × unit_price, rounded to 2 decimals).`,
        referenceQuery: q("DESC"),
        mistakeQuery: q("ASC"),
      });
    },
  },
  {
    ...D.quartiles,
    build(rng) {
      const quarter = rng.int(1, 3);
      const start = `2026-0${(quarter - 1) * 3 + 1}-01`;
      const end = quarter === 3 ? "2026-10-01" : `2026-0${quarter * 3 + 1}-01`;
      const q = (dir: string) => `WITH r AS (SELECT o.customer_id, SUM(${LINE}) AS rev FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND o.order_date >= '${start}' AND o.order_date < '${end}' GROUP BY 1), b AS (SELECT NTILE(4) OVER (ORDER BY rev ${dir}) AS quartile, rev FROM r) SELECT quartile, COUNT(*) AS customers, ROUND(SUM(rev), 2) AS revenue FROM b GROUP BY quartile ORDER BY quartile`;
      return make(D.quartiles, ["PostgreSQL", "NTILE", "Window functions", "Segmentation"], {
        title: `Spend quartiles of Q${quarter} customers`,
        requester: cast.marketing,
        scenario: `Hi, I want to split the customers who bought in Q${quarter} into four equal groups by how much they spent, so I can see how much of our revenue comes from the top group.`,
        deliverable: `Rank customers by delivered revenue in Q${quarter} 2026 (highest first) and split them into 4 groups with NTILE(4), where group 1 is the biggest spenders. Return quartile, customers (how many in the group) and revenue (the group's total, rounded to 2 decimals).`,
        referenceQuery: q("DESC"),
        mistakeQuery: q("ASC"),
      });
    },
  },
  {
    ...D.quietDays,
    build(rng) {
      const month = rng.int(2, 8);
      const days = [31, 28, 31, 30, 31, 30, 31, 31, 30][month - 1];
      const first = `2026-0${month}-01`;
      const last = `2026-0${month}-${String(days).padStart(2, "0")}`;
      const q = (cond: string) => `SELECT COUNT(*) AS quiet_days FROM generate_series(DATE '${first}', DATE '${last}', INTERVAL '1 day') AS d(day) LEFT JOIN orders o ON o.order_date = d.day::date WHERE ${cond}`;
      return make(D.quietDays, ["PostgreSQL", "generate_series", "Outer joins", "Date handling"], {
        title: `How many quiet days did we have in month ${month}?`,
        requester: cast.sales,
        scenario: "Hi, operations is planning staffing and wants to know on how many days of the month no order at all was placed. A day with no orders will not appear in the orders table, so you will need to build the calendar yourself.",
        deliverable: `One row with quiet_days: the number of calendar days in month ${month} of 2026 (${first} to ${last}) on which no order, of any status, was placed.`,
        referenceQuery: q("o.order_id IS NULL"),
        mistakeQuery: q("o.order_id IS NOT NULL"),
      });
    },
  },
];

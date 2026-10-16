import { BRIGHTCART } from "../worlds/brightcart";
import type { QueryDraft, TicketTemplate } from "./types";
import { monthName, monthWindow } from "./time";

const { cast } = BRIGHTCART;
const LINE = "oi.quantity * oi.unit_price";

type Spec = Pick<TicketTemplate, "id" | "difficulty" | "minLevel">;
const make = (s: Spec, skillTags: string[], parts: Omit<QueryDraft, "kind" | "templateId" | "difficulty" | "minLevel" | "taskKind" | "skillTags">): QueryDraft => ({
  kind: "query", templateId: s.id, difficulty: s.difficulty, minLevel: s.minLevel, taskKind: "analytics", skillTags, ...parts,
});

const D: Record<string, Spec> = {
  cohort: { id: "expert-cohort-retention", difficulty: "hard", minLevel: "expert" },
  pareto: { id: "expert-revenue-concentration", difficulty: "hard", minLevel: "expert" },
  reorder: { id: "expert-reorder-gap", difficulty: "hard", minLevel: "expert" },
};

/**
 * Tickets for the most experienced analysts. The request is a business question rather than a query to write, the definition of the
 * metric matters, and the plausible wrong answer is the one most people reach for first.
 */
export const EXPERT_TEMPLATES: TicketTemplate[] = [
  {
    ...D.cohort, taskKind: "analytics",
    build() {
      const q = (retained: string) => `WITH c AS (SELECT customer_id, SUBSTR(signup_date, 1, 7) AS cohort, DATE(signup_date, 'start of month') AS m0, DATE(signup_date, 'start of month', '+1 month') AS m1 FROM customers), r AS (SELECT c.cohort, c.customer_id, MAX(CASE WHEN o.status = 'delivered' AND ${retained} THEN 1 ELSE 0 END) AS retained FROM c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.cohort, c.customer_id) SELECT cohort, COUNT(*) AS customers, SUM(retained) AS retained, ROUND(100.0 * SUM(retained) / COUNT(*), 1) AS retention_pct FROM r GROUP BY cohort`;
      return make(D.cohort, ["Cohort analysis", "Retention", "CTEs", "Date functions"], {
        title: "Month-1 retention by signup cohort", requester: cast.marketing,
        scenario: "Hi, I keep being asked whether the customers we win actually stay. Define it like this: a customer is retained if they get a delivered order in the calendar month after the month they signed up. I need that for each signup-month cohort, with the number of customers and how many were retained. Be careful with the definition, last time someone counted the signup month itself.",
        deliverable: "One row per signup month (cohort as YYYY-MM): customers (signed up that month), retained (those with at least one delivered order in the following calendar month) and retention_pct (retained ÷ customers × 100, one decimal).",
        referenceQuery: q("o.order_date >= c.m1 AND o.order_date < DATE(c.m1, '+1 month')"), mistakeQuery: q("o.order_date >= c.m0 AND o.order_date < c.m1"),
      });
    },
  },
  {
    ...D.pareto, taskKind: "analytics",
    build(rng) {
      const w = monthWindow(rng.int(6, 9));
      const q = (order: string) => `WITH rev AS (SELECT o.customer_id, SUM(${LINE}) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND o.order_date < '${w.end}' GROUP BY o.customer_id), ranked AS (SELECT revenue, ROW_NUMBER() OVER (ORDER BY revenue ${order}, customer_id) AS rn FROM rev), cut AS (SELECT (COUNT(*) + 4) / 5 AS top_n FROM rev) SELECT (SELECT top_n FROM cut) AS top_customers, ROUND(100.0 * SUM(CASE WHEN rn <= (SELECT top_n FROM cut) THEN revenue ELSE 0 END) / SUM(revenue), 1) AS top_share_pct FROM ranked`;
      return make(D.pareto, ["Window functions", "Concentration", "Pareto analysis"], {
        title: `How concentrated is our revenue, up to ${monthName(Number(w.start.slice(5, 7)))}?`, requester: cast.finance,
        scenario: "Hello, the board asks whether we depend on a few big customers. Take every customer who has a delivered order up to the end of the month named above, rank them by delivered revenue, and tell me how many make up the top 20% (round up) and what share of the revenue they bring.",
        deliverable: "One row: top_customers (20% of the customers who bought, rounded up) and top_share_pct (their share of total delivered revenue, as a percentage with one decimal).",
        referenceQuery: q("DESC"), mistakeQuery: q("ASC"),
      });
    },
  },
  {
    ...D.reorder, taskKind: "analytics",
    build(rng) {
      const w = monthWindow(rng.int(7, 9));
      const q = (second: string) => `WITH d AS (SELECT o.customer_id, o.order_date, ROW_NUMBER() OVER (PARTITION BY o.customer_id ORDER BY o.order_date, o.order_id) AS rn FROM orders o WHERE o.status = 'delivered' AND o.order_date < '${w.end}'), g AS (SELECT a.customer_id, JULIANDAY(b.order_date) - JULIANDAY(a.order_date) AS gap FROM d a JOIN d b ON a.customer_id = b.customer_id AND a.rn = 1 AND b.rn ${second}) SELECT c.segment, COUNT(*) AS customers, ROUND(AVG(g.gap), 1) AS avg_days FROM g JOIN customers c ON c.customer_id = g.customer_id GROUP BY c.segment`;
      return make(D.reorder, ["Window functions", "Self-joins", "Customer behaviour"], {
        title: "How long do customers wait before buying again?", requester: cast.marketing,
        scenario: "Hi, we want to time our win-back message. For customers with at least two delivered orders, how many days pass between their first and their second delivered order, on average, for each customer segment? Only orders up to the end of the month named above count.",
        deliverable: "One row per segment: customers (with at least two delivered orders) and avg_days (average days between their first and second delivered order, one decimal).",
        referenceQuery: q("= 2"), mistakeQuery: q("= (SELECT MAX(rn) FROM d WHERE d.customer_id = a.customer_id)"),
      });
    },
  },
];

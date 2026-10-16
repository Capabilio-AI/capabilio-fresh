import { BRIGHTCART } from "../worlds/brightcart";
import type { QueryDraft, TicketTemplate } from "./types";
import { monthName, monthWindow } from "./time";
import { LINE } from "./pg-support";

const { cast } = BRIGHTCART;
const AREAS = ["debugging"];
type Spec = Pick<TicketTemplate, "id" | "difficulty" | "minLevel">;
const make = (s: Spec, skillTags: string[], parts: Omit<QueryDraft, "kind" | "templateId" | "difficulty" | "minLevel" | "taskKind" | "skillTags" | "referenceQuery" | "mistakeQuery" | "starterQuery"> & { broken: string; fixed: string }): QueryDraft => {
  const { broken, fixed, ...rest } = parts;
  return { kind: "query", templateId: s.id, difficulty: s.difficulty, minLevel: s.minLevel, taskKind: "debug", skillTags: ["PostgreSQL", "SQL debugging", ...skillTags], referenceQuery: fixed, mistakeQuery: broken, starterQuery: broken, ...rest };
};

const D: Record<string, Spec> = {
  fanOut: { id: "pg-debug-order-count", difficulty: "easy", minLevel: "fresher" },
  boundary: { id: "pg-debug-missing-days", difficulty: "easy", minLevel: "fresher" },
  division: { id: "pg-debug-rate-is-zero", difficulty: "easy", minLevel: "fresher" },
  leftJoin: { id: "pg-debug-vanishing-customers", difficulty: "medium", minLevel: "junior" },
  grain: { id: "pg-debug-low-average", difficulty: "medium", minLevel: "junior" },
  city: { id: "pg-debug-split-city", difficulty: "medium", minLevel: "fresher" },
};
const THIRTY_ONE = [3, 5, 7, 8];

export const PG_DEBUG: TicketTemplate[] = [
  {
    ...D.fanOut, areas: AREAS, taskKind: "debug",
    build(rng) {
      const w = monthWindow(rng.int(2, 8));
      const q = (count: string) => `SELECT ${count} AS delivered_orders FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND o.order_date >= '${w.start}' AND o.order_date < '${w.end}'`;
      return make(D.fanOut, ["Joins", "COUNT DISTINCT"], {
        title: `Fix: the ${w.label.split(" ")[0]} order count is far too high`, requester: cast.sales,
        scenario: `Hi, the query behind our ${w.label} dashboard counts many more delivered orders than finance does. Nobody remembers who wrote it. Can you find out why it overcounts and fix it?`,
        deliverable: `Fix the query so delivered_orders is the number of delivered orders placed in ${w.label}: one row, one column called delivered_orders.`,
        broken: q("COUNT(*)"), fixed: q("COUNT(DISTINCT o.order_id)"),
      });
    },
  },
  {
    ...D.boundary, areas: AREAS, taskKind: "debug",
    build(rng) {
      const w = monthWindow(rng.pick(THIRTY_ONE));
      const q = (cond: string) => `SELECT COUNT(DISTINCT o.order_id) AS orders, ROUND(SUM(${LINE}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND ${cond}`;
      return make(D.boundary, ["Dates", "Filtering"], {
        title: `Fix: the last days of ${w.label.split(" ")[0]} are missing`, requester: cast.finance,
        scenario: `Hello, our ${w.label} report is always a little lower than the ledger, as if the last day or two of the month were left out. Please find the mistake in the date filter.`,
        deliverable: `Fix the query so it covers every day of ${w.label}, the last day included: one row with orders and revenue (rounded to 2 decimals).`,
        broken: q(`o.order_date >= '${w.start}' AND o.order_date < '${w.start.slice(0, 8)}30'`), fixed: q(`o.order_date >= '${w.start}' AND o.order_date < '${w.end}'`),
      });
    },
  },
  {
    ...D.division, areas: AREAS, taskKind: "debug",
    build(rng) {
      const w = monthWindow(rng.int(4, 9));
      const q = (rate: string) => `SELECT ${rate} AS return_pct FROM orders WHERE order_date < '${w.end}'`;
      return make(D.division, ["Integer division", "Rates"], {
        title: "Fix: the return rate always shows 0", requester: cast.success,
        scenario: `Hi, the return-rate tile shows 0 every day, but customers are returning things. It looks at all orders up to the end of ${monthName(Number(w.start.slice(5, 7)))}. In Postgres, dividing two whole numbers gives a whole number, which may be the cause.`,
        deliverable: "Fix the query so return_pct is the percentage of orders with status 'returned' (returned ÷ all orders × 100), rounded to 1 decimal.",
        broken: q("SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) / COUNT(*) * 100"), fixed: q("ROUND(100.0 * SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) / COUNT(*), 1)"),
      });
    },
  },
  {
    ...D.leftJoin, areas: AREAS, taskKind: "debug",
    build() {
      const q = (join: string, where: string) => `SELECT c.segment, COUNT(DISTINCT c.customer_id) AS customers, COUNT(o.order_id) AS delivered_orders FROM customers c LEFT JOIN orders o ${join} ${where} GROUP BY c.segment`;
      return make(D.leftJoin, ["LEFT JOIN", "ON vs WHERE"], {
        title: "Fix: customers who never bought have disappeared", requester: cast.marketing,
        scenario: "Hello, this segment report should show every customer, including those with no delivered order. But the customer counts are lower than the real customer base, as if those people were dropped. It uses a LEFT JOIN, so I don't understand why.",
        deliverable: "Fix the query so each segment shows all of its customers (customers) and how many delivered orders they have between them (delivered_orders), including customers with none.",
        broken: q("ON o.customer_id = c.customer_id", "WHERE o.status = 'delivered'"), fixed: q("ON o.customer_id = c.customer_id AND o.status = 'delivered'", ""),
      });
    },
  },
  {
    ...D.grain, areas: AREAS, taskKind: "debug",
    build(rng) {
      const w = monthWindow(rng.int(2, 8));
      const q = (avg: string) => `SELECT ${avg} AS avg_order_value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND o.order_date >= '${w.start}' AND o.order_date < '${w.end}'`;
      return make(D.grain, ["Grain", "Averages"], {
        title: "Fix: the average order value looks too low", requester: cast.finance,
        scenario: `Hi, our average order value for ${w.label} looks far lower than what customers spend per order. I suspect the average is taken over the wrong thing.`,
        deliverable: `Fix the query so avg_order_value is the average value of a delivered order placed in ${w.label} (total revenue ÷ number of orders, not per item), rounded to 2 decimals.`,
        broken: q(`ROUND(AVG(${LINE}), 2)`), fixed: q(`ROUND(SUM(${LINE})::numeric / COUNT(DISTINCT o.order_id), 2)`),
      });
    },
  },
  {
    ...D.city, areas: AREAS, taskKind: "debug",
    build() {
      const q = (city: string) => `SELECT ${city} AS city, COUNT(DISTINCT o.order_id) AS orders FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = 'delivered' GROUP BY 1`;
      return make(D.city, ["Data quality", "GROUP BY", "INITCAP"], {
        title: "Fix: the same city shows up several times", requester: cast.sales,
        scenario: "Hi, my city report lists Mumbai three times, as 'Mumbai', 'mumbai ' and in capitals, each with a partial number. I can't present that.",
        deliverable: "Fix the query so each city appears once with all its delivered orders: columns city (trimmed, in Title Case) and orders.",
        broken: q("c.city"), fixed: q("INITCAP(TRIM(c.city))"),
      });
    },
  },
];

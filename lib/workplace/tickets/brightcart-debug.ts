import { BRIGHTCART } from "../worlds/brightcart";
import type { QueryDraft, TicketTemplate } from "./types";
import { monthName, monthWindow } from "./time";

const { cast } = BRIGHTCART;
const AREAS = ["debugging"];
const LINE = "oi.quantity * oi.unit_price";
const CLEAN_CITY = "UPPER(SUBSTR(TRIM(c.city), 1, 1)) || LOWER(SUBSTR(TRIM(c.city), 2))";

type Spec = Pick<TicketTemplate, "id" | "difficulty" | "minLevel">;
/** A debugging ticket: `broken` is what the user starts from, `fixed` is what grades them. */
const make = (s: Spec, skillTags: string[], parts: Omit<QueryDraft, "kind" | "templateId" | "difficulty" | "minLevel" | "taskKind" | "skillTags" | "referenceQuery" | "mistakeQuery" | "starterQuery"> & { broken: string; fixed: string }): QueryDraft => {
  const { broken, fixed, ...rest } = parts;
  return { kind: "query", templateId: s.id, difficulty: s.difficulty, minLevel: s.minLevel, taskKind: "debug", skillTags: ["SQL debugging", ...skillTags], referenceQuery: fixed, mistakeQuery: broken, starterQuery: broken, ...rest };
};

const D: Record<string, Spec> = {
  fanOut: { id: "debug-order-count", difficulty: "easy", minLevel: "fresher" },
  boundary: { id: "debug-missing-last-day", difficulty: "easy", minLevel: "fresher" },
  division: { id: "debug-rate-is-zero", difficulty: "easy", minLevel: "fresher" },
  leftJoin: { id: "debug-vanishing-customers", difficulty: "medium", minLevel: "junior" },
  grain: { id: "debug-low-average", difficulty: "medium", minLevel: "junior" },
  city: { id: "debug-split-city", difficulty: "medium", minLevel: "fresher" },
  aggregate: { id: "debug-aggregate-in-where", difficulty: "medium", minLevel: "junior" },
  inflated: { id: "debug-inflated-revenue", difficulty: "hard", minLevel: "mid" },
};

const THIRTY_ONE_DAY_MONTHS = [3, 5, 7, 8]; // March, May, July, August fall inside the warehouse

export const DEBUG_TEMPLATES: TicketTemplate[] = [
  {
    ...D.fanOut, areas: AREAS, taskKind: "debug",
    build(rng) {
      const w = monthWindow(rng.int(2, 8));
      const q = (count: string) => `SELECT ${count} AS delivered_orders FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND o.order_date >= '${w.start}' AND o.order_date < '${w.end}'`;
      return make(D.fanOut, ["Joins", "COUNT DISTINCT"], {
        title: `Fix: the ${w.label.split(" ")[0]} order count is far too high`, requester: cast.sales,
        scenario: `Hi, the query behind our ${w.label} dashboard says we delivered many more orders than finance counted in their own system. Nobody remembers who wrote it. Can you find out why it overcounts and fix it?`,
        deliverable: `Fix the query so delivered_orders is the number of delivered orders placed in ${w.label}: one row, one column called delivered_orders.`,
        broken: q("COUNT(*)"), fixed: q("COUNT(DISTINCT o.order_id)"),
      });
    },
  },
  {
    ...D.boundary, areas: AREAS, taskKind: "debug",
    build(rng) {
      const w = monthWindow(rng.pick(THIRTY_ONE_DAY_MONTHS));
      const q = (cond: string) => `SELECT COUNT(DISTINCT o.order_id) AS orders, ROUND(SUM(${LINE}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND ${cond}`;
      return make(D.boundary, ["Dates", "Filtering"], {
        title: `Fix: the last days of ${w.label.split(" ")[0]} are missing from the report`, requester: cast.finance,
        scenario: `Hello, our ${w.label} report is always a little lower than the ledger, as if the last day or two of the month were left out. This is the query behind it. Please find the mistake in the date filter.`,
        deliverable: `Fix the query so it covers every day of ${w.label}, the last day included: one row with orders (delivered orders) and revenue (rounded to 2 decimals).`,
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
        scenario: `Hi, the return-rate tile on our dashboard shows 0 every day, but I know customers are returning things. It looks at all orders up to the end of ${monthName(Number(w.start.slice(5, 7)))}. Can you see why it can't show a real number?`,
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
        title: "Fix: customers who never bought have disappeared from the report", requester: cast.marketing,
        scenario: "Hello, this segment report is meant to show every customer, including those who have not received a delivered order yet. But the customer counts are lower than the real customer base, as if those people were dropped. The query uses a LEFT JOIN, so I don't understand why.",
        deliverable: "Fix the query so that each segment shows all of its customers (customers) and how many delivered orders they have between them (delivered_orders), including customers with none.",
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
        scenario: `Hi, our average order value for ${w.label} looks far lower than what customers actually spend per order. I suspect the average is taken over the wrong thing. This is the query.`,
        deliverable: `Fix the query so avg_order_value is the average value of a delivered order placed in ${w.label} (total revenue ÷ number of orders, not per item), rounded to 2 decimals.`,
        broken: q(`ROUND(AVG(${LINE}), 2)`), fixed: q(`ROUND(SUM(${LINE}) * 1.0 / COUNT(DISTINCT o.order_id), 2)`),
      });
    },
  },
  {
    ...D.city, areas: AREAS, taskKind: "debug",
    build(rng) {
      const w = monthWindow(rng.int(3, 9));
      const q = (city: string) => `SELECT ${city} AS city, COUNT(DISTINCT o.order_id) AS orders FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = 'delivered' AND o.order_date < '${w.end}' GROUP BY 1`;
      return make(D.city, ["Data quality", "GROUP BY", "String functions"], {
        title: "Fix: the same city shows up several times", requester: cast.sales,
        scenario: "Hi, my city report lists Mumbai three times, once as 'Mumbai', once as 'mumbai ' and once in capitals, each with a partial number. I can't present that. The query is below.",
        deliverable: "Fix the query so each city appears once with all of its delivered orders: columns city (trimmed, capital first letter, rest lower case) and orders.",
        broken: q("c.city"), fixed: q(CLEAN_CITY),
      });
    },
  },
  {
    ...D.aggregate, areas: AREAS, taskKind: "debug",
    build(rng) {
      const floor = rng.pick([5000, 8000, 12000]);
      const q = (clause: string) => `SELECT p.category, ROUND(SUM(${LINE}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status = 'delivered'${clause.startsWith("WHERE") ? ` AND ${clause.slice(6)}` : ""} GROUP BY p.category${clause.startsWith("HAVING") ? ` ${clause}` : ""}`;
      return make(D.aggregate, ["HAVING", "Aggregates"], {
        title: "Fix: the category report fails to run", requester: cast.category,
        scenario: `Hello, I only want categories that earned at least ₹${floor.toLocaleString("en-IN")}, so I added a filter, but now the query stops with an error about aggregates. I'm not sure where the filter belongs.`,
        deliverable: `Fix the query so it returns each category whose delivered revenue is at least ₹${floor.toLocaleString("en-IN")}: columns category and revenue (rounded to 2 decimals).`,
        broken: q(`WHERE SUM(${LINE}) >= ${floor}`), fixed: q(`HAVING SUM(${LINE}) >= ${floor}`),
      });
    },
  },
  {
    ...D.inflated, areas: AREAS, taskKind: "debug",
    build(rng) {
      const w = monthWindow(rng.int(5, 9));
      const q = (extra: string) => `SELECT c.segment, COUNT(DISTINCT o.order_id) AS orders, ROUND(SUM(${LINE}), 2) AS revenue FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items oi ON oi.order_id = o.order_id ${extra} WHERE o.status = 'delivered' AND o.order_date < '${w.end}' GROUP BY c.segment`;
      return make(D.inflated, ["Joins", "Fan-out", "Debugging"], {
        title: "Fix: segment revenue is hugely inflated but the order count is right", requester: cast.finance,
        scenario: "Hi, in this segment report the number of orders matches finance, yet the revenue is several times too high. Someone added a join to get customer information and the totals have been wrong ever since. Please find out what multiplies the revenue.",
        deliverable: "Fix the query so each segment shows its delivered orders and the correct delivered revenue (sum of quantity × unit_price, rounded to 2 decimals), without changing which columns it returns.",
        broken: q("JOIN orders o2 ON o2.customer_id = c.customer_id"), fixed: q(""),
      });
    },
  },
];

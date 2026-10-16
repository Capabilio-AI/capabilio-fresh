import { BRIGHTCART } from "../worlds/brightcart";
import type { TicketTemplate } from "./types";
import { monthName, quarterWindow } from "./time";

const { cast } = BRIGHTCART;
const LINE = "oi.quantity * oi.unit_price";
const CLEAN_CITY = "UPPER(SUBSTR(TRIM(c.city), 1, 1)) || LOWER(SUBSTR(TRIM(c.city), 2))";
const range = (w: { start: string; end: string }) => `o.order_date >= '${w.start}' AND o.order_date < '${w.end}'`;

export const MEDIUM_TEMPLATES: TicketTemplate[] = [
  {
    id: "category-channel",
    difficulty: "medium",
    minLevel: "junior",
    taskKind: "retrieval",
    build(rng) {
      const w = quarterWindow(rng.int(1, 3));
      const from = `FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id`;
      return {
        templateId: "category-channel",
        difficulty: "medium",
        kind: "query",
        minLevel: "junior",
        taskKind: "retrieval",
        title: `${w.label}: where does each category sell?`,
        requester: cast.category,
        scenario: `Hi, before the channel review I'd like to see which categories sell through the app, the website and the marketplaces. Delivered orders only please. I'll use it to decide where to spend the promotion budget.`,
        deliverable: `Delivered revenue for orders placed in ${w.label}, one row per category and channel: columns category, channel and revenue (sum of quantity × unit_price, rounded to 2 decimals).`,
        referenceQuery: `SELECT p.category, o.channel, ROUND(SUM(${LINE}), 2) AS revenue ${from} WHERE o.status = 'delivered' AND ${range(w)} GROUP BY p.category, o.channel`,
        mistakeQuery: `SELECT p.category, o.channel, ROUND(SUM(${LINE}), 2) AS revenue ${from} WHERE ${range(w)} GROUP BY p.category, o.channel`,
        skillTags: ["SQL", "Joins", "GROUP BY"],
      };
    },
  },
  {
    id: "aov-segment",
    difficulty: "medium",
    minLevel: "junior",
    taskKind: "retrieval",
    build(rng) {
      const w = quarterWindow(rng.int(1, 3));
      const from = `FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN customers c ON c.customer_id = o.customer_id`;
      return {
        templateId: "aov-segment",
        difficulty: "medium",
        kind: "query",
        minLevel: "junior",
        taskKind: "retrieval",
        title: `Average order value by segment, ${w.label}`,
        requester: cast.finance,
        scenario: `Hello, finance is reviewing how much each customer segment spends per order. Please give me average order value by segment for ${w.label}, delivered orders only. Careful: an order can have several items, so an order is not the same as a line.`,
        deliverable: `One row per segment: segment and aov, where aov is total delivered revenue divided by the number of delivered orders (not lines), rounded to 2 decimals, for orders placed in ${w.label}.`,
        referenceQuery: `SELECT c.segment, ROUND(SUM(${LINE}) * 1.0 / COUNT(DISTINCT o.order_id), 2) AS aov ${from} WHERE o.status = 'delivered' AND ${range(w)} GROUP BY c.segment`,
        mistakeQuery: `SELECT c.segment, ROUND(AVG(${LINE}), 2) AS aov ${from} WHERE o.status = 'delivered' AND ${range(w)} GROUP BY c.segment`,
        skillTags: ["SQL", "Aggregation", "Joins"],
      };
    },
  },
  {
    id: "repeat-rate",
    difficulty: "medium",
    minLevel: "junior",
    taskKind: "retrieval",
    build(rng) {
      const month = rng.int(5, 9);
      const end = month === 9 ? "2026-10-01" : `2026-0${month + 1}-01`;
      const delivered = `FROM orders WHERE status = 'delivered' AND order_date < '${end}' GROUP BY customer_id`;
      return {
        templateId: "repeat-rate",
        difficulty: "medium",
        kind: "query",
        minLevel: "junior",
        taskKind: "retrieval",
        title: `How loyal are customers by end of ${monthName(month)}?`,
        requester: cast.marketing,
        scenario: `Hi, the board keeps asking whether people come back after their first order. Up to the end of ${monthName(month)}, how many customers have bought at all, how many have bought more than once, and what share is that?`,
        deliverable: `One row: active_customers (customers with at least one delivered order before ${end}), repeat_customers (two or more delivered orders) and repeat_rate_pct (repeat_customers ÷ active_customers × 100, one decimal).`,
        referenceQuery: `WITH per AS (SELECT customer_id, COUNT(*) AS n ${delivered}) SELECT COUNT(*) AS active_customers, SUM(CASE WHEN n >= 2 THEN 1 ELSE 0 END) AS repeat_customers, ROUND(100.0 * SUM(CASE WHEN n >= 2 THEN 1 ELSE 0 END) / COUNT(*), 1) AS repeat_rate_pct FROM per`,
        mistakeQuery: `WITH per AS (SELECT customer_id, COUNT(*) AS n FROM orders WHERE order_date < '${end}' GROUP BY customer_id) SELECT COUNT(*) AS active_customers, SUM(CASE WHEN n >= 2 THEN 1 ELSE 0 END) AS repeat_customers, ROUND(100.0 * SUM(CASE WHEN n >= 2 THEN 1 ELSE 0 END) / COUNT(*), 1) AS repeat_rate_pct FROM per`,
        skillTags: ["SQL", "CTEs", "Conditional aggregation"],
      };
    },
  },
  {
    id: "city-revenue",
    difficulty: "medium",
    minLevel: "junior",
    taskKind: "retrieval",
    build(rng) {
      const w = quarterWindow(rng.int(1, 3));
      const body = (city: string, limit: boolean) => `SELECT ${city} AS city, ROUND(SUM(${LINE}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = 'delivered' AND ${range(w)} GROUP BY 1 ORDER BY revenue DESC${limit ? " LIMIT 5" : " LIMIT 6"}`;
      return {
        templateId: "city-revenue",
        difficulty: "medium",
        kind: "query",
        minLevel: "junior",
        taskKind: "retrieval",
        title: `Top 5 cities in ${w.label} (careful with the city column)`,
        requester: cast.sales,
        scenario: `Hi, I'm preparing the regional review. Which five cities brought in the most delivered revenue in ${w.label}? Heads-up: the city column is typed in by hand, so you'll see stray spaces and mixed capitals. Mumbai and "mumbai " are the same city.`,
        deliverable: `The top 5 cities by delivered revenue for orders placed in ${w.label}, after cleaning the city text (trim spaces, consistent capital letter): columns city and revenue (rounded to 2 decimals).`,
        referenceQuery: body(CLEAN_CITY, true),
        mistakeQuery: body("c.city", true),
        skillTags: ["SQL", "Data cleaning", "String functions"],
        tieGuard: { query: body(CLEAN_CITY, false), n: 5, metricColumn: 1 },
      };
    },
  },
  {
    id: "returns-by-category",
    difficulty: "medium",
    minLevel: "junior",
    taskKind: "retrieval",
    build(rng) {
      const w = quarterWindow(rng.int(1, 3));
      const base = (statuses: string) => `SELECT p.category, ROUND(SUM(${LINE}), 2) AS returned_value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status IN (${statuses}) AND ${range(w)} GROUP BY p.category`;
      return {
        templateId: "returns-by-category",
        difficulty: "medium",
        kind: "query",
        minLevel: "junior",
        taskKind: "retrieval",
        title: `What did returns cost us in ${w.label}?`,
        requester: cast.finance,
        scenario: `Hello, I need the value of goods that came back to us in ${w.label}, by category, for the loss provision. Returned orders only: cancelled orders were never shipped, so they are a different story.`,
        deliverable: `For orders placed in ${w.label} with status returned: one row per category with category and returned_value (sum of quantity × unit_price, rounded to 2 decimals).`,
        referenceQuery: base("'returned'"),
        mistakeQuery: base("'returned', 'cancelled'"),
        skillTags: ["SQL", "Joins", "Filtering"],
      };
    },
  },
];

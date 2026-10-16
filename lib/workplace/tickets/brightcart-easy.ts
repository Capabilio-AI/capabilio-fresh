import { BRIGHTCART } from "../worlds/brightcart";
import type { TicketTemplate } from "./types";
import { monthName, monthWindow, quarterWindow } from "./time";

const { cast } = BRIGHTCART;
const REVENUE = "SUM(oi.quantity * oi.unit_price)";

export const EASY_TEMPLATES: TicketTemplate[] = [
  {
    id: "delivered-month",
    difficulty: "easy",
    minLevel: "fresher",
    taskKind: "retrieval",
    build(rng) {
      const w = monthWindow(rng.int(2, 8));
      const where = `o.order_date >= '${w.start}' AND o.order_date < '${w.end}'`;
      return {
        templateId: "delivered-month",
        difficulty: "easy",
        kind: "query",
        minLevel: "fresher",
        taskKind: "retrieval",
        title: `${monthName(Number(w.start.slice(5, 7)))} sales number for the stand-up`,
        requester: cast.sales,
        scenario: `${rng.pick(["Morning!", "Hi,", "Quick one:"])} For Monday's stand-up I need the headline number for ${w.label}. Leadership only counts orders that were delivered, so cancelled, returned and still-shipped orders should not be in it.`,
        deliverable: `One row with delivered_orders (count of orders) and revenue (sum of quantity × unit_price on their items, rounded to 2 decimals) for orders placed in ${w.label}.`,
        referenceQuery: `SELECT COUNT(DISTINCT o.order_id) AS delivered_orders, ROUND(${REVENUE}, 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' AND ${where}`,
        mistakeQuery: `SELECT COUNT(DISTINCT o.order_id) AS orders, ROUND(${REVENUE}, 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE ${where}`,
        skillTags: ["SQL", "Aggregation", "Filtering"],
      };
    },
  },
  {
    id: "status-mix",
    difficulty: "easy",
    minLevel: "fresher",
    taskKind: "retrieval",
    build(rng) {
      const w = monthWindow(rng.int(2, 8));
      const where = `order_date >= '${w.start}' AND order_date < '${w.end}'`;
      return {
        templateId: "status-mix",
        difficulty: "easy",
        kind: "query",
        minLevel: "fresher",
        taskKind: "retrieval",
        title: `Where did ${w.label.split(" ")[0]}'s orders end up?`,
        requester: cast.success,
        scenario: `Hi, customers keep asking me about cancellations and returns and I have no numbers. Can you show me how ${w.label}'s orders split by status? I want to see how big the problem really is.`,
        deliverable: `One row per status with the number of orders placed in ${w.label}: columns status and orders.`,
        referenceQuery: `SELECT status, COUNT(*) AS orders FROM orders WHERE ${where} GROUP BY status`,
        mistakeQuery: `SELECT status, COUNT(*) AS orders FROM orders GROUP BY status`,
        skillTags: ["SQL", "GROUP BY"],
      };
    },
  },
  {
    id: "top-products",
    difficulty: "easy",
    minLevel: "fresher",
    taskKind: "retrieval",
    build(rng) {
      const w = quarterWindow(rng.int(1, 3));
      const n = rng.pick([3, 5]);
      const from = `FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id`;
      const range = `o.order_date >= '${w.start}' AND o.order_date < '${w.end}'`;
      const base = `SELECT p.product_name, ROUND(${REVENUE}, 2) AS revenue ${from} WHERE o.status = 'delivered' AND ${range} GROUP BY p.product_id, p.product_name ORDER BY revenue DESC`;
      return {
        templateId: "top-products",
        difficulty: "easy",
        kind: "query",
        minLevel: "fresher",
        taskKind: "retrieval",
        title: `Top ${n} earners in ${w.label}`,
        requester: cast.category,
        scenario: `Hello, I'm planning next quarter's stock and want to double down on what actually earns. Which products brought in the most money in ${w.label}? Only count delivered orders, a cancelled order never left the warehouse.`,
        deliverable: `The ${n} products with the highest revenue (sum of quantity × unit_price, rounded to 2 decimals) in delivered orders placed in ${w.label}: columns product_name and revenue.`,
        referenceQuery: `${base} LIMIT ${n}`,
        mistakeQuery: `SELECT p.product_name, ROUND(${REVENUE}, 2) AS revenue ${from} WHERE ${range} GROUP BY p.product_id, p.product_name ORDER BY revenue DESC LIMIT ${n}`,
        skillTags: ["SQL", "Joins", "Ranking"],
        tieGuard: { query: `${base} LIMIT ${n + 1}`, n, metricColumn: 1 },
      };
    },
  },
  {
    id: "new-customers",
    difficulty: "easy",
    minLevel: "fresher",
    taskKind: "retrieval",
    build(rng) {
      const w = monthWindow(rng.int(1, 5));
      return {
        templateId: "new-customers",
        difficulty: "easy",
        kind: "query",
        minLevel: "fresher",
        taskKind: "retrieval",
        title: `Who joined in ${w.label.split(" ")[0]}?`,
        requester: cast.marketing,
        scenario: `Hi! We ran a campaign in ${w.label.split(" ")[0]} and I need to know what kind of customers it brought in. How many new customers signed up that month, split by segment?`,
        deliverable: `One row per segment with the number of customers whose signup_date falls in ${w.label}: columns segment and new_customers.`,
        referenceQuery: `SELECT segment, COUNT(*) AS new_customers FROM customers WHERE signup_date >= '${w.start}' AND signup_date < '${w.end}' GROUP BY segment`,
        mistakeQuery: `SELECT segment, COUNT(*) AS new_customers FROM customers GROUP BY segment`,
        skillTags: ["SQL", "GROUP BY", "Dates"],
      };
    },
  },
];

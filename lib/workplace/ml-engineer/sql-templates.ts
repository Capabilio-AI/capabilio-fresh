import { BRIGHTCART } from "../worlds/brightcart";
import type { TicketTemplate } from "../tickets/types";

/**
 * AI/ML Engineer data tickets on the BrightCart warehouse: the SQL an ML engineer writes to build a label table and a feature table before any model
 * exists. The traps are the ones that silently corrupt a training set: a filter that drops the very customers who churned, and a join that counts
 * orders once per item. Registered through the world for "ai-ml-engineer" in lib/workplace/worlds/index.ts.
 */
const { cast } = BRIGHTCART;
const ML_LEAD = { name: "Kavya Iyer", title: "ML Platform Lead" };
const AREA = ["mle-data-sql"];
const CUTOFFS = ["2026-06-30", "2026-07-31", "2026-08-31"];
const REVENUE = "SUM(oi.quantity * oi.unit_price)";

export const ML_ENGINEER_SQL_TEMPLATES: TicketTemplate[] = [
  {
    id: "mlsql-churn-label", difficulty: "easy", minLevel: "fresher", taskKind: "analytics", areas: AREA,
    build(rng) {
      const cutoff = rng.pick(CUTOFFS);
      const window = `o.status = 'delivered' AND o.order_date > date('${cutoff}', '-90 day') AND o.order_date <= '${cutoff}'`;
      return {
        kind: "query", templateId: "mlsql-churn-label", difficulty: "easy", minLevel: "fresher", taskKind: "analytics",
        title: `Class balance of the churn labels at ${cutoff}`,
        requester: ML_LEAD,
        scenario: `Hi, before we train a churn model I want to see how lopsided its labels are. Treat ${cutoff} as the prediction date. A customer has churned if they placed no delivered order in the 90 days up to and including that date (after ${cutoff} minus 90 days). Only customers who had already signed up by then count. Careful: the customers we care about most are the ones with no orders in the window, so they must still be counted.`,
        deliverable: `One row with churned (customers with no delivered order in that 90-day window), retained (customers with at least one) and customers (all customers who signed up on or before ${cutoff}).`,
        referenceQuery: `SELECT SUM(churned) AS churned, COUNT(*) - SUM(churned) AS retained, COUNT(*) AS customers FROM (SELECT c.customer_id, CASE WHEN COUNT(o.order_id) = 0 THEN 1 ELSE 0 END AS churned FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND ${window} WHERE c.signup_date <= '${cutoff}' GROUP BY c.customer_id)`,
        mistakeQuery: `SELECT SUM(churned) AS churned, COUNT(*) - SUM(churned) AS retained, COUNT(*) AS customers FROM (SELECT c.customer_id, CASE WHEN COUNT(o.order_id) = 0 THEN 1 ELSE 0 END AS churned FROM customers c JOIN orders o ON o.customer_id = c.customer_id WHERE c.signup_date <= '${cutoff}' AND ${window} GROUP BY c.customer_id)`,
        skillTags: ["SQL", "LEFT JOIN", "Label construction", "Churn"],
      };
    },
  },
  {
    id: "mlsql-feature-table", difficulty: "medium", minLevel: "fresher", taskKind: "analytics", areas: AREA,
    build(rng) {
      const cutoff = rng.pick(CUTOFFS);
      return {
        kind: "query", templateId: "mlsql-feature-table", difficulty: "medium", minLevel: "fresher", taskKind: "analytics",
        title: `Top customers in the feature table as of ${cutoff}`,
        requester: cast.success,
        scenario: `Hello, the data scientists are building a feature table for each customer as it looked on ${cutoff}, using only orders up to and including that day so nothing from the future leaks in. Only delivered orders count. I want to eyeball the five biggest spenders first. An order has several item lines, so be careful not to count an order once per line.`,
        deliverable: `The five customers with the highest spend_total (ties by lower customer_id), highest first: customer_id, orders_total (number of delivered orders on or before ${cutoff}), spend_total (sum of quantity × unit_price on those orders, rounded to 2 decimals) and days_since_last (whole days from the customer's latest delivered order to ${cutoff}).`,
        referenceQuery: `SELECT c.customer_id, COUNT(DISTINCT o.order_id) AS orders_total, ROUND(${REVENUE}, 2) AS spend_total, CAST(julianday('${cutoff}') - julianday(MAX(o.order_date)) AS INTEGER) AS days_since_last FROM customers c JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered' AND o.order_date <= '${cutoff}' JOIN order_items oi ON oi.order_id = o.order_id GROUP BY c.customer_id ORDER BY spend_total DESC, c.customer_id LIMIT 5`,
        mistakeQuery: `SELECT c.customer_id, COUNT(o.order_id) AS orders_total, ROUND(${REVENUE}, 2) AS spend_total, CAST(julianday('${cutoff}') - julianday(MAX(o.order_date)) AS INTEGER) AS days_since_last FROM customers c JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered' AND o.order_date <= '${cutoff}' JOIN order_items oi ON oi.order_id = o.order_id GROUP BY c.customer_id ORDER BY spend_total DESC, c.customer_id LIMIT 5`,
        skillTags: ["SQL", "Feature table", "Join fan-out", "Point-in-time correctness"],
      };
    },
  },
  {
    id: "mlsql-days-between-orders", difficulty: "medium", minLevel: "junior", taskKind: "analytics", areas: AREA,
    build() {
      const gaps = "SELECT CAST(julianday(order_date) - julianday(LAG(order_date) OVER (%PART% ORDER BY order_date, order_id)) AS INTEGER) AS gap FROM orders WHERE status = 'delivered'";
      return {
        kind: "query", templateId: "mlsql-days-between-orders", difficulty: "medium", minLevel: "junior", taskKind: "analytics",
        title: "How long do customers wait between orders?",
        requester: ML_LEAD,
        scenario: "Hi, one of the strongest churn signals is how long a customer waits between orders. For every delivered order I want the gap since that same customer's previous delivered order, not since whoever ordered before them. Summarise the gaps so I can see whether the feature is worth building.",
        deliverable: "One row with repeat_orders (delivered orders that have a previous delivered order from the same customer), within_14_days (how many of those came within 14 days of it) and avg_gap_days (the average gap in days, rounded to 1 decimal). A customer's orders are ordered by order_date, then order_id.",
        referenceQuery: `SELECT COUNT(*) AS repeat_orders, SUM(CASE WHEN gap <= 14 THEN 1 ELSE 0 END) AS within_14_days, ROUND(AVG(gap), 1) AS avg_gap_days FROM (${gaps.replace("%PART%", "PARTITION BY customer_id")}) WHERE gap IS NOT NULL`,
        mistakeQuery: `SELECT COUNT(*) AS repeat_orders, SUM(CASE WHEN gap <= 14 THEN 1 ELSE 0 END) AS within_14_days, ROUND(AVG(gap), 1) AS avg_gap_days FROM (${gaps.replace("%PART%", "")}) WHERE gap IS NOT NULL`,
        skillTags: ["SQL", "Window functions", "LAG", "Feature engineering"],
      };
    },
  },
];

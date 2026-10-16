import { BRIGHTCART } from "../worlds/brightcart";
import type { QueryDraft, TicketTemplate } from "./types";
import { monthName, monthWindow } from "./time";
import { attempt, emptyTable, LINE, LOG_TABLE, makeScript, probe, readLog } from "./pg-support";

const { cast } = BRIGHTCART;

type Def = Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind" | "areas">;
const query = (d: Def, skillTags: string[], parts: Omit<QueryDraft, "kind" | "templateId" | "difficulty" | "minLevel" | "taskKind" | "skillTags">): QueryDraft => ({
  kind: "query", templateId: d.id, difficulty: d.difficulty, minLevel: d.minLevel, taskKind: d.taskKind, skillTags, ...parts,
});

const Q = ["queries"];
const D = {
  channels: { id: "pg-orders-by-channel", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", areas: Q },
  names: { id: "pg-name-search", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", areas: Q },
  buckets: { id: "pg-size-buckets", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", areas: Q },
  quiet: { id: "pg-quiet-customers", difficulty: "medium", minLevel: "fresher", taskKind: "retrieval", areas: Q },
  city: { id: "pg-clean-city-revenue", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", areas: Q },
  trend: { id: "pg-monthly-orders", difficulty: "medium", minLevel: "junior", taskKind: "retrieval", areas: Q },
  createTable: { id: "pg-create-table", difficulty: "easy", minLevel: "fresher", taskKind: "schema", areas: ["schema"] },
  insertSelect: { id: "pg-insert-select", difficulty: "easy", minLevel: "fresher", taskKind: "update", areas: ["data-changes"] },
  updateFrom: { id: "pg-update-from", difficulty: "medium", minLevel: "junior", taskKind: "update", areas: ["data-changes"] },
} as const satisfies Record<string, Def>;

export const PG_FRESHER: TicketTemplate[] = [
  {
    ...D.channels,
    build(rng) {
      const w = monthWindow(rng.int(2, 8));
      const q = (status: string) => `SELECT channel, COUNT(*) AS orders FROM orders WHERE ${status}order_date >= '${w.start}' AND order_date < '${w.end}' GROUP BY channel`;
      return query(D.channels, ["PostgreSQL", "GROUP BY", "Filtering"], {
        title: `Delivered orders per channel in ${w.label}`, requester: cast.sales,
        scenario: `Hi, I'm new to the data team's database and need a simple count for my report: how many orders did each sales channel deliver in ${w.label}? Cancelled, returned and still-shipped orders don't count.`,
        deliverable: `One row per channel: channel and orders (the number of delivered orders placed in ${w.label}).`,
        referenceQuery: q("status = 'delivered' AND "), mistakeQuery: q(""),
      });
    },
  },
  {
    ...D.names,
    build(rng) {
      const letter = rng.pick(["a", "k", "r", "s", "m", "d"]);
      return query(D.names, ["PostgreSQL", "ILIKE", "Pattern matching"], {
        title: `Customers whose name starts with ${letter.toUpperCase()}`, requester: cast.marketing,
        scenario: `Hello, for a small pilot I want the customers whose first name starts with the letter ${letter.toUpperCase()}, however the name was typed. How many are there in each customer segment?`,
        deliverable: `One row per segment: segment and customers (the number of customers whose name starts with ${letter.toUpperCase()}, upper or lower case).`,
        referenceQuery: `SELECT segment, COUNT(*) AS customers FROM customers WHERE name ILIKE '${letter}%' GROUP BY segment`, mistakeQuery: `SELECT segment, COUNT(*) AS customers FROM customers WHERE name LIKE '${letter}%' GROUP BY segment`,
      });
    },
  },
  {
    ...D.buckets,
    build(rng) {
      const [small, medium] = rng.pick([[600, 2000], [800, 2500], [1000, 3000]] as const);
      const q = (cases: string) => `WITH v AS (SELECT o.order_id, SUM(${LINE}) AS value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' GROUP BY o.order_id) SELECT CASE ${cases} END AS size, COUNT(*) AS orders FROM v GROUP BY 1`;
      return query(D.buckets, ["PostgreSQL", "CASE", "Bucketing"], {
        title: "How many small, medium and large orders do we deliver?", requester: cast.category,
        scenario: `Hi, I want to see the mix of order sizes. Call a delivered order 'small' if its value is under ₹${small}, 'medium' if it is under ₹${medium}, and 'large' otherwise. How many of each?`,
        deliverable: "One row per size (small, medium, large): size and orders (the number of delivered orders in that size).",
        referenceQuery: q(`WHEN value < ${small} THEN 'small' WHEN value < ${medium} THEN 'medium' ELSE 'large'`), mistakeQuery: q(`WHEN value < ${medium} THEN 'medium' WHEN value < ${small} THEN 'small' ELSE 'large'`),
      });
    },
  },
  {
    ...D.quiet,
    build(rng) {
      const w = monthWindow(rng.int(3, 9));
      const month = monthName(Number(w.start.slice(5, 7)));
      return query(D.quiet, ["PostgreSQL", "LEFT JOIN", "Anti-join"], {
        title: `Who did not order in ${month}?`, requester: cast.marketing,
        scenario: `Hello, we want to nudge customers who were with us in ${month} but did not buy anything. Count, for each segment, the customers who had signed up before the end of ${month} and had no delivered order during ${month}.`,
        deliverable: `One row per segment: segment and customers (customers who signed up before ${w.end} and have no delivered order dated in ${w.label}).`,
        referenceQuery: `SELECT c.segment, COUNT(*) AS customers FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered' AND o.order_date >= '${w.start}' AND o.order_date < '${w.end}' WHERE o.order_id IS NULL AND c.signup_date < '${w.end}' GROUP BY c.segment`,
        mistakeQuery: `SELECT c.segment, COUNT(*) AS customers FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL GROUP BY c.segment`,
      });
    },
  },
  {
    ...D.city,
    build() {
      const q = (city: string) => `SELECT ${city} AS city, COUNT(DISTINCT o.order_id) AS orders FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = 'delivered' GROUP BY 1`;
      return query(D.city, ["PostgreSQL", "INITCAP", "String functions", "Data quality"], {
        title: "Delivered orders per city, with the city names cleaned", requester: cast.sales,
        scenario: "Hi, the city column was typed by hand, so Mumbai appears as 'Mumbai', 'mumbai ' and 'MUMBAI'. I need one row per city. Postgres has a function that fixes capital letters, which will help.",
        deliverable: "One row per city, with the name trimmed and in Title Case: city and orders (the number of delivered orders).",
        referenceQuery: q("INITCAP(TRIM(c.city))"), mistakeQuery: q("c.city"),
      });
    },
  },
  {
    ...D.trend,
    build(rng) {
      const w = monthWindow(rng.int(5, 9));
      const q = (status: string) => `SELECT to_char(date_trunc('month', order_date), 'YYYY-MM') AS month, COUNT(*) AS orders FROM orders WHERE ${status}order_date < '${w.end}' GROUP BY 1`;
      return query(D.trend, ["PostgreSQL", "date_trunc", "to_char", "Trends"], {
        title: "Delivered orders month by month", requester: cast.finance,
        scenario: "Hello, I want the monthly order trend for the board deck, one row per month, using only delivered orders.",
        deliverable: `One row per month up to ${w.label}: month (YYYY-MM) and orders (delivered orders placed that month).`,
        referenceQuery: q("status = 'delivered' AND "), mistakeQuery: q(""),
      });
    },
  },
  {
    ...D.createTable,
    build() {
      const create = (check: string) => `CREATE TABLE loyalty_members (member_id serial PRIMARY KEY, customer_id integer NOT NULL REFERENCES customers (customer_id), joined_on date NOT NULL DEFAULT current_date, tier text NOT NULL${check});`;
      return makeScript(D.createTable, ["PostgreSQL", "CREATE TABLE", "Constraints", "Foreign keys"], {
        title: "Create the table for our loyalty programme", requester: cast.marketing,
        scenario: "Hi, we are launching a loyalty programme and need somewhere to store members. Each member is an existing customer, joins on a date (today by default) and has a tier of silver, gold or platinum. Nothing else should ever be accepted.",
        deliverable: "Create a table loyalty_members with columns member_id (auto-numbered primary key), customer_id (required, must be an existing customer), joined_on (a date, required, defaults to today) and tier (required text that can only be 'silver', 'gold' or 'platinum').",
        referenceScript: create(" CHECK (tier IN ('silver', 'gold', 'platinum'))"), mistakeScript: create(""),
        probes: [
          probe("The columns are right", "SELECT column_name FROM information_schema.columns WHERE table_name = 'loyalty_members' ORDER BY ordinal_position"),
          LOG_TABLE,
          attempt(1, "INSERT INTO loyalty_members (customer_id, tier) VALUES (1, 'gold')"),
          attempt(2, "INSERT INTO loyalty_members (customer_id, tier) VALUES (1, 'diamond')"),
          attempt(3, "INSERT INTO loyalty_members (customer_id, tier) VALUES (99999, 'gold')"),
          readLog("Good rows are accepted and bad ones refused"),
        ],
        previewQuery: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      });
    },
  },
  {
    ...D.insertSelect,
    build() {
      const load = (status: string) => `INSERT INTO customer_summary (customer_id, orders, revenue) SELECT o.customer_id, COUNT(DISTINCT o.order_id), SUM(${LINE}) FROM orders o JOIN order_items oi ON oi.order_id = o.order_id ${status} GROUP BY o.customer_id;`;
      return makeScript(D.insertSelect, ["PostgreSQL", "INSERT ... SELECT", "Aggregation"], {
        title: "Fill the customer summary table", requester: cast.data,
        scenario: "Hi, the dashboard team created an empty customer_summary table and needs it filled: for every customer with at least one delivered order, how many delivered orders they have and how much those are worth. Please load it with one statement.",
        deliverable: "Insert one row per customer who has delivered orders into customer_summary: customer_id, orders (number of delivered orders) and revenue (sum of quantity × unit_price on those orders).",
        referenceScript: load("WHERE o.status = 'delivered'"), mistakeScript: load(""),
        extraTables: [emptyTable("customer_summary", [{ name: "customer_id", type: "number", sqlType: "integer PRIMARY KEY" }, { name: "orders", type: "number", sqlType: "integer NOT NULL" }, { name: "revenue", type: "number", sqlType: "numeric(12,2) NOT NULL" }])],
        probes: [probe("The right customers and totals are loaded", "SELECT COUNT(*) AS customers, SUM(orders) AS orders, SUM(revenue) AS revenue FROM customer_summary")],
        previewQuery: "SELECT COUNT(*) AS rows_loaded FROM customer_summary",
      });
    },
  },
  {
    ...D.updateFrom,
    build(rng) {
      const ids = rng.shuffle(Array.from({ length: 20 }, (_, i) => i + 1)).slice(0, 5).sort((a, b) => a - b);
      const staging = { name: "price_changes", columns: [{ name: "product_id", type: "number" as const }, { name: "new_price", type: "number" as const }], rows: ids.map((id) => [id, rng.int(10, 40) * 50]) };
      return makeScript(D.updateFrom, ["PostgreSQL", "UPDATE ... FROM", "Joins in updates"], {
        title: "Apply the supplier price changes", requester: cast.category,
        scenario: "Hello, suppliers sent a list of new prices and it is already loaded into the price_changes table. Please update the product catalogue from it. Only the products in that list may change.",
        deliverable: "Update products so that list_price becomes new_price for every product that appears in price_changes. No other product may change.",
        referenceScript: "UPDATE products p SET list_price = c.new_price FROM price_changes c WHERE p.product_id = c.product_id;",
        mistakeScript: "UPDATE products SET list_price = (SELECT MAX(new_price) FROM price_changes);",
        extraTables: [staging],
        probes: [probe("Only the listed products have new prices", "SELECT product_id, list_price FROM products ORDER BY product_id")],
        previewQuery: "SELECT product_id, new_price FROM price_changes ORDER BY product_id",
      });
    },
  },
];

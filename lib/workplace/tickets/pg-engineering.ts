import { BRIGHTCART, CITIES } from "../worlds/brightcart";
import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { TicketTemplate } from "./types";
import { makeScript, probe } from "./pg-support";

const { cast } = BRIGHTCART;

const D = {
  upsert: { id: "pg-city-upsert", difficulty: "medium", minLevel: "mid", taskKind: "upsert", areas: ["transformation"] },
  dedupe: { id: "pg-dedupe-staging", difficulty: "medium", minLevel: "junior", taskKind: "dedupe", areas: ["transformation", "maintenance"] },
} as const satisfies Record<string, Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind" | "areas">>;

export const PG_ENGINEERING: TicketTemplate[] = [
  {
    ...D.upsert,
    build(rng) {
      const existing = rng.shuffle(Array.from({ length: 55 }, (_, i) => i + 1)).slice(0, 6);
      const rows = [...existing, 101, 102, 103, 104].map((id) => [id, rng.pick(CITIES)]);
      const updates: Dataset = { name: "customer_updates", columns: [{ name: "customer_id", type: "number" }, { name: "city", type: "text" }], rows };
      const script = (conflict: string) => `INSERT INTO customer_city_dim (customer_id, city) SELECT customer_id, city FROM customer_updates ON CONFLICT (customer_id) ${conflict};`;
      return makeScript(D.upsert, ["PostgreSQL", "UPSERT", "ON CONFLICT", "ETL"], {
        title: "Load today's city changes into the customer dimension",
        requester: cast.data,
        scenario: "Hi, the nightly feed dropped today's customer city changes into customer_updates. Some are existing customers who moved, some are brand-new customers. Please load them into customer_city_dim so that moved customers get their new city and new customers are added. Don't create duplicates and don't fail on the existing ones.",
        deliverable: "Write one statement that loads customer_updates into customer_city_dim: new customer_ids are inserted, and for customer_ids that already exist the city is replaced with the new value.",
        referenceScript: script("DO UPDATE SET city = EXCLUDED.city"),
        mistakeScript: script("DO NOTHING"),
        extraTables: [updates],
        extraSetupSql: "CREATE TABLE customer_city_dim AS SELECT customer_id, INITCAP(TRIM(city)) AS city FROM customers;\nALTER TABLE customer_city_dim ADD PRIMARY KEY (customer_id);",
        probes: [
          probe("The right number of customers is loaded", "SELECT COUNT(*) AS customers, SUM(customer_id) AS id_total FROM customer_city_dim"),
          probe("Cities are right after the load", "SELECT city, COUNT(*) AS customers FROM customer_city_dim GROUP BY city ORDER BY city"),
        ],
        previewQuery: "SELECT customer_id, city FROM customer_updates ORDER BY customer_id",
      });
    },
  },
  {
    ...D.dedupe,
    build(rng) {
      const ids = rng.shuffle(Array.from({ length: 40 }, (_, i) => i + 1)).slice(0, 5).sort((a, b) => a - b);
      return makeScript(D.dedupe, ["PostgreSQL", "Deduplication", "DELETE USING"], {
        title: "The staging table has duplicate orders",
        requester: cast.data,
        scenario: "Hello, a retry in the loader inserted some orders twice into stg_orders. Before the nightly merge runs, each order must appear exactly once. Keep one copy of each; don't remove orders that were loaded only once.",
        deliverable: "Delete the duplicate rows in stg_orders so that every order_id appears exactly once. Exactly one copy of each duplicated order must remain.",
        referenceScript: "DELETE FROM stg_orders a USING stg_orders b WHERE a.order_id = b.order_id AND a.ctid > b.ctid;",
        mistakeScript: "DELETE FROM stg_orders WHERE order_id IN (SELECT order_id FROM stg_orders GROUP BY order_id HAVING COUNT(*) > 1);",
        extraSetupSql: `CREATE TABLE stg_orders AS SELECT * FROM orders WHERE order_id <= 40;\nINSERT INTO stg_orders SELECT * FROM orders WHERE order_id IN (${ids.join(", ")});`,
        probes: [probe("Each order appears exactly once", "SELECT COUNT(*) AS rows, COUNT(DISTINCT order_id) AS distinct_orders FROM stg_orders")],
        previewQuery: "SELECT order_id, COUNT(*) AS copies FROM stg_orders GROUP BY order_id HAVING COUNT(*) > 1 ORDER BY order_id",
      });
    },
  },
];

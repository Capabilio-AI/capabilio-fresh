import { BRIGHTCART } from "../worlds/brightcart";
import type { TicketTemplate } from "./types";
import { attempt, LOG_TABLE, makeScript, planCapture, planUses, probe, readLog } from "./pg-support";

const { cast } = BRIGHTCART;
type Def = Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind" | "areas">;

const D = {
  lookup: { id: "pg-index-lookup", difficulty: "medium", minLevel: "junior", taskKind: "index", areas: ["performance"] },
  covering: { id: "pg-covering-index", difficulty: "hard", minLevel: "mid", taskKind: "index", areas: ["performance"] },
  expression: { id: "pg-expression-index", difficulty: "hard", minLevel: "mid", taskKind: "index", areas: ["performance"] },
  duplicate: { id: "pg-drop-duplicate-index", difficulty: "medium", minLevel: "mid", taskKind: "index", areas: ["performance", "maintenance"] },
  rename: { id: "pg-safe-rename", difficulty: "medium", minLevel: "mid", taskKind: "schema", areas: ["maintenance"] },
  notValid: { id: "pg-validate-constraint", difficulty: "hard", minLevel: "senior", taskKind: "constraint", areas: ["maintenance", "integrity"] },
  archive: { id: "pg-archive-with-returning", difficulty: "medium", minLevel: "mid", taskKind: "cleanup", areas: ["maintenance", "data-changes"] },
  unique: { id: "pg-unique-after-dedupe", difficulty: "medium", minLevel: "junior", taskKind: "constraint", areas: ["integrity"] },
  generated: { id: "pg-generated-column", difficulty: "medium", minLevel: "mid", taskKind: "schema", areas: ["integrity", "schema"] },
  group: { id: "pg-group-role", difficulty: "easy", minLevel: "junior", taskKind: "security", areas: ["security"] },
  revoke: { id: "pg-revoke-public", difficulty: "medium", minLevel: "mid", taskKind: "security", areas: ["security"] },
} as const satisfies Record<string, Def>;

const hasPriv = (role: string, table: string, p: string) => `has_table_privilege('${role}', '${table}', '${p}')::int`;
const hasCol = (role: string, table: string, col: string) => `has_column_privilege('${role}', '${table}', '${col}', 'SELECT')::int`;

export const PG_DBA: TicketTemplate[] = [
  {
    ...D.lookup,
    build(rng) {
      const [table, column, value, other] = rng.pick([["orders", "customer_id", "7", "order_date"], ["order_items", "order_id", "20", "product_id"], ["order_items", "product_id", "3", "order_id"]] as const);
      return makeScript(D.lookup, ["PostgreSQL", "Indexes", "Query plans"], {
        title: `A slow lookup on ${table}.${column}`, requester: cast.engineering,
        scenario: `Hi, the admin screen looks up rows in ${table} by ${column} and it is getting slower as the table grows. Please add the index that makes that lookup use an index instead of reading the whole table. We will check the query plan.`,
        deliverable: `Create an index on ${table} so that "SELECT * FROM ${table} WHERE ${column} = ${value}" is answered with an index.`,
        referenceScript: `CREATE INDEX idx_${table}_${column} ON ${table} (${column});`, mistakeScript: `CREATE INDEX idx_${table}_${other} ON ${table} (${other});`,
        probes: [...planCapture(`SELECT * FROM ${table} WHERE ${column} = ${value}`), planUses("The lookup uses an index", "Index")],
        previewQuery: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '${table}'`,
      });
    },
  },
  {
    ...D.covering,
    build() {
      return makeScript(D.covering, ["PostgreSQL", "Covering indexes", "INCLUDE", "Query plans"], {
        title: "Answer a hot query from the index alone", requester: cast.engineering,
        scenario: "Hello, one query runs thousands of times a minute: it looks up a customer's order dates. It only needs two columns, so with the right index Postgres should not have to touch the table at all. Please create that index. We will check the plan for an index-only scan.",
        deliverable: 'Create an index on orders that lets "SELECT customer_id, order_date FROM orders WHERE customer_id = 7" be answered by an Index Only Scan. The index must be searchable by customer_id.',
        referenceScript: "CREATE INDEX idx_orders_cover ON orders (customer_id) INCLUDE (order_date);", mistakeScript: "CREATE INDEX idx_orders_customer ON orders (customer_id);",
        probes: [probe("Make the table's visibility map current", "VACUUM ANALYZE orders", false), ...planCapture("SELECT customer_id, order_date FROM orders WHERE customer_id = 7"), planUses("The query is answered by an index-only scan", "Index Only Scan")],
        previewQuery: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'orders'",
      });
    },
  },
  {
    ...D.expression,
    build() {
      return makeScript(D.expression, ["PostgreSQL", "Expression indexes", "Query plans"], {
        title: "Case-insensitive customer search is slow", requester: cast.success,
        scenario: "Hi, support searches for customers with lower(name) = 'asha sharma' so capital letters do not matter, but an ordinary index on name never helps that search. Please create the index that does. We will check the plan.",
        deliverable: "Create an index on customers that makes \"SELECT * FROM customers WHERE lower(name) = 'asha sharma'\" use an index.",
        referenceScript: "CREATE INDEX idx_customers_lower_name ON customers (lower(name));", mistakeScript: "CREATE INDEX idx_customers_name ON customers (name);",
        probes: [...planCapture("SELECT * FROM customers WHERE lower(name) = 'asha sharma'"), planUses("The search uses an index", "Index")],
        previewQuery: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customers'",
      });
    },
  },
  {
    ...D.duplicate,
    build() {
      return makeScript(D.duplicate, ["PostgreSQL", "Index maintenance", "pg_indexes"], {
        title: "Two identical indexes are slowing every write", requester: cast.engineering,
        scenario: "Hello, a review found that orders carries two identical indexes on customer_id, built by two different migrations, plus a useful index on order_date. Every insert pays for both copies. Drop the redundant one, but keep exactly one index on customer_id and keep the order_date index.",
        deliverable: "Drop one of the two duplicate customer_id indexes on orders. Afterwards orders must still have exactly one index on customer_id and one on order_date.",
        referenceScript: "DROP INDEX idx_orders_customer_b;", mistakeScript: "DROP INDEX idx_orders_customer_a; DROP INDEX idx_orders_customer_b;",
        extraSetupSql: "CREATE INDEX idx_orders_customer_a ON orders (customer_id);\nCREATE INDEX idx_orders_customer_b ON orders (customer_id);\nCREATE INDEX idx_orders_date ON orders (order_date);",
        probes: [
          probe("One customer_id index remains", "SELECT COUNT(*) AS customer_indexes FROM pg_indexes WHERE tablename = 'orders' AND indexdef ILIKE '%(customer_id)%'"),
          probe("The order_date index is kept", "SELECT COUNT(*) AS date_indexes FROM pg_indexes WHERE tablename = 'orders' AND indexdef ILIKE '%(order_date)%'"),
        ],
        previewQuery: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'orders' ORDER BY indexname",
      });
    },
  },
  {
    ...D.rename,
    build() {
      return makeScript(D.rename, ["PostgreSQL", "ALTER TABLE", "Views", "Backwards compatibility"], {
        title: "Rename list_price without breaking the old reports", requester: cast.engineering,
        scenario: "Hi, we are renaming products.list_price to price to match the new catalogue service, but a dozen old reports still read list_price. Rename it, and give the old reports a way to keep working until they are migrated.",
        deliverable: "Rename the column list_price on products to price, and create a view products_legacy with the columns product_id, product_name, category and list_price (the new price column under its old name).",
        referenceScript: "ALTER TABLE products RENAME COLUMN list_price TO price;\nCREATE VIEW products_legacy AS SELECT product_id, product_name, category, price AS list_price FROM products;", mistakeScript: "ALTER TABLE products RENAME COLUMN list_price TO price;",
        probes: [probe("The column is renamed", "SELECT SUM(price) AS total FROM products"), probe("The old name still works through the view", "SELECT SUM(list_price) AS total FROM products_legacy")],
        previewQuery: "SELECT column_name FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position",
      });
    },
  },
  {
    ...D.notValid,
    build() {
      return makeScript(D.notValid, ["PostgreSQL", "NOT VALID", "VALIDATE CONSTRAINT", "Zero-downtime changes"], {
        title: "Add a rule to a huge table without locking it for long", requester: cast.engineering,
        scenario: "Hello, order_items must never have a quantity of zero or less, but the table is large and a plain constraint would block writes while it scans every row. The safe way is to add the rule without checking existing rows, so new rows are protected at once, and then validate the old rows separately. Please do both steps and name the constraint items_qty_chk.",
        deliverable: "Add a CHECK constraint items_qty_chk (quantity > 0) to order_items as NOT VALID, then validate it so that it ends up fully validated.",
        referenceScript: "ALTER TABLE order_items ADD CONSTRAINT items_qty_chk CHECK (quantity > 0) NOT VALID;\nALTER TABLE order_items VALIDATE CONSTRAINT items_qty_chk;", mistakeScript: "ALTER TABLE order_items ADD CONSTRAINT items_qty_chk CHECK (quantity > 0) NOT VALID;",
        probes: [probe("The constraint is validated", "SELECT convalidated::int AS validated FROM pg_constraint WHERE conname = 'items_qty_chk'"), LOG_TABLE, attempt(1, "INSERT INTO order_items (item_id, order_id, product_id, quantity, unit_price) VALUES (99999, 1, 1, 0, 100)"), readLog("A zero quantity is refused")],
        previewQuery: "SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'order_items'::regclass",
      });
    },
  },
  {
    ...D.archive,
    build(rng) {
      const date = rng.pick(["2026-05-01", "2026-06-01", "2026-07-01"]);
      return makeScript(D.archive, ["PostgreSQL", "DELETE ... RETURNING", "CTEs", "Archiving"], {
        title: `Archive cancelled orders older than ${date} in one safe step`, requester: cast.finance,
        scenario: `Hi, live_orders is getting heavy. Cancelled orders placed before ${date} should move to orders_archive (an empty table with the same columns), and none may be lost if something goes wrong halfway, so please do it in a single statement.`,
        deliverable: `Move the cancelled orders placed before ${date} from live_orders into orders_archive with a single statement (delete from live_orders and insert what was deleted).`,
        referenceScript: `WITH moved AS (DELETE FROM live_orders WHERE status = 'cancelled' AND order_date < '${date}' RETURNING *) INSERT INTO orders_archive SELECT * FROM moved;`,
        mistakeScript: `DELETE FROM live_orders WHERE status = 'cancelled' AND order_date < '${date}';`,
        extraSetupSql: "CREATE TABLE live_orders AS SELECT * FROM orders;\nCREATE TABLE orders_archive (LIKE live_orders);",
        probes: [probe("Rows moved, none lost", "SELECT (SELECT COUNT(*) FROM live_orders) AS live, (SELECT COUNT(*) FROM orders_archive) AS archived")],
        previewQuery: "SELECT (SELECT COUNT(*) FROM live_orders) AS live, (SELECT COUNT(*) FROM orders_archive) AS archived",
      });
    },
  },
  {
    ...D.unique,
    build() {
      return makeScript(D.unique, ["PostgreSQL", "UNIQUE constraints", "Deduplication"], {
        title: "Product names must be unique, but one is already duplicated", requester: cast.category,
        scenario: "Hello, a buggy import created a second row for an existing product (product_id 99). We want the database to forbid duplicate product names from now on, but the constraint will not apply while the duplicate exists. Remove the duplicate row first, then add the rule.",
        deliverable: "Delete the duplicate product with product_id 99, then add a UNIQUE constraint on products (product_name) so a duplicate name is refused.",
        referenceScript: "DELETE FROM products WHERE product_id = 99;\nALTER TABLE products ADD CONSTRAINT products_name_unique UNIQUE (product_name);", mistakeScript: "ALTER TABLE products ADD CONSTRAINT products_name_unique UNIQUE (product_name);",
        extraSetupSql: "INSERT INTO products (product_id, product_name, category, list_price) SELECT 99, product_name, category, list_price FROM products WHERE product_id = 1;",
        probes: [probe("The duplicate is gone", "SELECT COUNT(*) AS products FROM products"), LOG_TABLE, attempt(1, "INSERT INTO products (product_id, product_name, category, list_price) SELECT 98, product_name, category, list_price FROM products WHERE product_id = 2"), readLog("A duplicate name is refused")],
        previewQuery: "SELECT product_name, COUNT(*) AS copies FROM products GROUP BY product_name HAVING COUNT(*) > 1",
      });
    },
  },
  {
    ...D.generated,
    build() {
      return makeScript(D.generated, ["PostgreSQL", "Generated columns", "Data integrity"], {
        title: "Store each line's total, and make sure nobody can overwrite it", requester: cast.finance,
        scenario: "Hi, reports keep recomputing quantity × unit price and some people have started typing their own totals. Add a line_total column to order_items that the database always keeps correct, and that nobody can set by hand.",
        deliverable: "Add a numeric column line_total to order_items that is always quantity × unit_price, stored, and generated by the database so it cannot be updated directly.",
        referenceScript: "ALTER TABLE order_items ADD COLUMN line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED;", mistakeScript: "ALTER TABLE order_items ADD COLUMN line_total numeric;\nUPDATE order_items SET line_total = quantity * unit_price;",
        probes: [probe("The totals are right", "SELECT SUM(line_total) AS total FROM order_items"), LOG_TABLE, attempt(1, "UPDATE order_items SET line_total = 1 WHERE item_id = 1"), readLog("A hand-written total is refused")],
        previewQuery: "SELECT item_id, quantity, unit_price FROM order_items ORDER BY item_id LIMIT 5",
      });
    },
  },
  {
    ...D.group,
    build() {
      const check = `SELECT ${hasPriv("analyst_ann", "orders", "SELECT")} AS orders_read, ${hasPriv("analyst_ann", "products", "SELECT")} AS products_read, ${hasPriv("analyst_ann", "customers", "SELECT")} AS customers_read, ${hasPriv("analyst_ann", "orders", "UPDATE")} AS orders_write`;
      return makeScript(D.group, ["PostgreSQL", "Roles", "Role membership", "GRANT"], {
        title: "Give the analyst team access through one group role", requester: cast.security,
        scenario: "Hi, we keep granting access person by person. Create a group role called analysts that can read orders, order_items and products, create a login-less role analyst_ann for a new analyst, and make her a member of the group so she gets the access that way. Nobody on the team should see customers or change anything.",
        deliverable: "Create roles analysts and analyst_ann (both without login). Grant SELECT on orders, order_items and products to analysts only, and make analyst_ann a member of analysts.",
        referenceScript: "CREATE ROLE analysts NOLOGIN;\nCREATE ROLE analyst_ann NOLOGIN;\nGRANT SELECT ON orders, order_items, products TO analysts;\nGRANT analysts TO analyst_ann;", mistakeScript: "CREATE ROLE analysts NOLOGIN;\nCREATE ROLE analyst_ann NOLOGIN;\nGRANT SELECT ON orders, order_items, products TO analysts;",
        probes: [probe("analyst_ann gets the right access through the group", check)],
        previewQuery: "SELECT rolname FROM pg_roles WHERE rolname NOT LIKE 'pg\\_%' ORDER BY rolname",
      });
    },
  },
  {
    ...D.revoke,
    build() {
      const check = `SELECT ${hasPriv("support_trainee", "customers", "SELECT")} AS table_read, ${hasCol("support_trainee", "customers", "city")} AS city_read, ${hasCol("support_trainee", "customers", "name")} AS name_read`;
      return makeScript(D.revoke, ["PostgreSQL", "REVOKE", "PUBLIC", "Column privileges"], {
        title: "Customers are readable by everybody; fix that", requester: cast.security,
        scenario: "Hello, an audit found that every database role can read the customers table because someone granted SELECT to PUBLIC. Take that away. The new support trainee role (support_trainee) still needs to see each customer's city to route tickets, but never the name.",
        deliverable: "Revoke all access to customers from PUBLIC, then let support_trainee read only the city column of customers (and nothing else).",
        referenceScript: "REVOKE ALL ON customers FROM PUBLIC;\nGRANT SELECT (city) ON customers TO support_trainee;", mistakeScript: "REVOKE ALL ON customers FROM PUBLIC;",
        extraSetupSql: "GRANT SELECT ON customers TO PUBLIC;\nCREATE ROLE support_trainee NOLOGIN;",
        probes: [probe("support_trainee sees only the city", check)],
        previewQuery: "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'customers' ORDER BY grantee",
      });
    },
  },
];

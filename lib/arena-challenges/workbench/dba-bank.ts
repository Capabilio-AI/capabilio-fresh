// DBA tasks: the student writes SQL statements (CREATE INDEX, ALTER TABLE, UPDATE, views, constraints, triggers, transactions) and is graded on
// the database those statements leave behind. Each task has a reference script; the answer is what a set of probes returns after it runs
// (see ScriptAnswer in sql-task.ts). Same datasets as the SQL bank, so the tables feel familiar.
import { makeRng, type Rng } from "@/lib/workplace/rng";
import type { Cell, Dataset } from "@/lib/arena-workstations/engines/dataset";
import { buildWorld, type Difficulty, type WorldKey } from "./sql-bank";

export interface DbaTaskDef {
  title: string;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  tables: Dataset[];
  setupSql?: string;
  /** the reference solution */
  script: string;
  /** run, in order, after the script: read-only queries, or a statement that must be rejected */
  probes: string[];
  /** shown after Run */
  previewQuery: string;
  tags: string[];
}

const table = (name: string, columns: Dataset["columns"], rows: Cell[][]): Dataset => ({ name, columns, rows });
const col = (name: string, type: "number" | "text" | "date", description?: string) => ({ name, type, description });

const worldTables = (world: WorldKey, seed: number) => buildWorld(world, seed)[0].tables;

/** the column lists of every non-automatic index on a table, in index and column order, e.g. "customer_id,order_date" */
const INDEX_COLS = (t: string) => `SELECT COALESCE(group_concat(col, ','), '') AS index_columns FROM (SELECT ii.name AS col FROM sqlite_master m, pragma_index_info(m.name) ii WHERE m.type = 'index' AND m.tbl_name = '${t}' AND m.sql IS NOT NULL ORDER BY m.name, ii.seqno)`;
const INDEX_COUNT = (t: string) => `SELECT COUNT(*) AS indexes FROM sqlite_master WHERE type = 'index' AND tbl_name = '${t}' AND sql IS NOT NULL`;
const INDEX_LIST = (t: string) => `SELECT m.name AS index_name FROM sqlite_master m WHERE m.type = 'index' AND m.tbl_name = '${t}' AND m.sql IS NOT NULL ORDER BY m.name`;
const UNIQUE_COUNT = (t: string) => `SELECT COUNT(*) AS unique_indexes FROM pragma_index_list('${t}') il JOIN sqlite_master m ON m.name = il.name WHERE il."unique" = 1 AND m.sql IS NOT NULL`;

type Mk = (t: DbaTaskDef) => void;

// (world, table, column) triples that suit "this lookup is slow, index it"
const SINGLE: [WorldKey, string, string, string][] = [
  ["shop", "orders", "customer_id", "list a customer's orders"], ["shop", "order_items", "product_id", "find every sale of a product"], ["hr", "employees", "dept_id", "list a department's staff"],
  ["campus", "enrollments", "course_id", "list a course's students"], ["library", "loans", "book_id", "find the loans of a book"], ["streaming", "plays", "user_id", "show one user's plays"],
  ["logs", "requests", "service", "pull one service's requests"], ["bank", "transactions", "account_id", "show one account's statement"], ["flights", "bookings", "flight_id", "list a flight's bookings"],
];
const COMPOSITE: [WorldKey, string, string, string, string][] = [
  ["shop", "orders", "customer_id", "order_date", "a customer's orders by date"], ["library", "loans", "member_id", "loaned_on", "a member's loans by date"], ["streaming", "plays", "user_id", "played_on", "a user's plays by date"],
  ["logs", "requests", "service", "logged_on", "a service's requests by day"], ["bank", "transactions", "account_id", "txn_date", "an account's statement by date"], ["campus", "enrollments", "student_id", "semester", "a student's courses by semester"],
];

function indexTasks(rng: Rng, seed: number, add: Mk) {
  const [w, t, c, why] = rng.pick(SINGLE);
  add({ title: `Index the ${t} table`, category: "Indexes", difficulty: "easy", tables: worldTables(w, seed), tags: [w, "index"],
    prompt: `Reports often ${why}, filtering ${t} by ${c}, and they have become slow. Create one index on ${t}(${c}). The name is up to you.`,
    script: `CREATE INDEX idx_${t}_${c} ON ${t}(${c});`, probes: [INDEX_COLS(t), INDEX_COUNT(t)], previewQuery: INDEX_LIST(t) });
  const [w2, t2, c1, c2, why2] = rng.pick(COMPOSITE);
  add({ title: `Composite index on ${t2}`, category: "Indexes", difficulty: "medium", tables: worldTables(w2, seed), tags: [w2, "index"],
    prompt: `A query fetches ${why2}: it filters on ${c1} and sorts by ${c2}. Create ONE index on ${t2} that covers both columns in that order (${c1} first, then ${c2}).`,
    script: `CREATE INDEX idx_${t2}_${c1}_${c2} ON ${t2}(${c1}, ${c2});`, probes: [INDEX_COLS(t2), INDEX_COUNT(t2)], previewQuery: INDEX_LIST(t2) });
  const w3 = rng.pick(["shop", "hr", "library"] as const);
  const u = w3 === "shop" ? ["customers", "name"] : w3 === "hr" ? ["employees", "name"] : ["members", "name"];
  add({ title: `Enforce unique ${u[1]} on ${u[0]}`, category: "Constraints", difficulty: "medium", tables: worldTables(w3, seed), tags: [w3, "unique"],
    prompt: `No two rows in ${u[0]} should share the same ${u[1]}. Enforce that with a UNIQUE index on ${u[0]}(${u[1]}).`,
    script: `CREATE UNIQUE INDEX uq_${u[0]}_${u[1]} ON ${u[0]}(${u[1]});`, probes: [INDEX_COLS(u[0]), UNIQUE_COUNT(u[0])], previewQuery: INDEX_LIST(u[0]) });
  const [pw, pt, pc, pv] = rng.pick([["shop", "orders", "status", "pending"], ["bank", "transactions", "kind", "fee"], ["logs", "requests", "level", "ERROR"], ["flights", "bookings", "status", "cancelled"]] as const);
  add({ title: `Partial index for ${pv} rows`, category: "Indexes", difficulty: "hard", tables: worldTables(pw, seed), tags: [pw, "partial index"],
    prompt: `Only a small share of ${pt} rows have ${pc} = '${pv}', and a dashboard reads just those. Create a PARTIAL index on ${pt}(${pc}) that only includes rows where ${pc} = '${pv}'.`,
    script: `CREATE INDEX idx_${pt}_${pv.toLowerCase()} ON ${pt}(${pc}) WHERE ${pc} = '${pv}';`,
    probes: [INDEX_COLS(pt), `SELECT COUNT(*) AS partial_indexes FROM sqlite_master WHERE type = 'index' AND tbl_name = '${pt}' AND sql LIKE '%WHERE%'`], previewQuery: INDEX_LIST(pt) });
  // two indexes where one is redundant: drop the narrower one
  const [rw, rt, rc1, rc2] = rng.pick([["shop", "orders", "customer_id", "order_date"], ["library", "loans", "member_id", "loaned_on"], ["streaming", "plays", "user_id", "played_on"]] as const);
  add({ title: `Drop the redundant index on ${rt}`, category: "Indexes", difficulty: "medium", tables: worldTables(rw, seed), tags: [rw, "index"],
    setupSql: `CREATE INDEX idx_a ON ${rt}(${rc1});\nCREATE INDEX idx_b ON ${rt}(${rc1}, ${rc2});`,
    prompt: `${rt} has two indexes: idx_a on (${rc1}) and idx_b on (${rc1}, ${rc2}). idx_b already serves every lookup idx_a does, so idx_a only slows writes. Remove the redundant one and keep the other.`,
    script: `DROP INDEX idx_a;`, probes: [INDEX_COLS(rt), INDEX_COUNT(rt)], previewQuery: INDEX_LIST(rt) });
}

function schemaTasks(rng: Rng, seed: number, add: Mk) {
  const shop = worldTables("shop", seed);
  const lo = rng.pick([400, 500, 600]), hi = rng.pick([1200, 1500, 2000]);
  add({ title: "Add a price band to products", category: "Schema changes", difficulty: "medium", tables: shop, tags: ["shop", "alter"],
    prompt: `Add a TEXT column price_band to products and fill it for every row: 'cheap' when price is below ${lo}, 'premium' when price is ${hi} or more, otherwise 'mid'.`,
    script: `ALTER TABLE products ADD COLUMN price_band TEXT;\nUPDATE products SET price_band = CASE WHEN price < ${lo} THEN 'cheap' WHEN price >= ${hi} THEN 'premium' ELSE 'mid' END;`,
    probes: ["SELECT id, price_band FROM products ORDER BY id"], previewQuery: "SELECT id, name, price, price_band FROM products ORDER BY id" });
  const cutoff = rng.pick(["2025-06-01", "2025-07-01", "2025-08-01"]);
  add({ title: "Archive old orders", category: "Data movement", difficulty: "hard", tables: shop, tags: ["shop", "archive"],
    prompt: `Move orders placed before ${cutoff} out of the busy table: create orders_archive with the same columns and rows as those orders (CREATE TABLE ... AS SELECT is fine), then delete them from orders.`,
    script: `CREATE TABLE orders_archive AS SELECT * FROM orders WHERE order_date < '${cutoff}';\nDELETE FROM orders WHERE order_date < '${cutoff}';`,
    probes: ["SELECT COUNT(*) AS in_orders FROM orders", "SELECT COUNT(*) AS in_archive FROM orders_archive", "SELECT id FROM orders_archive ORDER BY id"], previewQuery: "SELECT (SELECT COUNT(*) FROM orders) AS in_orders, (SELECT COUNT(*) FROM orders_archive) AS in_archive" });
  add({ title: "Delivered revenue view", category: "Views", difficulty: "medium", tables: shop, tags: ["shop", "view"],
    prompt: "Create a view named delivered_totals with two columns, customer_name and total_spent: each customer's total spend (price x qty) on DELIVERED orders only. Customers with no delivered order do not appear.",
    script: "CREATE VIEW delivered_totals AS SELECT c.name AS customer_name, SUM(p.price * oi.qty) AS total_spent FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id WHERE o.status = 'delivered' GROUP BY c.id;",
    probes: ["SELECT customer_name, total_spent FROM delivered_totals ORDER BY customer_name"], previewQuery: "SELECT customer_name, total_spent FROM delivered_totals ORDER BY customer_name" });
  add({ title: "Split cities into their own table", category: "Normalisation", difficulty: "hard", tables: shop, tags: ["shop", "normalise"],
    prompt: "Customers repeat the city name on every row. Create a table cities(id INTEGER PRIMARY KEY, name TEXT UNIQUE) holding each distinct city once, with ids 1, 2, 3 ... assigned in alphabetical order of the city name.",
    script: "CREATE TABLE cities (id INTEGER PRIMARY KEY, name TEXT UNIQUE);\nINSERT INTO cities(name) SELECT DISTINCT city FROM customers ORDER BY city;",
    probes: ["SELECT id, name FROM cities ORDER BY id", "SELECT COUNT(*) AS unique_indexes FROM pragma_index_list('cities') WHERE \"unique\" = 1"], previewQuery: "SELECT id, name FROM cities ORDER BY id" });
  const flag = rng.pick(["is_active", "is_vip"]);
  const flagCity = rng.pick(["Pune", "Chennai"]);
  add({ title: `Add a ${flag} flag safely`, category: "Schema changes", difficulty: "easy", tables: shop, tags: ["shop", "alter"],
    prompt: `Add an INTEGER column ${flag} to customers that is NOT NULL with a default of 1, so existing rows get 1 automatically. Then set it to 0 for customers who live in ${flagCity}.`,
    script: `ALTER TABLE customers ADD COLUMN ${flag} INTEGER NOT NULL DEFAULT 1;\nUPDATE customers SET ${flag} = 0 WHERE city = '${flagCity}';`,
    probes: [`SELECT id, ${flag} FROM customers ORDER BY id`, `SELECT "notnull", dflt_value FROM pragma_table_info('customers') WHERE name = '${flag}'`], previewQuery: `SELECT id, name, city, ${flag} FROM customers ORDER BY id` });
}

function dataFixTasks(rng: Rng, add: Mk) {
  // contacts with duplicate and messy emails
  const base = ["asha", "bala", "chitra", "deepak", "esha", "farid", "gita", "hari", "indu", "jai", "kavya", "lalit"];
  const rows: Cell[][] = [];
  let id = 1;
  for (const b of base) {
    rows.push([id++, b.toUpperCase().slice(0, 1) + b.slice(1), `${b}@mail.test`]);
    if (id < 9 || rng.chance(0.55)) rows.push([id++, b.toUpperCase().slice(0, 1) + b.slice(1), `  ${b.toUpperCase()}@Mail.test `]);
    if (rng.chance(0.2)) rows.push([id++, b.toUpperCase().slice(0, 1) + b.slice(1), `${b}@mail.test`]);
  }
  const contacts = table("contacts", [col("id", "number"), col("name", "text"), col("email", "text", "may have stray spaces and capitals")], rows);
  add({ title: "Clean up the email column", category: "Data fixes", difficulty: "easy", tables: [contacts], tags: ["update", "clean"],
    prompt: "Emails were typed by hand: some have leading or trailing spaces and capital letters. Update every row so email is trimmed and lower-case.",
    script: "UPDATE contacts SET email = lower(trim(email));", probes: ["SELECT id, email FROM contacts ORDER BY id"], previewQuery: "SELECT id, name, email FROM contacts ORDER BY id" });
  add({ title: "Remove duplicate contacts", category: "Data fixes", difficulty: "hard", tables: [contacts], tags: ["delete", "dedupe"],
    prompt: "The same person was entered several times with the same email (ignore capitals and stray spaces when comparing). Delete the duplicates, keeping only the row with the LOWEST id for each email.",
    script: "DELETE FROM contacts WHERE id NOT IN (SELECT MIN(id) FROM contacts GROUP BY lower(trim(email)));", probes: ["SELECT id FROM contacts ORDER BY id"], previewQuery: "SELECT id, name, email FROM contacts ORDER BY id" });
  const cities = ["Pune", "Nagpur", "Kochi", null, null, "Jaipur", null, "Indore"];
  const leads = table("leads", [col("id", "number"), col("name", "text"), col("city", "text", "NULL when unknown")], Array.from({ length: 14 }, (_, i) => [i + 1, base[i % base.length] + (i >= base.length ? "2" : ""), rng.pick(cities)]));
  add({ title: "Fill the missing cities", category: "Data fixes", difficulty: "easy", tables: [leads], tags: ["update", "null"],
    prompt: "Some leads have no city (NULL). Set the city to 'Unknown' for those rows and leave the others as they are.",
    script: "UPDATE leads SET city = 'Unknown' WHERE city IS NULL;", probes: ["SELECT id, city FROM leads ORDER BY id"], previewQuery: "SELECT id, name, city FROM leads ORDER BY id" });
}

function integrityTasks(seed: number, add: Mk) {
  const shop = worldTables("shop", seed);
  const payments = `CREATE TABLE payments (\n  id INTEGER PRIMARY KEY,\n  order_id INTEGER NOT NULL,\n  amount REAL CHECK (amount > 0),\n  method TEXT DEFAULT 'upi'\n);`;
  add({ title: "Design a payments table", category: "Constraints", difficulty: "hard", tables: shop, tags: ["shop", "create table", "constraints"],
    prompt: "Create a table payments with: id INTEGER PRIMARY KEY; order_id INTEGER that can never be NULL; amount REAL that must be greater than 0 (a CHECK constraint); and method TEXT that defaults to 'upi'. The database must reject bad rows itself.",
    script: payments,
    probes: ["SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info('payments') ORDER BY cid", "INSERT INTO payments(id, order_id, amount) VALUES (1, 1, -5)", "INSERT INTO payments(id, order_id, amount) VALUES (2, NULL, 10)", "INSERT INTO payments(id, order_id, amount) VALUES (3, 1, 500)", "SELECT id, method FROM payments ORDER BY id"],
    previewQuery: "SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info('payments') ORDER BY cid" });
  const bank = worldTables("bank", seed);
  add({ title: "Audit every balance change", category: "Triggers", difficulty: "hard", tables: bank, tags: ["bank", "trigger"],
    prompt: "Create a table balance_audit(account_id, old_balance, new_balance) and a trigger on accounts that, whenever balance is updated, adds one row to balance_audit with the account's id and its balance before and after.",
    script: "CREATE TABLE balance_audit (account_id INTEGER, old_balance REAL, new_balance REAL);\nCREATE TRIGGER trg_balance_audit AFTER UPDATE OF balance ON accounts\nBEGIN\n  INSERT INTO balance_audit VALUES (OLD.id, OLD.balance, NEW.balance);\nEND;",
    probes: ["UPDATE accounts SET balance = balance + 100 WHERE id IN (1, 2)", "SELECT account_id, old_balance, new_balance FROM balance_audit ORDER BY account_id"], previewQuery: "SELECT name FROM sqlite_master WHERE type = 'trigger'" });
  add({ title: "Transfer money safely", category: "Transactions", difficulty: "medium", tables: bank, tags: ["bank", "transaction"],
    prompt: "Move 5000 rupees from account 1 to account 2 as ONE transaction: BEGIN, subtract from account 1, add to account 2, COMMIT.",
    script: "BEGIN;\nUPDATE accounts SET balance = balance - 5000 WHERE id = 1;\nUPDATE accounts SET balance = balance + 5000 WHERE id = 2;\nCOMMIT;",
    probes: ["SELECT id, balance FROM accounts WHERE id IN (1, 2) ORDER BY id"], previewQuery: "SELECT id, holder, balance FROM accounts WHERE id IN (1, 2) ORDER BY id" });
  add({ title: "Keep the bank's totals honest", category: "Constraints", difficulty: "medium", tables: bank, tags: ["bank", "view"],
    prompt: "Create a view account_summary with columns holder, deposits and withdrawals: for each account, the total of its deposit transactions and the total of its withdrawal transactions (0 when there are none). Include every account.",
    script: "CREATE VIEW account_summary AS SELECT a.holder AS holder, COALESCE(SUM(CASE WHEN t.kind = 'deposit' THEN t.amount END), 0) AS deposits, COALESCE(SUM(CASE WHEN t.kind = 'withdrawal' THEN t.amount END), 0) AS withdrawals FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id GROUP BY a.id;",
    probes: ["SELECT holder, deposits, withdrawals FROM account_summary ORDER BY holder"], previewQuery: "SELECT holder, deposits, withdrawals FROM account_summary ORDER BY holder" });
}

/** Every DBA task for one seed. The same seed always gives the same tasks. */
export function buildDba(seed: number): DbaTaskDef[] {
  const rng = makeRng(seed * 15485863 + 29);
  const out: DbaTaskDef[] = [];
  const add: Mk = (t) => { if (t.script) out.push(t); };
  indexTasks(rng, seed, add);
  schemaTasks(rng, seed, add);
  dataFixTasks(rng, add);
  integrityTasks(seed, add);
  return out;
}

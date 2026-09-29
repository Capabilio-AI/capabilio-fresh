// UrbanKart — a fictional Indian D2C e-commerce company whose analytics
// warehouse the Data Analyst workstation runs against. Generated
// deterministically (fixed PRNG seed) so every student, every run, and the
// server-side grader see byte-identical data. Changing anything here changes
// every ticket's correct answer — grading re-runs the hidden ground-truth
// query on each submit, so answers stay consistent, but re-check the ticket
// wording (e.g. quoted row counts) if you edit it.

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS: [string, string, number][] = [
  ["Wireless Earbuds", "Electronics", 1499],
  ["Smartwatch Lite", "Electronics", 2999],
  ["Power Bank 10000mAh", "Electronics", 899],
  ["USB-C Charger 30W", "Electronics", 649],
  ["Non-stick Tawa", "Home & Kitchen", 749],
  ["Steel Water Bottle", "Home & Kitchen", 399],
  ["Mixer Grinder 750W", "Home & Kitchen", 3299],
  ["Cotton Bedsheet Set", "Home & Kitchen", 1199],
  ["Cotton Kurta", "Fashion", 899],
  ["Denim Jeans", "Fashion", 1299],
  ["Running Shoes", "Fashion", 2499],
  ["Face Wash 100ml", "Beauty", 249],
  ["Sunscreen SPF 50", "Beauty", 449],
  ["Hair Oil 200ml", "Beauty", 199],
  ["Basmati Rice 5kg", "Grocery", 649],
  ["Cold-pressed Groundnut Oil 1L", "Grocery", 329],
  ["Green Tea 100 bags", "Grocery", 299],
  ["Dry Fruits Mix 500g", "Grocery", 699],
];

const FIRST = ["Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Sneha", "Arjun", "Kavya", "Rahul", "Meera", "Karthik", "Divya", "Siddharth", "Pooja", "Nikhil", "Isha", "Aditya", "Nandini", "Harsh", "Lakshmi"];
const LAST = ["Sharma", "Reddy", "Iyer", "Patel", "Nair", "Gupta", "Rao", "Singh", "Menon", "Das"];
// Deliberately messy: the same city recorded with different casing/whitespace,
// exactly what a real CRM export looks like.
const CITIES = ["Mumbai", "Bengaluru", "Hyderabad", "Delhi", "Chennai", "Pune", "mumbai", "Bengaluru ", "HYDERABAD", " Delhi"];

const DAY_MS = 86_400_000;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const START_SIGNUP = Date.UTC(2026, 0, 1);
const START_ORDERS = Date.UTC(2026, 5, 1);
const END_ORDERS = Date.UTC(2026, 7, 31);

function sqlValue(v: string | number | null): string {
  if (v === null) return "NULL";
  return typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`;
}

function insert(table: string, rows: (string | number | null)[][]): string {
  return rows.map((r) => `INSERT INTO ${table} VALUES (${r.map(sqlValue).join(", ")});`).join("\n");
}

function buildSeedSql(): string {
  const rand = mulberry32(20260601);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];

  const products = PRODUCTS.map(([name, category, price], i) => [101 + i, name, category, price]);

  const customers: (string | number | null)[][] = [];
  for (let i = 0; i < 200; i++) {
    const id = 5001 + i;
    const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
    const email = i % 13 === 7 ? null : `${name.toLowerCase().replace(" ", ".")}.${id}@mail.com`;
    const signup = START_SIGNUP + Math.floor(rand() * 200) * DAY_MS;
    customers.push([id, name, email, pick(CITIES), isoDate(signup), rand() < 0.25 ? "Premium" : "Regular"]);
  }
  // Three customers who signed up twice — same email, new customer_id.
  for (const src of [customers[3], customers[48], customers[121]]) {
    customers.push([5001 + customers.length, src[1], src[2], src[3], "2026-07-20", src[5]]);
  }

  const orders: (string | number | null)[][] = [];
  for (let i = 0; i < 420; i++) {
    // Skewed toward the first customers: a few heavy buyers and a long tail
    // of one-time or zero-order customers, like a real store.
    const customer = customers[Math.floor(Math.pow(rand(), 1.6) * customers.length)];
    const signup = Date.parse(customer[4] as string);
    const from = Math.max(signup, START_ORDERS);
    if (from > END_ORDERS) continue;
    const date = from + Math.floor(rand() * ((END_ORDERS - from) / DAY_MS + 1)) * DAY_MS;
    const product = pick(products);
    const quantity = 1 + Math.floor(rand() * 3);
    const discount = pick([0, 0, 0, 5, 10, 15]);
    const r = rand();
    const status = r < 0.82 ? "delivered" : r < 0.92 ? "cancelled" : "returned";
    const amount = Math.round(quantity * (product[3] as number) * (1 - discount / 100) * 100) / 100;
    orders.push([900001 + i, customer[0], product[0], quantity, isoDate(date), status, rand() < 0.6 ? "app" : "web", discount, amount]);
  }

  return [
    "CREATE TABLE customers (customer_id INTEGER, name TEXT, email TEXT, city TEXT, signup_date TEXT, segment TEXT);",
    "CREATE TABLE products (product_id INTEGER, product_name TEXT, category TEXT, unit_price REAL);",
    "CREATE TABLE orders (order_id INTEGER, customer_id INTEGER, product_id INTEGER, quantity INTEGER, order_date TEXT, status TEXT, channel TEXT, discount_pct REAL, amount REAL);",
    insert("customers", customers),
    insert("products", products),
    insert("orders", orders),
  ].join("\n");
}

export const URBANKART_SEED_SQL = buildSeedSql();

export interface SchemaTable {
  name: string;
  description: string;
  columns: { name: string; type: string; note?: string }[];
}

export const URBANKART_SCHEMA: SchemaTable[] = [
  {
    name: "customers",
    description: "CRM export — one row per sign-up (not yet de-duplicated).",
    columns: [
      { name: "customer_id", type: "INTEGER" },
      { name: "name", type: "TEXT" },
      { name: "email", type: "TEXT", note: "can be NULL" },
      { name: "city", type: "TEXT", note: "free text, inconsistent casing/spaces" },
      { name: "signup_date", type: "TEXT", note: "YYYY-MM-DD" },
      { name: "segment", type: "TEXT", note: "'Regular' | 'Premium'" },
    ],
  },
  {
    name: "products",
    description: "Product catalogue.",
    columns: [
      { name: "product_id", type: "INTEGER" },
      { name: "product_name", type: "TEXT" },
      { name: "category", type: "TEXT" },
      { name: "unit_price", type: "REAL", note: "₹" },
    ],
  },
  {
    name: "orders",
    description: "One row per order, June–August 2026.",
    columns: [
      { name: "order_id", type: "INTEGER" },
      { name: "customer_id", type: "INTEGER" },
      { name: "product_id", type: "INTEGER" },
      { name: "quantity", type: "INTEGER" },
      { name: "order_date", type: "TEXT", note: "YYYY-MM-DD" },
      { name: "status", type: "TEXT", note: "'delivered' | 'cancelled' | 'returned'" },
      { name: "channel", type: "TEXT", note: "'app' | 'web'" },
      { name: "discount_pct", type: "REAL" },
      { name: "amount", type: "REAL", note: "₹, net of discount" },
    ],
  },
];

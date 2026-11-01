import type { Cell, Dataset } from "@/lib/arena-workstations/engines/dataset";
import { MlRejected, type MlTemplate, type Texts } from "../ml/tickets";
import { generateBrightCart } from "../worlds/brightcart";
import { numbersDraft, persist, round, type NumberField } from "../data-science/numbers";
import type { Rng } from "../rng";

/**
 * The Data Analyst's Python tickets, served by ml_workspace for the "python" area. They are what a fresher is handed in the first months: read the
 * exports with pandas, filter, group, count and total. The company's own warehouse is the data, so every expected number is computed here from the
 * same rows the student downloads, in plain TypeScript. The student's code runs in their browser and only the numbers are sent.
 */
export const ANALYST_PYTHON_AREAS: readonly string[] = ["python"];

const company = "BrightCart";
const SALES = { name: "Rohan Mehta", title: "Sales Operations Manager" };
const FINANCE = { name: "Anita Desai", title: "Finance Controller" };
const MARKETING = { name: "Zara Qureshi", title: "Marketing Lead" };
const texts = (requester: Texts["requester"], title: string, scenario: string): Texts => ({ company, requester, title, scenario });

const csvCell = (v: Cell) => (v === null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const toCsv = (t: Dataset) => [t.columns.map((c) => c.name).join(","), ...t.rows.map((r) => r.map(csvCell).join(","))].join("\n");
const table = (tables: Dataset[], name: string): Dataset => tables.find((t) => t.name === name)!;
const col = (t: Dataset, name: string) => t.columns.findIndex((c) => c.name === name);
const files = (tables: Dataset[], names: string[]) => names.map((n) => ({ name: `${n}.csv`, text: toCsv(table(tables, n)) }));
const tidy = (s: unknown) => String(s).trim().toLowerCase();

const STARTER = (names: string[], hint: string) => `import pandas as pd\n\n${names.map((n) => `${n} = pd.read_csv("${n}.csv")`).join("\n")}\n\n# ${hint}\n# Print what you find, then type the numbers into the boxes below.\n`;

/** Delivered revenue per order id, from the line items: quantity x the price charged at the time. */
function deliveredRevenue(tables: Dataset[]): Map<number, number> {
  const orders = table(tables, "orders");
  const items = table(tables, "order_items");
  const delivered = new Set(orders.rows.filter((r) => r[col(orders, "status")] === "delivered").map((r) => r[0] as number));
  const out = new Map<number, number>();
  for (const r of items.rows) {
    const id = r[col(items, "order_id")] as number;
    if (delivered.has(id)) out.set(id, (out.get(id) ?? 0) + (r[col(items, "quantity")] as number) * (r[col(items, "unit_price")] as number));
  }
  return out;
}


interface Line { orderId: number; customerId: number; date: string; channel: string; category: string; city: string; revenue: number }

/** Delivered order lines with the product category, the customer's tidied city and the line revenue: what a student builds with merges in pandas. */
function deliveredLines(tables: Dataset[]): Line[] {
  const orders = table(tables, "orders");
  const items = table(tables, "order_items");
  const products = table(tables, "products");
  const customers = table(tables, "customers");
  const categoryOf = new Map(products.rows.map((r) => [r[0] as number, String(r[col(products, "category")])]));
  const cityOf = new Map(customers.rows.map((r) => [r[0] as number, tidy(r[col(customers, "city")]).replace(/\b[a-z]/g, (m) => m.toUpperCase())]));
  const order = new Map(orders.rows.filter((r) => r[col(orders, "status")] === "delivered").map((r) => [r[0] as number, r]));
  const out: Line[] = [];
  for (const r of items.rows) {
    const o = order.get(r[col(items, "order_id")] as number);
    if (!o) continue;
    const customerId = o[col(orders, "customer_id")] as number;
    out.push({ orderId: o[0] as number, customerId, date: String(o[col(orders, "order_date")]), channel: String(o[col(orders, "channel")]), category: categoryOf.get(r[col(items, "product_id")] as number) ?? "", city: cityOf.get(customerId) ?? "", revenue: (r[col(items, "quantity")] as number) * (r[col(items, "unit_price")] as number) });
  }
  return out;
}
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

const seedOf = (rng: Rng) => rng.int(1, 2_000_000_000);
const field = (key: string, label: string, value: number, tolerance: number, help?: string): NumberField => ({ key, label, value, tolerance, ...(help ? { help } : {}) });

export const ANALYST_PYTHON_TEMPLATES: MlTemplate[] = [
  {
    id: "py-count-orders", title: "How many orders, and how many were cancelled?", areas: ["python"], difficulty: "easy", minLevel: "fresher",
    build: persist((rng) => {
      const tables = generateBrightCart(seedOf(rng));
      const orders = table(tables, "orders");
      const s = col(orders, "status");
      const total = orders.rows.length;
      const cancelled = orders.rows.filter((r) => r[s] === "cancelled").length;
      return numbersDraft(texts(SALES, "How many orders, and how many were cancelled?", "Hi, I am putting together the weekly ops note and need three numbers from the orders export: how many orders we have in total, how many were cancelled, and the cancellation rate as a percentage."), {
        skillTags: ["Python", "pandas", "Counting"], files: files(tables, ["orders"]), starter: STARTER(["orders"], "Hint: len(df), a boolean filter and .sum() or .mean() are all you need."),
        deliverable: "Report the total number of orders, the number with status 'cancelled', and the cancellation rate as a percentage with 2 decimals.",
        fields: [field("total", "Total orders", total, 0.5), field("cancelled", "Cancelled orders", cancelled, 0.5), field("rate", "Cancellation rate (%)", round((cancelled / total) * 100, 2), 0.011, "2 decimals")],
      });
    }),
  },
  {
    id: "py-delivered-revenue", title: "What did we earn from delivered orders?", areas: ["python"], difficulty: "easy", minLevel: "fresher",
    build: persist((rng) => {
      const tables = generateBrightCart(seedOf(rng));
      const rev = deliveredRevenue(tables);
      const total = [...rev.values()].reduce((s, v) => s + v, 0);
      return numbersDraft(texts(FINANCE, "What did we earn from delivered orders?", "Hello, finance needs the revenue from orders that were actually delivered. Cancelled, returned and still-shipped orders do not count. Revenue is quantity times the unit price charged, summed over the order lines."), {
        skillTags: ["Python", "pandas", "Merge", "Revenue"], files: files(tables, ["orders", "order_items"]), starter: STARTER(["orders", "order_items"], "Hint: add a line_total column, keep delivered orders, then merge or filter on order_id."),
        deliverable: "Report the total delivered revenue in rupees and the number of delivered orders.",
        fields: [field("revenue", "Delivered revenue (₹)", total, 1), field("orders", "Delivered orders", rev.size, 0.5)],
      });
    }),
  },
  {
    id: "py-channel-aov", title: "Average order value by sales channel", areas: ["python"], difficulty: "medium", minLevel: "fresher",
    build: persist((rng) => {
      const tables = generateBrightCart(seedOf(rng));
      const orders = table(tables, "orders");
      const rev = deliveredRevenue(tables);
      const ch = col(orders, "channel");
      const aov = (channel: string) => {
        const ids = orders.rows.filter((r) => r[ch] === channel && rev.has(r[0] as number)).map((r) => r[0] as number);
        return ids.reduce((s, id) => s + rev.get(id)!, 0) / ids.length;
      };
      return numbersDraft(texts(MARKETING, "Average order value by sales channel", "Hi, I am deciding where to spend the next campaign budget. For delivered orders only, what is the average order value on the app and on the web? An order's value is the sum of its lines (quantity times unit price)."), {
        skillTags: ["Python", "pandas", "groupby", "Average order value"], files: files(tables, ["orders", "order_items"]), starter: STARTER(["orders", "order_items"], "Hint: build one row per order first (groupby order_id), then group those orders by channel."),
        deliverable: "Report the average value of a delivered order for the app channel and for the web channel, with 2 decimals.",
        fields: [field("app", "App: average order value (₹)", round(aov("app"), 2), 0.02, "2 decimals"), field("web", "Web: average order value (₹)", round(aov("web"), 2), 0.02, "2 decimals")],
      });
    }),
  },
  {
    id: "py-clean-cities", title: "Orders by city, once the city names are tidy", areas: ["python"], difficulty: "medium", minLevel: "fresher",
    build: persist((rng) => {
      const tables = generateBrightCart(seedOf(rng));
      const customers = table(tables, "customers");
      const orders = table(tables, "orders");
      const city = col(customers, "city");
      const cityOf = new Map(customers.rows.map((r) => [r[0] as number, tidy(r[city])]));
      const distinct = new Set(customers.rows.map((r) => tidy(r[city])));
      const target = [...distinct].sort()[rng.int(0, distinct.size - 1)];
      const count = orders.rows.filter((r) => cityOf.get(r[col(orders, "customer_id")] as number) === target).length;
      const pretty = target.replace(/\b[a-z]/g, (m) => m.toUpperCase());
      return numbersDraft(texts(SALES, "Orders by city, once the city names are tidy", `Hi, the city column in the customers export was typed by hand, so the same city shows up as "pune", "Pune " and "PUNE". Please tidy it (trim spaces, ignore case) and tell me how many different cities we really have, and how many orders came from ${pretty} customers.`), {
        skillTags: ["Python", "pandas", "Data cleaning", "merge"], files: files(tables, ["customers", "orders"]), starter: STARTER(["customers", "orders"], "Hint: customers['city'].str.strip().str.lower() makes the spellings match."),
        deliverable: `Report how many distinct cities there are after tidying, and how many orders (any status) were placed by customers in ${pretty}.`,
        fields: [field("cities", "Distinct cities", distinct.size, 0.5), field("orders", `Orders from ${pretty}`, count, 0.5)],
      });
    }),
  },
  {
    id: "py-monthly-revenue", title: "Which month earned the most?", areas: ["python"], difficulty: "medium", minLevel: "junior",
    build: persist((rng) => {
      const tables = generateBrightCart(seedOf(rng));
      const orders = table(tables, "orders");
      const rev = deliveredRevenue(tables);
      const byMonth = new Map<number, number>();
      for (const r of orders.rows) {
        const v = rev.get(r[0] as number);
        if (v === undefined) continue;
        const m = Number(String(r[col(orders, "order_date")]).slice(5, 7));
        byMonth.set(m, (byMonth.get(m) ?? 0) + v);
      }
      const ranked = [...byMonth.entries()].sort((a, b) => b[1] - a[1]);
      if (ranked.length < 2 || ranked[0][1] === ranked[1][1]) throw new MlRejected("two months tie for the best revenue");
      const month = rng.int(2, 8);
      return numbersDraft(texts(FINANCE, "Which month earned the most?", `Hello, I am preparing the quarterly review. Using delivered orders only, tell me which calendar month (1 to 9) had the highest revenue, how much it earned, and what month ${month} earned.`), {
        skillTags: ["Python", "pandas", "Dates", "Monthly trend"], files: files(tables, ["orders", "order_items"]), starter: STARTER(["orders", "order_items"], "Hint: pd.to_datetime(orders['order_date']).dt.month gives the month number."),
        deliverable: `Report the best month number, its delivered revenue, and the delivered revenue of month ${month}.`,
        fields: [field("best_month", "Best month (1-9)", ranked[0][0], 0.5), field("best_revenue", "Best month revenue (₹)", ranked[0][1], 1), field("other_revenue", `Month ${month} revenue (₹)`, byMonth.get(month) ?? 0, 1)],
      });
    }),
  },
  {
    id: "py-pivot-category-channel", title: "Category by channel: where does each category sell?", areas: ["python"], difficulty: "medium", minLevel: "junior",
    build: persist((rng) => {
      const tables = generateBrightCart(seedOf(rng));
      const lines = deliveredLines(tables);
      const cell = rng.pick(lines);
      const inCategory = lines.filter((l) => l.category === cell.category);
      const rev = sum(inCategory.filter((l) => l.channel === cell.channel).map((l) => l.revenue));
      const share = (rev / sum(inCategory.map((l) => l.revenue))) * 100;
      return numbersDraft(texts(MARKETING, "Category by channel: where does each category sell?", `Hi, I want to see how each category's delivered revenue splits across channels. Please build a pivot of revenue by category (rows) and channel (columns), then tell me the revenue of ${cell.category} through ${cell.channel}, and what percent of all ${cell.category} revenue that is.`), {
        skillTags: ["Python", "pandas", "pivot_table", "merge"], files: files(tables, ["orders", "order_items", "products"]), starter: STARTER(["orders", "order_items", "products"], "Hint: merge the three files, keep delivered orders, add revenue = quantity * unit_price, then pd.pivot_table(..., index='category', columns='channel', values='revenue', aggfunc='sum')."),
        deliverable: `Report the delivered revenue of ${cell.category} through ${cell.channel} in rupees, and its share of ${cell.category}'s delivered revenue as a percentage with 2 decimals.`,
        fields: [field("cell", `${cell.category} via ${cell.channel} (₹)`, rev, 1), field("share", "Share of the category (%)", round(share, 2), 0.011, "2 decimals")],
      });
    }),
  },
  {
    id: "py-repeat-customers", title: "How many customers come back?", areas: ["python"], difficulty: "medium", minLevel: "junior",
    build: persist((rng) => {
      const tables = generateBrightCart(seedOf(rng));
      const perCustomer = new Map<number, Set<number>>();
      for (const l of deliveredLines(tables)) perCustomer.set(l.customerId, (perCustomer.get(l.customerId) ?? new Set()).add(l.orderId));
      const buyers = perCustomer.size;
      const repeat = [...perCustomer.values()].filter((o) => o.size >= 2).length;
      if (repeat === 0) throw new MlRejected("no repeat customers in this draw");
      return numbersDraft(texts(MARKETING, "How many customers come back?", "Hello, retention is the topic of the next marketing review. Using delivered orders only, how many different customers have bought at least once, how many of them ordered two or more times, and what percent is that (the repeat rate)?"), {
        skillTags: ["Python", "pandas", "groupby", "Retention"], files: files(tables, ["orders"]), starter: STARTER(["orders"], "Hint: count distinct delivered orders per customer_id with groupby, then compare to 2."),
        deliverable: "Report the number of customers with at least one delivered order, the number with two or more, and the repeat rate as a percentage with 2 decimals.",
        fields: [field("buyers", "Customers who bought", buyers, 0.5), field("repeat", "Customers who bought 2+ times", repeat, 0.5), field("rate", "Repeat rate (%)", round((repeat / buyers) * 100, 2), 0.011, "2 decimals")],
      });
    }),
  },
  {
    id: "py-mom-growth", title: "Month-on-month growth", areas: ["python"], difficulty: "hard", minLevel: "junior",
    build: persist((rng) => {
      const tables = generateBrightCart(seedOf(rng));
      const byMonth = new Map<number, number>();
      for (const l of deliveredLines(tables)) byMonth.set(Number(l.date.slice(5, 7)), (byMonth.get(Number(l.date.slice(5, 7))) ?? 0) + l.revenue);
      const months = [...byMonth.keys()].sort((a, b) => a - b);
      const growth = months.slice(1).map((m) => ({ m, g: ((byMonth.get(m)! - byMonth.get(m - 1)!) / byMonth.get(m - 1)!) * 100 })).filter((x) => byMonth.has(x.m - 1) && Number.isFinite(x.g));
      if (growth.length < 4) throw new MlRejected("not enough consecutive months");
      const ranked = [...growth].sort((a, b) => b.g - a.g);
      if (Math.abs(ranked[0].g - ranked[1].g) < 0.2) throw new MlRejected("two months almost tie for the best growth");
      const target = rng.pick(growth.slice(1)).m;
      return numbersDraft(texts(FINANCE, "Month-on-month growth", `Hi, for the investor update I need the revenue trend as growth, not just totals. Using delivered orders, work out the revenue of each month, the growth of month ${target} against the month before (as a percentage), and which month had the strongest growth against its previous month.`), {
        skillTags: ["Python", "pandas", "Dates", "pct_change", "Growth"], files: files(tables, ["orders", "order_items"]), starter: STARTER(["orders", "order_items"], "Hint: monthly = revenue grouped by month number, then monthly.pct_change() * 100 gives growth against the previous month."),
        deliverable: `Report month ${target}'s growth against the previous month (percent, 1 decimal), and the month number (1 to 9) with the highest growth.`,
        fields: [field("growth", `Month ${target} growth (%)`, round(growth.find((x) => x.m === target)!.g, 1), 0.11, "1 decimal"), field("best_month", "Month with the strongest growth", ranked[0].m, 0.5)],
      });
    }),
  },
  {
    id: "py-city-ranking", title: "Which city leads, and by how much?", areas: ["python"], difficulty: "hard", minLevel: "mid",
    build: persist((rng) => {
      const tables = generateBrightCart(seedOf(rng));
      const byCity = new Map<string, number>();
      const lines = deliveredLines(tables);
      for (const l of lines) byCity.set(l.city, (byCity.get(l.city) ?? 0) + l.revenue);
      const ranked = [...byCity.entries()].sort((a, b) => b[1] - a[1]);
      if (ranked.length < 3 || ranked[0][1] === ranked[1][1]) throw new MlRejected("a tie for first place");
      const total = sum(ranked.map((r) => r[1]));
      return numbersDraft(texts(SALES, "Which city leads, and by how much?", "Hello, the city column was typed by hand (pune, Pune , PUNE), so tidy it before you total anything. For delivered orders, tell me the revenue of the leading city, its share of all delivered revenue, and how far ahead of the second city it is, in rupees."), {
        skillTags: ["Python", "pandas", "Data cleaning", "merge", "Ranking"], files: files(tables, ["customers", "orders", "order_items"]), starter: STARTER(["customers", "orders", "order_items"], "Hint: clean customers['city'] first (strip, then title), merge orders to customers and to the lines, group revenue by city and sort descending."),
        deliverable: "Report the leading city's delivered revenue in rupees, its share of total delivered revenue as a percentage with 2 decimals, and its lead over the second city in rupees.",
        fields: [field("top", "Leading city revenue (₹)", ranked[0][1], 1), field("share", "Share of total (%)", round((ranked[0][1] / total) * 100, 2), 0.011, "2 decimals"), field("lead", "Lead over the second city (₹)", ranked[0][1] - ranked[1][1], 1)],
      });
    }),
  },
];

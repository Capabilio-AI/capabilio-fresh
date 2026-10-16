import type { Cell, Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { Rng } from "../rng";

type Row = Cell[];
export const tableOf = (tables: Dataset[], name: string): Dataset => {
  const t = tables.find((d) => d.name === name);
  if (!t) throw new Error(`warehouse is missing ${name}`);
  return t;
};
export const colIndex = (t: Dataset, column: string) => {
  const i = t.columns.findIndex((c) => c.name === column);
  if (i === -1) throw new Error(`${t.name} has no ${column}`);
  return i;
};
const titleCase = (s: string) => s.trim().toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** What each category costs the shop to buy, as a share of its price. Real margins differ by category. */
const COST_SHARE: Record<string, number> = { Stationery: 0.55, Home: 0.6, Travel: 0.62, Kitchen: 0.58, Fitness: 0.6 };

export interface Line {
  orderId: number;
  orderDate: string;
  city: string;
  segment: string;
  category: string;
  product: string;
  channel: string;
  status: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

/** Every order line of the warehouse, joined to its order, customer and product, with a clean city and a unit cost. */
export function allLines(tables: Dataset[]): Line[] {
  const customers = tableOf(tables, "customers");
  const products = tableOf(tables, "products");
  const orders = tableOf(tables, "orders");
  const items = tableOf(tables, "order_items");
  const customerCity = new Map(customers.rows.map((r) => [r[colIndex(customers, "customer_id")], titleCase(String(r[colIndex(customers, "city")]))]));
  const customerSegment = new Map(customers.rows.map((r) => [r[colIndex(customers, "customer_id")], String(r[colIndex(customers, "segment")])]));
  const product = new Map(products.rows.map((r) => [r[colIndex(products, "product_id")], r]));
  const order = new Map(orders.rows.map((r) => [r[colIndex(orders, "order_id")], r]));
  const lines: Line[] = [];
  for (const it of items.rows) {
    const o = order.get(it[colIndex(items, "order_id")]);
    const p = product.get(it[colIndex(items, "product_id")]);
    if (!o || !p) continue;
    const category = String(p[colIndex(products, "category")]);
    const price = Number(it[colIndex(items, "unit_price")]);
    lines.push({
      orderId: Number(o[colIndex(orders, "order_id")]),
      orderDate: String(o[colIndex(orders, "order_date")]),
      city: customerCity.get(o[colIndex(orders, "customer_id")]) ?? "Unknown",
      segment: customerSegment.get(o[colIndex(orders, "customer_id")]) ?? "Unknown",
      category,
      product: String(p[colIndex(products, "product_name")]),
      channel: String(o[colIndex(orders, "channel")]),
      status: String(o[colIndex(orders, "status")]),
      quantity: Number(it[colIndex(items, "quantity")]),
      unitPrice: price,
      unitCost: Math.round(price * (COST_SHARE[category] ?? 0.6)),
    });
  }
  return lines;
}

export type LineColumn = keyof Line;
const COLUMN_DEFS: Record<LineColumn, { name: string; type: "number" | "text" | "date"; description?: string }> = {
  orderId: { name: "order_id", type: "number" },
  orderDate: { name: "order_date", type: "date" },
  city: { name: "city", type: "text" },
  segment: { name: "segment", type: "text" },
  category: { name: "category", type: "text" },
  product: { name: "product", type: "text" },
  channel: { name: "channel", type: "text" },
  status: { name: "status", type: "text" },
  quantity: { name: "quantity", type: "number" },
  unitPrice: { name: "unit_price", type: "number", description: "price charged per unit, in ₹" },
  unitCost: { name: "unit_cost", type: "number", description: "what BrightCart paid per unit, in ₹" },
};

export interface LineFilter {
  statuses?: readonly string[];
  /** inclusive start, exclusive end */
  window?: { start: string; end: string };
}

/**
 * A spreadsheet-sized slice of the company's order lines: `n` lines picked at random from the user's own warehouse, shown in order.
 * Only the asked-for columns are included, so the sheet holds what the task needs and nothing else.
 */
export function salesSheet(tables: Dataset[], rng: Rng, n: number, columns: readonly LineColumn[], filter: LineFilter = {}): { data: Dataset; lines: Line[] } {
  const pool = allLines(tables).filter(
    (l) => (!filter.statuses || filter.statuses.includes(l.status)) && (!filter.window || (l.orderDate >= filter.window.start && l.orderDate < filter.window.end))
  );
  const lines = rng.shuffle(pool).slice(0, n).sort((a, b) => a.orderId - b.orderId);
  const rows: Row[] = lines.map((l) => columns.map((c) => l[c]));
  return { data: { name: "sales_lines", columns: columns.map((c) => COLUMN_DEFS[c]), rows }, lines };
}

export const distinct = <T,>(values: readonly T[]): T[] => [...new Set(values)];

// ---- messy exports for cleaning tickets ----

export interface Mess {
  /** share of rows whose city has stray spaces or odd capitals */
  city?: number;
  /** share of rows whose status has odd capitals or spaces */
  status?: number;
  /** a category name misspelled in some rows: [correct, misspelt] */
  categoryTypo?: readonly [string, string];
  /** write amounts as text such as "₹1,250.00" or "Rs. 1250" */
  amountText?: boolean;
  /** write dates as DD/MM/YYYY text, with this many impossible dates (31/02/2026) among them */
  dateText?: { invalid: number };
  /** this share of rows have no customer name */
  missingNames?: number;
  /** this share of rows appear twice */
  duplicates?: number;
}

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** A raw order export, the kind a CRM or a shop admin screen produces: one row per order, with the mess asked for. */
export function messyExport(tables: Dataset[], rng: Rng, rows: number, mess: Mess): Dataset {
  const customers = tableOf(tables, "customers");
  const customerRow = new Map(customers.rows.map((r) => [r[colIndex(customers, "customer_id")], r]));
  const orders = tableOf(tables, "orders");
  const byOrder = new Map<number, Line[]>();
  for (const l of allLines(tables)) byOrder.set(l.orderId, [...(byOrder.get(l.orderId) ?? []), l]);

  const picked = rng.shuffle(orders.rows).slice(0, rows).sort((a, b) => Number(a[colIndex(orders, "order_id")]) - Number(b[colIndex(orders, "order_id")]));
  const pad = (s: string) => rng.pick([s.toLowerCase(), s.toUpperCase(), ` ${s}`, `${s} `, `  ${s}  `]);
  const out: Row[] = picked.map((o) => {
    const id = Number(o[colIndex(orders, "order_id")]);
    const lines = byOrder.get(id) ?? [];
    const c = customerRow.get(o[colIndex(orders, "customer_id")]);
    const biggest = [...lines].sort((a, b) => b.quantity * b.unitPrice - a.quantity * a.unitPrice)[0];
    const amount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const city = String(c?.[colIndex(customers, "city")] ?? "");
    const name = String(c?.[colIndex(customers, "name")] ?? "");
    const category = biggest?.category ?? "";
    const status = String(o[colIndex(orders, "status")]);
    return [
      `BC-${10000 + id}`,
      mess.missingNames && rng.chance(mess.missingNames) ? (rng.chance(0.5) ? "" : null) : name,
      mess.city && rng.chance(mess.city) ? pad(city.trim()) : city,
      mess.dateText ? ddmmyyyy(String(o[colIndex(orders, "order_date")])) : String(o[colIndex(orders, "order_date")]),
      mess.categoryTypo && category === mess.categoryTypo[0] && rng.chance(0.6) ? mess.categoryTypo[1] : category,
      mess.status && rng.chance(mess.status) ? pad(status) : status,
      mess.amountText ? rng.pick([`₹${inr(amount)}`, `Rs. ${amount}`, `₹ ${amount.toLocaleString("en-IN")}`, String(amount)]) : amount,
    ];
  });

  if (mess.dateText) {
    const bad = rng.shuffle(out.map((_, i) => i)).slice(0, mess.dateText.invalid);
    bad.forEach((i, k) => (out[i][3] = ["31/02/2026", "32/05/2026", "30/02/2026", "15/13/2026"][k % 4]));
  }
  if (mess.duplicates) {
    const copies = rng.shuffle(out.map((_, i) => i)).slice(0, Math.max(1, Math.round(out.length * mess.duplicates)));
    for (const i of copies.sort((a, b) => b - a)) out.splice(rng.int(i + 1, out.length), 0, [...out[i]]);
  }
  return {
    name: "order_export",
    columns: [
      { name: "order_ref", type: "text" },
      { name: "customer_name", type: "text" },
      { name: "city", type: "text" },
      { name: "order_date", type: "date" },
      { name: "category", type: "text" },
      { name: "status", type: "text" },
      { name: "amount", type: "number", description: "order total in ₹" },
    ],
    rows: out,
  };
}

// ---- datasets for dashboard and statistics tickets ----

/** A flat reporting table for a dashboard: one row per order line, with its revenue worked out. `n` lines are picked at random from the user's own warehouse. */
export function reportingTable(tables: Dataset[], rng: Rng, n: number, filter: LineFilter = {}): Dataset {
  const pool = allLines(tables).filter((l) => (!filter.statuses || filter.statuses.includes(l.status)) && (!filter.window || (l.orderDate >= filter.window.start && l.orderDate < filter.window.end)));
  const lines = rng.shuffle(pool).slice(0, n).sort((a, b) => a.orderDate.localeCompare(b.orderDate) || a.orderId - b.orderId);
  return {
    name: "sales_report",
    columns: [
      { name: "order_date", type: "date" }, { name: "city", type: "text" }, { name: "category", type: "text" }, { name: "channel", type: "text" }, { name: "segment", type: "text" },
      { name: "status", type: "text" }, { name: "quantity", type: "number" }, { name: "revenue", type: "number", description: "quantity × unit price, in ₹" },
    ],
    rows: lines.map((l) => [l.orderDate, l.city, l.category, l.channel, l.segment, l.status, l.quantity, l.quantity * l.unitPrice]),
  };
}

const DAY = 86_400_000;

/** One row per order with measurements to analyse: its value, size, how long the customer had been signed up, and whether it was returned. */
export function orderStatsTable(tables: Dataset[], rng: Rng, n: number, filter: { statuses?: readonly string[]; channels?: readonly string[] } = {}): Dataset {
  const customers = tableOf(tables, "customers");
  const signup = new Map(customers.rows.map((r) => [r[colIndex(customers, "customer_id")], String(r[colIndex(customers, "signup_date")])]));
  const orders = tableOf(tables, "orders");
  const lines = new Map<number, Line[]>();
  for (const l of allLines(tables)) lines.set(l.orderId, [...(lines.get(l.orderId) ?? []), l]);
  const rows = orders.rows
    .filter((r) => (!filter.statuses || filter.statuses.includes(String(r[colIndex(orders, "status")]))) && (!filter.channels || filter.channels.includes(String(r[colIndex(orders, "channel")]))))
    .map((r) => {
      const id = Number(r[colIndex(orders, "order_id")]);
      const ls = lines.get(id) ?? [];
      const days = Math.round((Date.parse(String(r[colIndex(orders, "order_date")])) - Date.parse(signup.get(r[colIndex(orders, "customer_id")]) ?? "")) / DAY);
      return { id, channel: String(r[colIndex(orders, "channel")]), segment: ls[0]?.segment ?? "", value: ls.reduce((s, l) => s + l.quantity * l.unitPrice, 0), items: ls.length, days, returned: String(r[colIndex(orders, "status")]) === "returned" ? 1 : 0 };
    })
    .filter((o) => o.items > 0 && Number.isFinite(o.days) && o.days >= 0);
  const picked = rng.shuffle(rows).slice(0, n).sort((a, b) => a.id - b.id);
  return {
    name: "order_stats",
    columns: [
      { name: "order_id", type: "number" }, { name: "channel", type: "text" }, { name: "segment", type: "text" },
      { name: "order_value", type: "number", description: "total of the order, in ₹" }, { name: "items", type: "number", description: "number of lines on the order" },
      { name: "days_since_signup", type: "number", description: "days between the customer signing up and ordering" }, { name: "returned", type: "number", description: "1 if the order was returned, otherwise 0" },
    ],
    rows: picked.map((o) => [o.id, o.channel, o.segment, o.value, o.items, o.days, o.returned]),
  };
}

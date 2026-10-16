import type { Cell, Dataset } from "@/lib/arena-workstations/engines/dataset";
import { colIndex, tableOf } from "../office/data";
import type { Rng } from "../rng";

/**
 * Faults planted in a user's company data for investigation tickets. Every fault is paired with a detection routine that does what a careful analyst
 * would do on the faulty data; a ticket's answers come from detection, never from what was planted, so an answer is always something the data really shows.
 * Nothing here changes its input: planting returns new tables.
 */

export interface Window {
  start: string;
  end: string;
  label: string;
}

interface Order { id: number; customerId: number; date: string; status: string; channel: string }
interface Item { id: number; orderId: number; productId: number; quantity: number; unitPrice: number }
interface View {
  orders: Order[];
  items: Item[];
  city: Map<number, string>;
  segment: Map<number, string>;
  products: Map<number, { name: string; listPrice: number }>;
  revenue: Map<number, number>;
}

const titleCase = (s: string) => s.trim().toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const num = (v: Cell) => Number(v);
const round2 = (n: number) => Math.round(n * 100) / 100;

function view(tables: Dataset[]): View {
  const customers = tableOf(tables, "customers");
  const products = tableOf(tables, "products");
  const orders = tableOf(tables, "orders");
  const items = tableOf(tables, "order_items");
  const o = (name: string) => colIndex(orders, name);
  const it = (name: string) => colIndex(items, name);
  const parsedItems: Item[] = items.rows.map((r) => ({ id: num(r[it("item_id")]), orderId: num(r[it("order_id")]), productId: num(r[it("product_id")]), quantity: num(r[it("quantity")]), unitPrice: num(r[it("unit_price")]) }));
  const revenue = new Map<number, number>();
  for (const i of parsedItems) revenue.set(i.orderId, (revenue.get(i.orderId) ?? 0) + i.quantity * i.unitPrice);
  return {
    orders: orders.rows.map((r) => ({ id: num(r[o("order_id")]), customerId: num(r[o("customer_id")]), date: String(r[o("order_date")]), status: String(r[o("status")]), channel: String(r[o("channel")]) })),
    items: parsedItems,
    city: new Map(customers.rows.map((r) => [num(r[colIndex(customers, "customer_id")]), titleCase(String(r[colIndex(customers, "city")]))])),
    segment: new Map(customers.rows.map((r) => [num(r[colIndex(customers, "customer_id")]), String(r[colIndex(customers, "segment")])])),
    products: new Map(products.rows.map((r) => [num(r[colIndex(products, "product_id")]), { name: String(r[colIndex(products, "product_name")]), listPrice: num(r[colIndex(products, "list_price")]) }])),
    revenue,
  };
}

/** The warehouse with its orders and items replaced; everything else is shared, not copied. */
function withOrders(tables: Dataset[], orders: Order[], items: Item[]): Dataset[] {
  return tables.map((t) => {
    if (t.name === "orders") return { ...t, rows: orders.map((o) => [o.id, o.customerId, o.date, o.status, o.channel]) };
    if (t.name === "order_items") return { ...t, rows: items.map((i) => [i.id, i.orderId, i.productId, i.quantity, i.unitPrice]) };
    return t;
  });
}

const inWindow = (date: string, w: Window) => date >= w.start && date < w.end;

// ---- a slice of the business starts failing ---------------------------------------------------------------------------------------------------

export type Dimension = "channel" | "city" | "segment";
export interface Part { dimension: Dimension; value: string }

const valueOf = (v: View, o: Order, dimension: Dimension): string => (dimension === "channel" ? o.channel : dimension === "city" ? v.city.get(o.customerId) ?? "" : v.segment.get(o.customerId) ?? "");
const matches = (v: View, o: Order, parts: readonly Part[]) => parts.every((p) => valueOf(v, o, p.dimension) === p.value);
const byDimension = (a: Part, b: Part) => a.dimension.localeCompare(b.dimension);

/** how often orders of a slice end up with `status` in the window, and how many orders the slice has */
function sliceStats(v: View, w: Window, status: string, parts: readonly Part[]) {
  const orders = v.orders.filter((o) => inWindow(o.date, w) && matches(v, o, parts));
  const hit = orders.filter((o) => o.status === status);
  return { orders: orders.length, rate: orders.length === 0 ? 0 : hit.length / orders.length, revenue: round2(hit.reduce((s, o) => s + (v.revenue.get(o.id) ?? 0), 0)) };
}

const ALL_DIMENSIONS: Dimension[] = ["channel", "city", "segment"];
const CULPRIT_RATE = 0.7;
const RUNNER_UP_RATE = 0.55;

/** Every slice a person could look at: single values, or pairs of values from two different dimensions. */
function allSlices(v: View, w: Window, dims: readonly Dimension[], combine: boolean): Part[][] {
  const seen = new Map<Dimension, string[]>();
  for (const d of dims) seen.set(d, [...new Set(v.orders.filter((o) => inWindow(o.date, w)).map((o) => valueOf(v, o, d)))].filter(Boolean).sort());
  const singles = dims.flatMap((d) => (seen.get(d) ?? []).map((value): Part[] => [{ dimension: d, value }]));
  if (!combine) return singles;
  const pairs: Part[][] = [];
  for (let i = 0; i < dims.length; i++) for (let j = i + 1; j < dims.length; j++) for (const a of seen.get(dims[i]) ?? []) for (const b of seen.get(dims[j]) ?? []) pairs.push([{ dimension: dims[i], value: a }, { dimension: dims[j], value: b }].sort(byDimension));
  return pairs;
}

export interface SegmentFinding {
  parts: Part[];
  /** revenue of the orders with the failing status in that slice and window */
  impact: number;
}

/**
 * What an analyst would conclude: of all slices, one has almost all of its orders in the failing status while every other slice stays well below.
 * In `combine` mode only pairs of slices are considered, and no single slice may look bad on its own.
 */
export function detectSegmentFault(tables: Dataset[], w: Window, status: string, combine = false, dims: readonly Dimension[] = ALL_DIMENSIONS): SegmentFinding | null {
  const v = view(tables);
  const minOrders = combine ? 5 : 8;
  const ranked = allSlices(v, w, dims, combine)
    .map((parts) => ({ parts, ...sliceStats(v, w, status, parts) }))
    .filter((s) => s.orders >= minOrders)
    .sort((a, b) => b.rate - a.rate);
  const [top, next] = ranked;
  if (!top || top.rate < CULPRIT_RATE) return null;
  if (next && next.rate > RUNNER_UP_RATE && !isSubsliceOf(top.parts, next.parts)) return null;
  if (combine) {
    const bestSingle = allSlices(v, w, dims, false).map((p) => sliceStats(v, w, status, p)).filter((s) => s.orders >= 8).sort((a, b) => b.rate - a.rate)[0];
    if (bestSingle && bestSingle.rate > RUNNER_UP_RATE) return null;
  }
  return { parts: top.parts, impact: top.revenue };
}

/** a slice that adds a condition to another (or the other way round) is the same finding seen at a different level, not a rival */
const isSubsliceOf = (a: readonly Part[], b: readonly Part[]) => a.every((p) => b.some((q) => q.dimension === p.dimension && q.value === p.value)) || b.every((p) => a.some((q) => q.dimension === p.dimension && q.value === p.value));

export interface PlantedSegment extends SegmentFinding { tables: Dataset[] }

/** Marks every delivered order of one slice (or one pair of slices) in the window as `status`, then checks the result is found unambiguously. */
export function plantSegmentFault(tables: Dataset[], rng: Rng, opts: { window: Window; status: string; dimensions: readonly Dimension[]; combine?: boolean }): PlantedSegment | null {
  const v = view(tables);
  const delivered = v.orders.filter((o) => inWindow(o.date, opts.window) && o.status === "delivered");
  const minDelivered = opts.combine ? 5 : 8;
  const candidates = allSlices(v, opts.window, opts.dimensions, !!opts.combine).filter((parts) => delivered.filter((o) => matches(v, o, parts)).length >= minDelivered);
  if (candidates.length === 0) return null;
  // try the candidates in random order until one stands out from every other slice a student could look at
  for (const parts of rng.shuffle(candidates).slice(0, 12)) {
    const orders = v.orders.map((o) => (inWindow(o.date, opts.window) && o.status === "delivered" && matches(v, o, parts) ? { ...o, status: opts.status } : o));
    const planted = withOrders(tables, orders, v.items);
    // the check looks at every dimension a student can slice by, not only the ones used to plant it
    const found = detectSegmentFault(planted, opts.window, opts.status, !!opts.combine);
    if (found) return { ...found, tables: planted };
  }
  return null;
}

// ---- the same day's orders were loaded twice ------------------------------------------------------------------------------------------------------

export interface DuplicateFinding { date: string; overstated: number }

/** Orders that are the same in every respect (customer, day, status, channel and every item) are copies of each other. */
export function detectDuplicateLoad(tables: Dataset[]): DuplicateFinding | null {
  const v = view(tables);
  const itemsOf = new Map<number, string[]>();
  for (const i of v.items) itemsOf.set(i.orderId, [...(itemsOf.get(i.orderId) ?? []), `${i.productId}:${i.quantity}:${i.unitPrice}`]);
  const groups = new Map<string, Order[]>();
  for (const o of v.orders) {
    const key = [o.customerId, o.date, o.status, o.channel, (itemsOf.get(o.id) ?? []).sort().join(",")].join("|");
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  const extras = [...groups.values()].filter((g) => g.length > 1).flatMap((g) => g.slice(1));
  const dates = [...new Set(extras.map((o) => o.date))];
  if (dates.length !== 1) return null;
  return { date: dates[0], overstated: round2(extras.filter((o) => o.status === "delivered").reduce((s, o) => s + (v.revenue.get(o.id) ?? 0), 0)) };
}

export interface PlantedDuplicate extends DuplicateFinding { tables: Dataset[] }

export function plantDuplicateLoad(tables: Dataset[], rng: Rng): PlantedDuplicate | null {
  const v = view(tables);
  const days = new Map<string, Order[]>();
  for (const o of v.orders) if (o.date >= "2026-03-01") days.set(o.date, [...(days.get(o.date) ?? []), o]);
  const candidates = [...days.entries()].filter(([, os]) => os.length >= 3 && os.some((o) => o.status === "delivered"));
  if (candidates.length === 0) return null;
  const [, copied] = rng.pick(candidates);
  let nextOrder = Math.max(...v.orders.map((o) => o.id));
  let nextItem = Math.max(...v.items.map((i) => i.id));
  const orders = [...v.orders];
  const items = [...v.items];
  for (const o of copied) {
    const id = ++nextOrder;
    orders.push({ ...o, id });
    for (const i of v.items.filter((x) => x.orderId === o.id)) items.push({ ...i, id: ++nextItem, orderId: id });
  }
  const planted = withOrders(tables, orders, items);
  const found = detectDuplicateLoad(planted);
  return found ? { ...found, tables: planted } : null;
}

// ---- one product's price is 100 times too high from some day on ------------------------------------------------------------------

export interface PriceFinding { product: string; overstated: number }

/** A line charged at a price other than its product's list price is wrong; the overstatement counts delivered orders only, as the dashboard does. */
export function detectUnitPriceBug(tables: Dataset[]): PriceFinding | null {
  const v = view(tables);
  const status = new Map(v.orders.map((o) => [o.id, o.status]));
  const bad = v.items.filter((i) => i.unitPrice !== v.products.get(i.productId)?.listPrice);
  const products = [...new Set(bad.map((i) => i.productId))];
  if (products.length !== 1) return null;
  const list = v.products.get(products[0])!.listPrice;
  return { product: v.products.get(products[0])!.name, overstated: round2(bad.filter((i) => status.get(i.orderId) === "delivered").reduce((s, i) => s + i.quantity * (i.unitPrice - list), 0)) };
}

export interface PlantedPrice extends PriceFinding { tables: Dataset[] }

export function plantUnitPriceBug(tables: Dataset[], rng: Rng): PlantedPrice | null {
  const v = view(tables);
  const date = new Map(v.orders.map((o) => [o.id, o.date]));
  const lines = new Map<number, Item[]>();
  for (const i of v.items) lines.set(i.productId, [...(lines.get(i.productId) ?? []), i]);
  const candidates = [...lines.entries()].filter(([, ls]) => ls.length >= 6);
  if (candidates.length === 0) return null;
  const [productId, ls] = rng.pick(candidates);
  const since = ls.map((i) => date.get(i.orderId)!).sort()[Math.floor(ls.length / 2)];
  const list = v.products.get(productId)!.listPrice;
  const items = v.items.map((i) => (i.productId === productId && date.get(i.orderId)! >= since ? { ...i, unitPrice: list * 100 } : i));
  const planted = withOrders(tables, v.orders, items);
  const found = detectUnitPriceBug(planted);
  return found && found.overstated > 0 ? { ...found, tables: planted } : null;
}

// ---- orders stop being marked delivered -------------------------------------------------------------------------------------------------------------

export interface StaleFinding { lastDelivered: string; stuckRevenue: number }

const MIN_STUCK_ORDERS = 8;
const MIN_STUCK_SHARE = 0.7;

/** The last day an order was delivered, and the revenue of everything shipped since: only a finding when many orders came after it and most are stuck at "shipped". */
export function detectStaleStatus(tables: Dataset[]): StaleFinding | null {
  const v = view(tables);
  const lastDelivered = v.orders.filter((o) => o.status === "delivered").map((o) => o.date).sort().at(-1);
  if (!lastDelivered) return null;
  const after = v.orders.filter((o) => o.date > lastDelivered);
  const stuck = after.filter((o) => o.status === "shipped");
  if (after.length < MIN_STUCK_ORDERS || stuck.length / after.length < MIN_STUCK_SHARE) return null;
  return { lastDelivered, stuckRevenue: round2(stuck.reduce((s, o) => s + (v.revenue.get(o.id) ?? 0), 0)) };
}

export interface PlantedStale extends StaleFinding { tables: Dataset[] }

export function plantStaleStatus(tables: Dataset[], rng: Rng): PlantedStale | null {
  const v = view(tables);
  const delivered = v.orders.filter((o) => o.status === "delivered").map((o) => o.date).sort();
  const lo = 12;
  const hi = Math.min(40, delivered.length - 1);
  if (hi < lo) return null;
  const since = delivered[delivered.length - rng.int(lo, hi)];
  const orders = v.orders.map((o) => (o.date >= since && o.status === "delivered" ? { ...o, status: "shipped" } : o));
  const planted = withOrders(tables, orders, v.items);
  const found = detectStaleStatus(planted);
  return found ? { ...found, tables: planted } : null;
}

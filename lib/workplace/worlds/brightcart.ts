import type { Cell, Dataset } from "@/lib/arena-workstations/engines/dataset";
import { makeRng, type Rng } from "../rng";

/** BrightCart: a fictional Indian online store. The one warehouse every Data Analyst ticket in a sprint works against. */
export const BRIGHTCART = {
  key: "brightcart",
  name: "BrightCart",
  industry: "Online retail",
  story: "BrightCart sells home, stationery and travel essentials across India. You joined the analytics team this quarter.",
  statuses: ["delivered", "cancelled", "returned", "shipped"],
  channels: ["app", "web", "marketplace"],
  segments: ["Premium", "Regular", "New"],
  categories: ["Stationery", "Home", "Travel", "Kitchen", "Fitness"],
  /** the people who send tickets, with the team they sit in */
  cast: {
    sales: { name: "Priya Nair", title: "Sales Operations Lead" },
    marketing: { name: "Rohan Mehta", title: "Marketing Manager" },
    category: { name: "Ananya Iyer", title: "Category Manager" },
    finance: { name: "Vikram Rao", title: "Finance Controller" },
    success: { name: "Sana Khan", title: "Customer Success Lead" },
    engineering: { name: "Karthik Menon", title: "Engineering Manager" },
    security: { name: "Meera Pillai", title: "Information Security Lead" },
    data: { name: "Arjun Kapoor", title: "Head of Data Platform" },
  },
  /** the first and last day orders can fall on */
  firstDay: "2026-01-01",
  lastDay: "2026-09-30",
} as const;

const FIRST = ["Asha", "Ben", "Chitra", "Dev", "Esha", "Farid", "Gauri", "Harsh", "Isha", "Jay", "Kavya", "Lakshmi", "Manav", "Nisha", "Omar", "Pooja", "Qadir", "Riya", "Sameer", "Tara", "Uday", "Vani", "Wasim", "Yash", "Zoya", "Arjun", "Bhavna", "Chirag", "Divya", "Eshan"];
const LAST = ["Sharma", "Verma", "Reddy", "Nair", "Iyer", "Khan", "Gupta", "Patel", "Singh", "Das", "Menon", "Joshi", "Rao", "Bose", "Kulkarni"];
export const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad"];
const PRODUCTS: readonly (readonly [string, string, number])[] = [
  ["Notebook A5", "Stationery", 120], ["Gel pen set", "Stationery", 180], ["Desk planner", "Stationery", 350], ["Sticky notes", "Stationery", 90],
  ["Desk lamp", "Home", 899], ["Cushion cover", "Home", 450], ["Wall clock", "Home", 650], ["Table runner", "Home", 520],
  ["Cabin backpack", "Travel", 1599], ["Packing cubes", "Travel", 749], ["Neck pillow", "Travel", 599], ["Luggage tag", "Travel", 199],
  ["Steel bottle", "Kitchen", 499], ["Lunch box", "Kitchen", 699], ["Chopping board", "Kitchen", 399], ["Spice rack", "Kitchen", 850],
  ["Yoga mat", "Fitness", 999], ["Resistance bands", "Fitness", 549], ["Skipping rope", "Fitness", 249], ["Foam roller", "Fitness", 1199],
];

const CUSTOMERS = 55;
const ORDERS = 210;

const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (dayOfYear: number): string => {
  const d = new Date(Date.UTC(2026, 0, 1 + dayOfYear));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const DAYS = 273; // 1 Jan to 30 Sep

/** Real exports are messy: stray spaces and inconsistent case in the city column. */
function messyCity(rng: Rng, city: string): string {
  if (!rng.chance(0.14)) return city;
  return rng.pick([city.toLowerCase(), `${city} `, ` ${city}`, city.toUpperCase()]);
}

/** Pure and deterministic: the same seed always rebuilds the same warehouse. */
export function generateBrightCart(seed: number): Dataset[] {
  const rng = makeRng(seed);

  const customers: Cell[][] = [];
  const names = new Set<string>();
  for (let id = 1; id <= CUSTOMERS; id++) {
    let name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    while (names.has(name)) name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    names.add(name);
    customers.push([id, name, messyCity(rng, rng.pick(CITIES)), rng.weighted([["Regular", 6], ["Premium", 2], ["New", 2]]), dateOf(rng.int(0, 150))]);
  }

  const products: Cell[][] = PRODUCTS.map(([name, category, price], i) => [i + 1, name, category, price]);

  const orders: Cell[][] = [];
  const items: Cell[][] = [];
  for (let id = 1; id <= ORDERS; id++) {
    const customerId = rng.int(1, CUSTOMERS);
    const signup = customers[customerId - 1][4] as string;
    // an order never falls before the customer signed up
    let day = rng.int(0, DAYS - 1);
    while (dateOf(day) < signup) day = rng.int(0, DAYS - 1);
    orders.push([id, customerId, dateOf(day), rng.weighted([["delivered", 74], ["cancelled", 10], ["returned", 8], ["shipped", 8]]), rng.weighted([["app", 5], ["web", 3], ["marketplace", 2]])]);
    const lines = rng.int(1, 3);
    const chosen = rng.shuffle(products).slice(0, lines);
    for (const p of chosen) items.push([items.length + 1, id, p[0], rng.int(1, 3), p[3]]);
  }
  // order_items(item_id, order_id, product_id, quantity, unit_price)
  return [
    { name: "customers", columns: [{ name: "customer_id", type: "number" }, { name: "name", type: "text" }, { name: "city", type: "text", description: "free text, entered by hand" }, { name: "segment", type: "text" }, { name: "signup_date", type: "date" }], rows: customers },
    { name: "products", columns: [{ name: "product_id", type: "number" }, { name: "product_name", type: "text" }, { name: "category", type: "text" }, { name: "list_price", type: "number" }], rows: products },
    { name: "orders", columns: [{ name: "order_id", type: "number" }, { name: "customer_id", type: "number" }, { name: "order_date", type: "date" }, { name: "status", type: "text" }, { name: "channel", type: "text" }], rows: orders },
    { name: "order_items", columns: [{ name: "item_id", type: "number" }, { name: "order_id", type: "number" }, { name: "product_id", type: "number" }, { name: "quantity", type: "number" }, { name: "unit_price", type: "number", description: "price charged at the time of the order" }], rows: items },
  ];
}

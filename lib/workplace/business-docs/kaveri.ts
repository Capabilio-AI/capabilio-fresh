import type { Cell, Dataset } from "@/lib/arena-workstations/engines/dataset";
import { makeRng } from "../rng";

/** Kaveri Appliance Care: a fictional Indian after-sales service network. The data every Business Analyst metrics, reporting and SQL ticket works on. */
export const KAVERI = {
  key: "kaveri",
  name: "Kaveri Appliance Care",
  industry: "Appliance repair and servicing",
  cast: {
    ops: { name: "Deepa Raghunathan", title: "Head of Service Operations" },
    finance: { name: "Nikhil Bansal", title: "Finance Business Partner" },
    marketing: { name: "Farah Siddiqui", title: "Growth Marketing Manager" },
    regional: { name: "Suresh Gowda", title: "Regional Manager, South" },
    cx: { name: "Lavanya Krishnan", title: "Customer Experience Lead" },
  },
  categories: ["AC repair", "Washing machine", "Refrigerator", "Water purifier", "Microwave", "Installation"],
  channels: ["search", "social", "email", "referral", "print"],
} as const;

export const BRANCHES: readonly (readonly [number, string, string, string])[] = [
  [1, "Koramangala", "Bengaluru", "South"], [2, "Anna Nagar", "Chennai", "South"], [3, "Gachibowli", "Hyderabad", "South"], [4, "Andheri", "Mumbai", "West"],
  [5, "Kothrud", "Pune", "West"], [6, "Navrangpura", "Ahmedabad", "West"], [7, "Saket", "Delhi", "North"], [8, "Salt Lake", "Kolkata", "East"],
];
export const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const SLA_HOURS: Record<string, number> = { "AC repair": 24, "Washing machine": 48, Refrigerator: 24, "Water purifier": 48, Microwave: 72, Installation: 48 };
const THEMES = ["Summer AC check", "Monsoon care", "Festive install offer", "Purifier filter drive", "Annual service plan"];
const REQUESTS = 200;
const pad = (n: number) => String(n).padStart(2, "0");

/** Pure and deterministic: the same seed always rebuilds the same company data. */
export function generateKaveri(seed: number): Dataset[] {
  const rng = makeRng(seed);
  const branches: Cell[][] = BRANCHES.map((b) => [...b]);

  const kpis: Cell[][] = [];
  for (const [id] of BRANCHES) {
    const base = rng.int(18, 45) * 10000;
    MONTHS.forEach((month, m) => {
      const target = Math.round((base * (1 + 0.02 * m)) / 1000) * 1000;
      const actual = Math.round((target * (0.82 + rng.next() * 0.32)) / 100) * 100;
      const calls = rng.int(120, 400);
      kpis.push([id, month, target, actual, calls, Math.floor(calls * (0.7 + rng.next() * 0.27))]);
    });
  }

  const campaigns: Cell[][] = [];
  for (let id = 1; id <= 30; id++) {
    const channel = KAVERI.channels[(id - 1) % KAVERI.channels.length];
    const month = MONTHS[rng.int(0, MONTHS.length - 1)];
    const spend = channel === "email" ? rng.int(8, 30) * 1000 : rng.int(25, 180) * 1000;
    const leads = rng.int(60, 900);
    const conversions = Math.max(1, Math.floor(leads * (0.04 + rng.next() * 0.18)));
    const revenue = conversions * rng.int(12, 42) * 100;
    campaigns.push([id, `${rng.pick(THEMES)} ${id}`, channel, month, spend, leads, conversions, revenue]);
  }

  const requests: Cell[][] = [];
  for (let id = 1; id <= REQUESTS; id++) {
    const category = rng.pick(KAVERI.categories);
    const status = rng.weighted([["closed", 80], ["open", 8], ["cancelled", 7], ["reopened", 5]] as const);
    const sla = SLA_HOURS[category];
    const done = status === "closed" || status === "reopened";
    const hours = done ? Math.max(1, Math.round(sla * (0.3 + rng.next() * (rng.chance(0.25) ? 1.6 : 0.65)))) : null;
    const day = rng.int(1, 28);
    const opened = `${MONTHS[rng.int(0, MONTHS.length - 1)]}-${pad(day)}`;
    requests.push([id, rng.int(1, BRANCHES.length), opened, category, status, sla, hours, status === "cancelled" ? 0 : rng.int(3, 45) * 100]);
  }

  return [
    { name: "branches", columns: [{ name: "branch_id", type: "number" }, { name: "branch_name", type: "text" }, { name: "city", type: "text" }, { name: "region", type: "text" }], rows: branches },
    {
      name: "monthly_kpis",
      columns: [
        { name: "branch_id", type: "number" }, { name: "month", type: "text", description: "YYYY-MM" }, { name: "target_revenue", type: "number", description: "₹" },
        { name: "actual_revenue", type: "number", description: "₹" }, { name: "service_calls", type: "number" }, { name: "calls_within_sla", type: "number" },
      ],
      rows: kpis,
    },
    {
      name: "campaigns",
      columns: [
        { name: "campaign_id", type: "number" }, { name: "campaign_name", type: "text" }, { name: "channel", type: "text" }, { name: "month", type: "text", description: "YYYY-MM" },
        { name: "spend", type: "number", description: "₹" }, { name: "leads", type: "number" }, { name: "conversions", type: "number" }, { name: "revenue", type: "number", description: "₹ attributed" },
      ],
      rows: campaigns,
    },
    {
      name: "service_requests",
      columns: [
        { name: "request_id", type: "number" }, { name: "branch_id", type: "number" }, { name: "opened_on", type: "date" }, { name: "category", type: "text" }, { name: "status", type: "text" },
        { name: "sla_hours", type: "number" }, { name: "resolution_hours", type: "number", description: "empty while open or cancelled" }, { name: "charge", type: "number", description: "₹" },
      ],
      rows: requests,
    },
  ];
}

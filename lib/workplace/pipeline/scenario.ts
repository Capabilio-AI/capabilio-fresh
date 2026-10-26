import { makeRng } from "../rng";

/**
 * The synthetic source a pipeline ticket reads: a few daily batches of one fictional company's events. Rebuilt from the scenario alone, so the browser
 * preview and the server grade see the same rows. This models what a Spark / Airflow / dbt job meets in practice (late rows, re-sent rows, a new column,
 * a flaky extract, a corrupt export); no real cluster or scheduler is involved.
 */
export type Value = string | number | null;
export type Row = Record<string, Value>;

export interface Dataset {
  company: string;
  source: string;
  target: string;
  key: string;
  eventDate: string;
  customer: string;
  measure: string;
  category: string;
  categories: string[];
  /** the column the upstream starts sending on day 3 when `drift` is on */
  driftColumn: string;
  driftValues: string[];
  firstKey: number;
}

export interface Scenario {
  seed: number;
  dataset: Dataset;
  /** day 2 brings rows for day 1 that arrive after day 1's load ran */
  late: boolean;
  /** day 2 re-sends changed versions of day-1 rows, and one row twice */
  updates: boolean;
  /** day 3 rows carry a new column */
  drift: boolean;
  /** how many times day 3's extract fails before it works (0 = never) */
  flaky: number;
  /** a final day whose export is corrupt: missing keys and negative amounts */
  bad: boolean;
}

export interface Batch {
  day: number;
  date: string;
  rows: Row[];
  bad: boolean;
}
export interface Source {
  batches: Batch[];
  columns: string[];
  lateKeys: number[];
  driftKeys: number[];
}

export const UPDATED_AT = "updated_at";
export const INGESTED_AT = "ingested_at";
export const FLAKY_DAY = 3;
const ROWS_PER_DAY = 8;
const BASE_DAYS = 3;

export const dayDate = (day: number) => `2026-03-${String(day).padStart(2, "0")}`;
const at = (day: number, hh: number, mm = 0) => `${dayDate(day)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`;

export function baseColumns(d: Dataset): string[] {
  return [d.key, d.eventDate, d.customer, d.category, d.measure, UPDATED_AT, INGESTED_AT];
}

/** Deterministic batches for this scenario. */
export function buildSource(s: Scenario): Source {
  const d = s.dataset;
  const rng = makeRng(s.seed);
  let next = d.firstKey;
  const row = (day: number, hh: number, mm: number, ingestDay = day, ingestHh = hh, eventDay = day): Row => ({
    [d.key]: next++,
    [d.eventDate]: dayDate(eventDay),
    [d.customer]: `C${rng.int(100, 140)}`,
    [d.category]: rng.pick(d.categories),
    [d.measure]: rng.int(20, 500) * 10,
    [UPDATED_AT]: at(day, hh, mm),
    [INGESTED_AT]: at(ingestDay, ingestHh, mm + 5),
  });
  // a day's normal rows are spread from 08:00 to 22:00
  const normalDay = (day: number) => Array.from({ length: ROWS_PER_DAY }, (_, i) => row(day, 8 + i * 2, 0));

  const batches: Batch[] = [];
  const lateKeys: number[] = [];
  const driftKeys: number[] = [];
  for (let day = 1; day <= BASE_DAYS; day++) {
    let rows = normalDay(day);
    if (day === 2 && s.late) {
      // happened on day 1 (before day 1's last row), but landed after midnight
      const late = [row(1, 12, 30, 2, 1, 1), row(1, 18, 30, 2, 1, 1)];
      lateKeys.push(...late.map((r) => r[d.key] as number));
      rows = [...late, ...rows];
    }
    if (day === 2 && s.updates) {
      const first = batches[0].rows;
      const changed = [first[1], first[4]].map((r) => ({ ...r, [d.measure]: (r[d.measure] as number) + 150, [UPDATED_AT]: at(2, 9, 30), [INGESTED_AT]: at(2, 9, 35) }));
      rows = [...rows, ...changed, { ...rows[rows.length - 1] }];
    }
    if (day === 3 && s.drift) {
      rows = rows.map((r, i) => ({ ...r, [d.driftColumn]: i % 3 === 0 ? null : rng.pick(d.driftValues) }));
      driftKeys.push(...rows.map((r) => r[d.key] as number));
    }
    batches.push({ day, date: dayDate(day), rows, bad: false });
  }
  if (s.bad) {
    const day = BASE_DAYS + 1;
    const rows = Array.from({ length: 6 }, (_, i) => {
      const r = row(day, 8 + i * 2, 0);
      return i % 2 === 0 ? { ...r, [d.key]: null } : { ...r, [d.measure]: -(r[d.measure] as number) };
    });
    batches.push({ day, date: dayDate(day), rows, bad: true });
  }
  return { batches, columns: [...baseColumns(d), ...(s.drift ? [d.driftColumn] : [])], lateKeys, driftKeys };
}

/** What each day brings, said plainly for the ticket. */
export function describeDays(s: Scenario): string[] {
  const d = s.dataset;
  const lines = [`Day 1 (${dayDate(1)}): ${ROWS_PER_DAY} new rows land in ${d.source}.`];
  const day2 = [`${ROWS_PER_DAY} new rows`];
  if (s.late) day2.push("2 rows that happened on day 1 but only arrive after day 1's run");
  if (s.updates) day2.push(`changed versions of 2 day-1 rows (same ${d.key}, newer ${UPDATED_AT})`, "one row sent twice");
  lines.push(`Day 2 (${dayDate(2)}): ${day2.join("; ")}.`);
  const day3 = [`${ROWS_PER_DAY} new rows`];
  if (s.drift) day3.push(`a new column \`${d.driftColumn}\` appears`);
  if (s.flaky) day3.push(`the extract fails ${s.flaky === 1 ? "once" : `${s.flaky} times`} before the source answers`);
  lines.push(`Day 3 (${dayDate(3)}): ${day3.join("; ")}.`);
  if (s.bad) lines.push(`Day 4 (${dayDate(4)}): the upstream export is corrupt: some rows have no ${d.key}, others have negative ${d.measure}.`);
  return lines;
}

export const ORDERS: Dataset = {
  company: "Koyal Mart", source: "raw_orders", target: "fact_orders", key: "order_id", eventDate: "order_date", customer: "customer_id", measure: "amount_inr",
  category: "city", categories: ["Pune", "Indore", "Kochi", "Nagpur"], driftColumn: "coupon_code", driftValues: ["SAVE10", "FEST50", "NEW20"], firstKey: 1001,
};
export const RIDES: Dataset = {
  company: "Saarthi Cabs", source: "raw_rides", target: "fact_rides", key: "ride_id", eventDate: "ride_date", customer: "rider_id", measure: "fare_inr",
  category: "zone", categories: ["North", "South", "East", "West", "Central"], driftColumn: "surge_band", driftValues: ["none", "low", "high"], firstKey: 50001,
};
export const PAYMENTS: Dataset = {
  company: "Neelgiri Payments", source: "raw_payments", target: "fact_payments", key: "payment_id", eventDate: "payment_date", customer: "merchant_id", measure: "amount_inr",
  category: "method", categories: ["UPI", "card", "netbanking", "wallet"], driftColumn: "device_type", driftValues: ["android", "ios", "web"], firstKey: 700001,
};

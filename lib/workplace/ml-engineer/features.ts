import type { Rng } from "../rng";
import { MAX_SUBMISSIONS, MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";

// Feature engineering, as numbers the notebook can produce: per-customer ratios, grouping rare categories, date features and target encoding.
// Every answer is computed here from the generated rows, so the method (not a lucky model) is what is checked.

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const CUSTOMERS = 120;

/** Ratios per customer: spend per active month and tickets per active month, compared between customers who left and who stayed. */
export function buildRatioFeatures(rng: Rng, texts: Texts): MlDraft {
  const rows = Array.from({ length: CUSTOMERS }, (_, i) => {
    const churned = rng.chance(0.35) ? 1 : 0;
    const months = rng.int(2, 48);
    const tickets = Math.round(months * (churned ? 0.25 + rng.next() * 0.35 : 0.04 + rng.next() * 0.2));
    const spend = Math.round(months * (250 + rng.next() * 500));
    return { id: 7001 + i, months, spend, tickets, churned };
  });
  const gone = rows.filter((r) => r.churned);
  const stayed = rows.filter((r) => !r.churned);
  if (gone.length < 15 || stayed.length < 15) throw new MlRejected("too few customers in one class");
  const tpm = (r: (typeof rows)[number]) => r.tickets / r.months;
  const tpmGone = mean(gone.map(tpm));
  const tpmStayed = mean(stayed.map(tpm));
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Feature engineering", "Ratios", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "customers.csv", text: csv(["customer_id", "months_active", "total_spend", "support_tickets", "churned"], rows.map((r) => [r.id, r.months, r.spend, r.tickets, r.churned])) }],
      starter: `import pandas as pd

c = pd.read_csv("customers.csv")
# total_spend and support_tickets grow with how long someone has been a customer,
# so compare customers per active month instead of in total
`,
      fields: [
        { key: "spm_mean", label: "Average spend per active month (all customers)", help: "Compute total_spend / months_active for each customer, then average those ratios. Two decimals." },
        { key: "tpm_churned", label: "Average tickets per active month, customers who left", help: "Average of the per-customer ratio. Three decimals." },
        { key: "tpm_retained", label: "Average tickets per active month, customers who stayed", help: "Three decimals." },
        { key: "tpm_ratio", label: "How many times higher the churned average is", help: "tpm_churned divided by tpm_retained. Two decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Build the two per-month features and report the four numbers.",
    },
    key: { kind: "numbers", expected: { spm_mean: round(mean(rows.map((r) => r.spend / r.months)), 2), tpm_churned: round(tpmGone, 3), tpm_retained: round(tpmStayed, 3), tpm_ratio: round(tpmGone / tpmStayed, 2) }, tolerance: { spm_mean: 0.01, tpm_churned: 0.0015, tpm_retained: 0.0015, tpm_ratio: 0.01 } },
  };
}

const CITIES = ["Pune", "Bengaluru", "Hyderabad", "Chennai", "Kochi", "Indore", "Nagpur", "Surat", "Jaipur", "Lucknow", "Patna", "Bhopal", "Ranchi", "Guwahati", "Mysuru", "Raipur"];
const MIN_ROWS = 8;

/** A long-tailed category: group the rare ones into one bucket and count the one-hot columns that would result. */
export function buildRareCategories(rng: Rng, texts: Texts): MlDraft {
  const cities = rng.shuffle(CITIES).slice(0, rng.int(10, 14));
  const counts = cities.map((_, i) => (i < 4 ? rng.int(25, 60) : rng.int(1, 14)));
  const rows = rng.shuffle(cities.flatMap((c, i) => Array<string>(counts[i]).fill(c)));
  const kept = counts.filter((n) => n >= MIN_ROWS).length;
  const other = counts.filter((n) => n < MIN_ROWS).reduce((s, n) => s + n, 0);
  if (other === 0 || kept === cities.length) throw new MlRejected("no rare categories");
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Feature engineering", "Categorical encoding", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "customers.csv", text: csv(["customer_id", "city"], rows.map((c, i) => [8001 + i, c])) }],
      starter: `import pandas as pd

c = pd.read_csv("customers.csv")
MIN_ROWS = ${MIN_ROWS}   # a city with fewer rows than this is too rare to learn from: group it into "other"
`,
      fields: [
        { key: "raw_cities", label: "Distinct cities in the file" },
        { key: "kept_cities", label: "Cities with at least MIN_ROWS customers", help: "These keep their own category." },
        { key: "other_rows", label: "Customers that end up in the 'other' group" },
        { key: "onehot_columns", label: "One-hot columns after grouping", help: "One column for each kept city plus one for 'other'. Do not drop any column." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Group the rare cities and report the four numbers.",
    },
    key: { kind: "numbers", expected: { raw_cities: cities.length, kept_cities: kept, other_rows: other, onehot_columns: kept + 1 }, tolerance: { raw_cities: 0, kept_cities: 0, other_rows: 0, onehot_columns: 0 } },
  };
}

const DAY_MS = 86_400_000;
const SNAPSHOT = Date.UTC(2026, 5, 30);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Date features from order timestamps: weekend and night share, and how long each customer has been silent at the snapshot date. */
export function buildDateFeatures(rng: Rng, texts: Texts): MlDraft {
  const customers = 40;
  const orders: { customer: number; at: number }[] = [];
  for (let c = 0; c < customers; c++) {
    const last = SNAPSHOT - rng.int(1, 160) * DAY_MS;
    const n = rng.int(2, 9);
    for (let k = 0; k < n; k++) {
      const at = k === 0 ? last : last - rng.int(1, 200) * DAY_MS;
      orders.push({ customer: 9001 + c, at: at + rng.int(0, 86_399) * 1000 });
    }
  }
  const weekend = orders.filter((o) => [0, 6].includes(new Date(o.at).getUTCDay())).length / orders.length;
  const night = orders.filter((o) => { const h = new Date(o.at).getUTCHours(); return h >= 22 || h < 6; }).length / orders.length;
  const silent = new Map<number, number>();
  for (const o of orders) silent.set(o.customer, Math.max(silent.get(o.customer) ?? -Infinity, o.at));
  const days = [...silent.values()].map((last) => Math.floor((SNAPSHOT - last) / DAY_MS));
  const over90 = days.filter((d) => d > 90).length;
  if (over90 < 3 || over90 > customers - 3) throw new MlRejected("not enough spread in recency");
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Feature engineering", "Date and time features", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "orders.csv", text: csv(["customer_id", "order_ts"], orders.map((o) => [o.customer, iso(o.at)])) }],
      starter: `import pandas as pd

orders = pd.read_csv("orders.csv", parse_dates=["order_ts"])   # all times are UTC
SNAPSHOT = pd.Timestamp("2026-06-30")   # the day the features are built: midnight at the start of it
`,
      fields: [
        { key: "weekend_share", label: "Share of orders placed on a Saturday or Sunday", help: "Three decimals." },
        { key: "night_share", label: "Share of orders placed from 22:00 up to 05:59", help: "Three decimals." },
        { key: "median_days_silent", label: "Median days since each customer's last order", help: "Whole days between the last order and SNAPSHOT (round down), then the median over customers. One decimal." },
        { key: "silent_over_90", label: "Customers silent for more than 90 days", help: "Using the same whole-day count." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Build the date features and report the four numbers.",
    },
    key: { kind: "numbers", expected: { weekend_share: round(weekend, 3), night_share: round(night, 3), median_days_silent: round(median(days), 1), silent_over_90: over90 }, tolerance: { weekend_share: 0.002, night_share: 0.002, median_days_silent: 0.05, silent_over_90: 0 } },
  };
}

/** Target encoding: the plain version leaks the label for rare categories; leave-one-out removes the row's own label. */
export function buildTargetEncoding(rng: Rng, texts: Texts): MlDraft {
  const groups = rng.shuffle(CITIES).slice(0, 8);
  const rows: { id: number; city: string; y: number }[] = [];
  groups.forEach((city, g) => {
    const n = g < 3 ? rng.int(14, 30) : g < 6 ? rng.int(3, 8) : 1;
    const p = 0.15 + rng.next() * 0.55;
    for (let i = 0; i < n; i++) rows.push({ id: 0, city, y: rng.chance(p) ? 1 : 0 });
  });
  const shuffled = rng.shuffle(rows).map((r, i) => ({ ...r, id: 6001 + i }));
  const by = new Map<string, number[]>();
  for (const r of shuffled) by.set(r.city, [...(by.get(r.city) ?? []), r.y]);
  const singles = [...by.values()].filter((ys) => ys.length === 1).length;
  const big = [...by.entries()].filter(([, ys]) => ys.length >= 14 && ys.some((y) => y === 1) && ys.some((y) => y === 0));
  if (!big.length || singles === 0) throw new MlRejected("no suitable categories");
  const [city, ys] = big[0];
  const target = shuffled.find((r) => r.city === city)!;
  const naive = mean(ys);
  const loo = (ys.reduce((s, y) => s + y, 0) - target.y) / (ys.length - 1);
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Feature engineering", "Target encoding", "Data leakage"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "train.csv", text: csv(["customer_id", "city", "churned"], shuffled.map((r) => [r.id, r.city, r.y])) }],
      starter: `import pandas as pd

train = pd.read_csv("train.csv")
ROW_ID = ${target.id}   # the customer whose encoded value you report below
`,
      fields: [
        { key: "city_mean", label: `Plain target encoding of ${city}`, help: `The mean of churned over every training row of ${city}. Three decimals.` },
        { key: "loo_row", label: "Leave-one-out encoding for the customer ROW_ID", help: "The mean of churned over the other rows of that customer's city, leaving the customer's own row out. Three decimals." },
        { key: "single_cities", label: "Cities with exactly one training row", help: "For these the plain encoding is the row's own label." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Compute the two encodings and the number of cities where the plain one leaks the label.",
    },
    key: { kind: "numbers", expected: { city_mean: round(naive, 3), loo_row: round(loo, 3), single_cities: singles }, tolerance: { city_mean: 0.0015, loo_row: 0.0015, single_cities: 0 } },
  };
}

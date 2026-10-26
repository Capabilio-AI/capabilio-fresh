import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import { BRIGHTCART } from "../worlds/brightcart";
import { allLines, colIndex, orderStatsTable, tableOf } from "../office/data";
import type { StatsDraft, StatsTemplate } from "../office/types";
import { detectSegmentFault, plantSegmentFault, type Window } from "../investigate/faults";
import type { InvestigationDraft, InvestigationTemplate } from "../investigate/types";
import { round } from "./numbers";

/**
 * The Data Scientist's tickets on the company's own warehouse (BrightCart): exploratory statistics (statistics_workspace) and data storytelling
 * (investigation_workspace). Every answer is worked out from the user's data; the stories reuse the investigation fault planting and detection.
 */

const { cast } = BRIGHTCART;
const DELIVERED = { statuses: ["delivered"] } as const;
const EDA = ["exploratory-analysis"];
const STORY = ["data-storytelling"];

type StatsSpec = Pick<StatsTemplate, "id" | "difficulty" | "minLevel">;
const stats = (s: StatsSpec, draft: Omit<StatsDraft, "templateId" | "difficulty" | "minLevel">): StatsDraft => ({ templateId: s.id, difficulty: s.difficulty, minLevel: s.minLevel, ...draft });
const S: Record<string, StatsSpec> = {
  signup: { id: "ds-eda-signup-gap", difficulty: "easy", minLevel: "fresher" },
  spread: { id: "ds-eda-spread", difficulty: "easy", minLevel: "fresher" },
  relation: { id: "ds-eda-relationship", difficulty: "medium", minLevel: "fresher" },
};

export const DS_STATS_TEMPLATES: StatsTemplate[] = [
  {
    ...S.signup, areas: EDA,
    build: (rng, tables) => stats(S.signup, {
      title: "How long do new customers take to place an order?", requester: cast.marketing, skillTags: ["Exploratory analysis", "Distributions", "Mean vs median"],
      scenario: "Hi, before we design a welcome-offer experiment I want to understand the gap between signing up and ordering. Look at this sample of delivered orders and give me the mean and the median days since signup, so we can see whether a few slow customers drag the average.",
      dataset: orderStatsTable(tables, rng, 60, DELIVERED),
      questions: [{ id: "q1", statistic: "mean", column: "days_since_signup" }, { id: "q2", statistic: "median", column: "days_since_signup" }],
    }),
  },
  {
    ...S.spread, areas: EDA,
    build: (rng, tables) => stats(S.spread, {
      title: "Profile the basket before we model it", requester: cast.data, skillTags: ["Exploratory analysis", "Spread", "Summary statistics"],
      scenario: "Hello, we are about to model basket value. First I need a quick profile: how much order values vary (sample standard deviation) and how many lines a typical order has (mean items). Use this sample of delivered orders.",
      dataset: orderStatsTable(tables, rng, 70, DELIVERED),
      questions: [{ id: "q1", statistic: "sample_std", column: "order_value" }, { id: "q2", statistic: "mean", column: "items" }],
    }),
  },
  {
    ...S.relation, areas: EDA,
    build: (rng, tables) => stats(S.relation, {
      title: "Do loyal customers spend more, and how sure are we of the average?", requester: cast.finance, skillTags: ["Exploratory analysis", "Correlation", "Confidence interval"],
      scenario: "Hi, someone claims customers who have been with us longer spend more per order. Check how strongly days since signup and order value move together, and give me a 95% range for the mean order value from this sample.",
      dataset: orderStatsTable(tables, rng, 90, DELIVERED),
      questions: [{ id: "q1", statistic: "pearson_r", x_column: "days_since_signup", y_column: "order_value" }, { id: "q2", statistic: "ci95_mean", column: "order_value" }],
    }),
  },
];

// ---- data storytelling ------------------------------------------------------------------------------------------------------------------------

const quarter = (q: number): Window => ({ label: `Q${q} 2026`, start: `2026-0${(q - 1) * 3 + 1}-01`, end: q === 3 ? "2026-10-01" : `2026-0${q * 3 + 1}-01` });
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September"];
const DIMENSION_LABEL = { channel: "channel", city: "city", segment: "customer segment" } as const;

/** delivered revenue per key, from order lines */
function deliveredRevenue(tables: Dataset[], keyOf: (l: ReturnType<typeof allLines>[number]) => string | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of allLines(tables)) {
    const k = l.status === "delivered" ? keyOf(l) : null;
    if (k) out.set(k, (out.get(k) ?? 0) + l.quantity * l.unitPrice);
  }
  return out;
}

export const DS_STORY_TEMPLATES: InvestigationTemplate[] = [
  {
    id: "ds-story-channel-share", difficulty: "easy", minLevel: "fresher", areas: STORY,
    build(rng, tables) {
      const w = quarter(rng.int(1, 3));
      const byChannel = [...deliveredRevenue(tables, (l) => (l.orderDate >= w.start && l.orderDate < w.end ? l.channel : null)).entries()].sort((a, b) => b[1] - a[1]);
      if (byChannel.length < 2 || byChannel[1][1] > byChannel[0][1] * 0.98) return null;
      const total = byChannel.reduce((s, [, v]) => s + v, 0);
      const [channel, revenue] = byChannel[0];
      return {
        templateId: "ds-story-channel-share", mode: "detective", difficulty: "easy", minLevel: "fresher", skillTags: ["Data storytelling", "SQL", "Revenue analysis"],
        title: `The ${w.label} headline: which channel carried delivered revenue?`, requester: cast.sales,
        scenario: `Hi, I open the ${w.label} review with one slide: the channel that brought in the most delivered revenue, how much it brought, and what share of the quarter's delivered revenue that is. Please get me those three facts from the data so the headline is right.`,
        tables,
        fields: [
          { key: "channel", label: "Which channel brought in the most delivered revenue?", type: "choice", options: byChannel.map(([c]) => c).sort() },
          { key: "revenue", label: `Its delivered revenue in ${w.label}`, type: "number", unit: "₹" },
          { key: "share", label: "Its share of all delivered revenue that quarter", help: "In percent, one decimal, e.g. 47.3.", type: "number", unit: "%" },
        ],
        answers: { channel, revenue: round(revenue, 2), share: round((revenue / total) * 100, 1) }, tolerance: { revenue: 1, share: 0.1 },
      } satisfies InvestigationDraft;
    },
  },
  {
    id: "ds-story-best-month", difficulty: "easy", minLevel: "fresher", areas: STORY,
    build(_rng, tables) {
      const byMonth = deliveredRevenue(tables, (l) => l.orderDate.slice(0, 7));
      const months = MONTHS.map((_, i) => byMonth.get(`2026-0${i + 1}`) ?? 0);
      const ranked = months.map((v, i) => ({ v, i })).filter((m) => m.i > 0).sort((a, b) => b.v - a.v);
      const [top, next] = ranked;
      if (!top || top.v === 0 || next.v > top.v * 0.99 || months[top.i - 1] === 0) return null;
      const growth = ((top.v - months[top.i - 1]) / months[top.i - 1]) * 100;
      if (growth <= 0) return null;
      return {
        templateId: "ds-story-best-month", mode: "detective", difficulty: "easy", minLevel: "fresher", skillTags: ["Data storytelling", "SQL", "Trends"],
        title: "Tell the story of our best month this year", requester: cast.marketing,
        scenario: "Hello, for the newsletter I want one honest line about our best month of 2026 so far (February to September, since January has no month before it to compare with): which month had the most delivered revenue, how much, and how much it grew on the month before.",
        tables,
        fields: [
          { key: "month", label: "Which month (February to September) had the most delivered revenue?", type: "choice", options: MONTHS.slice(1) },
          { key: "revenue", label: "Delivered revenue that month", type: "number", unit: "₹" },
          { key: "growth", label: "Growth on the month before", help: "In percent, one decimal, e.g. 12.5.", type: "number", unit: "%" },
        ],
        answers: { month: MONTHS[top.i], revenue: round(top.v, 2), growth: round(growth, 1) }, tolerance: { revenue: 1, growth: 0.1 },
      } satisfies InvestigationDraft;
    },
  },
  {
    id: "ds-story-returns-driver", difficulty: "medium", minLevel: "junior", areas: STORY,
    build(rng, tables) {
      const w = quarter(rng.int(1, 3));
      const planted = plantSegmentFault(tables, rng, { window: w, status: "returned", dimensions: ["channel", "city", "segment"] });
      if (!planted) return null;
      const found = detectSegmentFault(planted.tables, w, "returned")!;
      const [part] = found.parts;
      const orders = tableOf(planted.tables, "orders");
      const inWindow = orders.rows.filter((r) => String(r[colIndex(orders, "order_date")]) >= w.start && String(r[colIndex(orders, "order_date")]) < w.end);
      const rate = (inWindow.filter((r) => r[colIndex(orders, "status")] === "returned").length / inWindow.length) * 100;
      return {
        templateId: "ds-story-returns-driver", mode: "detective", difficulty: "medium", minLevel: "junior", skillTags: ["Data storytelling", "SQL", "Segmentation", "Root cause"],
        title: `Explain the ${w.label} returns to the board in three numbers`, requester: cast.finance,
        scenario: `Hi, the board asked why returns were high in ${w.label}. I need a short, evidence-backed story: how big the problem was overall, where it came from, and how much revenue it represents. Please find those in the data.`,
        tables: planted.tables,
        fields: [
          { key: "rate", label: `Share of all ${w.label} orders that were returned`, help: "In percent, one decimal.", type: "number", unit: "%" },
          { key: "dimension", label: "Which way of splitting the business shows where returns come from?", type: "choice", options: Object.values(DIMENSION_LABEL) },
          { key: "value", label: "Which one is it?", type: "text", placeholder: "the name of the channel, city or segment" },
          { key: "impact", label: `Revenue in that group's returned orders in ${w.label}`, type: "number", unit: "₹" },
        ],
        answers: { rate: round(rate, 1), dimension: DIMENSION_LABEL[part.dimension], value: part.value, impact: found.impact }, tolerance: { rate: 0.1, impact: 1 },
      } satisfies InvestigationDraft;
    },
  },
];

import type { BiSpec } from "@/lib/arena-workstations/engines/bi";
import { BRIGHTCART } from "../worlds/brightcart";
import { reportingTable } from "./data";
import type { DashboardDraft, DashboardTemplate } from "./types";

const { cast } = BRIGHTCART;
const AREAS = ["dashboard"];
const pad = (n: number) => String(n).padStart(2, "0");
const quarter = (q: number) => ({ label: `Q${q} 2026`, start: `2026-${pad((q - 1) * 3 + 1)}-01`, end: q === 3 ? "2026-10-01" : `2026-${pad(q * 3 + 1)}-01` });

type Spec = Pick<DashboardTemplate, "id" | "difficulty" | "minLevel">;
const D: Record<string, Spec> = {
  category: { id: "dash-category-revenue", difficulty: "easy", minLevel: "fresher" },
  trend: { id: "dash-monthly-trend", difficulty: "easy", minLevel: "fresher" },
  channel: { id: "dash-channel-share", difficulty: "medium", minLevel: "fresher" },
  share: { id: "dash-category-share", difficulty: "easy", minLevel: "fresher" },
  running: { id: "dash-running-revenue", difficulty: "medium", minLevel: "fresher" },
  price: { id: "dash-price-per-unit", difficulty: "medium", minLevel: "junior" },
  qshare: { id: "dash-quarter-channel-share", difficulty: "medium", minLevel: "junior" },
  cities: { id: "dash-top-cities", difficulty: "medium", minLevel: "junior" },
  returns: { id: "dash-return-hotspots", difficulty: "medium", minLevel: "junior" },
  segment: { id: "dash-segment-average", difficulty: "hard", minLevel: "mid" },
  quarter: { id: "dash-quarter-leaders", difficulty: "hard", minLevel: "mid" },
};

const spec = (s: Partial<BiSpec> & Pick<BiSpec, "chart_type" | "dimension" | "aggregation" | "measure">): BiSpec => ({ dimension_grain: "value", filters: [], sort: "dimension_asc", limit: null, quick: "none", measure2: null, ...s });
const delivered = { column: "status", operator: "=" as const, value: "delivered" };

const make = (s: Spec, draft: Omit<DashboardDraft, "templateId" | "difficulty" | "minLevel">): DashboardDraft => ({ templateId: s.id, difficulty: s.difficulty, minLevel: s.minLevel, ...draft });

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    ...D.category, areas: AREAS,
    build(rng, tables) {
      return make(D.category, {
        title: "Which categories earn the most?", requester: cast.category, skillTags: ["Dashboards", "Bar charts", "Aggregation"],
        scenario: "Hi, for the category review I need one chart that shows how much each category has earned. Delivered orders only, biggest first, so I can see at a glance where the money comes from.",
        dataset: reportingTable(tables, rng, 100), spec: spec({ chart_type: "bar", dimension: "category", measure: "revenue", aggregation: "sum", filters: [delivered], sort: "measure_desc" }),
      });
    },
  },
  {
    ...D.trend, areas: AREAS,
    build(rng, tables) {
      return make(D.trend, {
        title: "How has revenue moved month by month?", requester: cast.finance, skillTags: ["Dashboards", "Line charts", "Trends"],
        scenario: "Hello, the board wants to see the revenue trend rather than a single total. Please build a chart of delivered revenue for each month, in date order, so the direction is obvious.",
        dataset: reportingTable(tables, rng, 150), spec: spec({ chart_type: "line", dimension: "order_date", dimension_grain: "month", measure: "revenue", aggregation: "sum", filters: [delivered], sort: "dimension_asc" }),
      });
    },
  },
  {
    ...D.channel, areas: AREAS,
    build(rng, tables) {
      return make(D.channel, {
        title: "How is revenue split across our sales channels?", requester: cast.marketing, skillTags: ["Dashboards", "Pie charts", "Share of total"],
        scenario: "Hi, before the budget meeting I want to show how much of our delivered revenue comes through the app, the website and the marketplaces. A single chart of each channel's share, largest first.",
        dataset: reportingTable(tables, rng, 120), spec: spec({ chart_type: "pie", dimension: "channel", measure: "revenue", aggregation: "sum", filters: [delivered], sort: "measure_desc" }),
      });
    },
  },
  {
    ...D.share, areas: AREAS,
    build(rng, tables) {
      return make(D.share, {
        title: "What share of revenue does each category bring?", requester: cast.category, skillTags: ["Dashboards", "Quick measures", "Percent of total"],
        scenario: "Hi, in the category review I would rather talk about shares than rupees. Please chart what percent of our delivered revenue each category brings in, largest first, so the percentages add up to 100.",
        dataset: reportingTable(tables, rng, 120), spec: spec({ chart_type: "pie", dimension: "category", measure: "revenue", aggregation: "sum", quick: "percent_of_total", filters: [delivered], sort: "measure_desc" }),
      });
    },
  },
  {
    ...D.running, areas: AREAS,
    build(rng, tables) {
      return make(D.running, {
        title: "How much have we earned so far this year?", requester: cast.finance, skillTags: ["Dashboards", "Quick measures", "Running total"],
        scenario: "Hello, I want to show the board how delivered revenue builds up through the year. Please chart the running total by month, so each point includes all the months before it and the line only ever climbs.",
        dataset: reportingTable(tables, rng, 150), spec: spec({ chart_type: "line", dimension: "order_date", dimension_grain: "month", measure: "revenue", aggregation: "sum", quick: "running_total", filters: [delivered], sort: "dimension_asc" }),
      });
    },
  },
  {
    ...D.price, areas: AREAS,
    build(rng, tables) {
      return make(D.price, {
        title: "What do we really earn per unit in each category?", requester: cast.category, skillTags: ["Dashboards", "Quick measures", "Ratio"],
        scenario: "Hi, quantities and revenue are both on the report, but I need the price we actually realise per unit sold. For each category chart delivered revenue divided by delivered quantity (the total of one over the total of the other, not an average of the rows), highest first.",
        dataset: reportingTable(tables, rng, 140), spec: spec({ chart_type: "bar", dimension: "category", measure: "revenue", aggregation: "sum", quick: "ratio", measure2: "quantity", filters: [delivered], sort: "measure_desc" }),
      });
    },
  },
  {
    ...D.qshare, areas: AREAS,
    build(rng, tables) {
      const q = quarter(rng.int(1, 3));
      return make(D.qshare, {
        title: `${q.label}: how the sales channels shared the revenue`, requester: cast.marketing, skillTags: ["Dashboards", "Quick measures", "Percent of total", "Date filters"],
        scenario: `Hello, for the ${q.label} marketing review show me each channel's percent of delivered revenue in that quarter only, largest first. Orders outside the quarter must not count toward the total either.`,
        dataset: reportingTable(tables, rng, 160), spec: spec({ chart_type: "pie", dimension: "channel", measure: "revenue", aggregation: "sum", quick: "percent_of_total", filters: [delivered, { column: "order_date", operator: ">=", value: q.start }, { column: "order_date", operator: "<", value: q.end }], sort: "measure_desc" }),
      });
    },
  },
  {
    ...D.cities, areas: AREAS,
    build(rng, tables) {
      const limit = rng.pick([3, 5]);
      return make(D.cities, {
        title: `Our top ${limit} cities by revenue`, requester: cast.sales, skillTags: ["Dashboards", "Ranking", "Top N"],
        scenario: `Hello, for the regional review I only want to see the ${limit} cities that bring in the most delivered revenue, biggest first. A short, clear chart please.`,
        dataset: reportingTable(tables, rng, 120), spec: spec({ chart_type: "bar", dimension: "city", measure: "revenue", aggregation: "sum", filters: [delivered], sort: "measure_desc", limit }),
      });
    },
  },
  {
    ...D.returns, areas: AREAS,
    build(rng, tables) {
      const dimension = rng.pick(["city", "category"] as const);
      return make(D.returns, {
        title: `Where do returns cost us most? (by ${dimension})`, requester: cast.success, skillTags: ["Dashboards", "Filtering", "Ranking"],
        scenario: `Hi, customer success needs to know which ${dimension === "city" ? "cities" : "categories"} lose the most revenue to returns. Chart the revenue of returned orders by ${dimension}, largest first, so we can start with the worst.`,
        dataset: reportingTable(tables, rng, 150), spec: spec({ chart_type: "bar", dimension, measure: "revenue", aggregation: "sum", filters: [{ column: "status", operator: "=", value: "returned" }], sort: "measure_desc" }),
      });
    },
  },
  {
    ...D.segment, areas: AREAS,
    build(rng, tables) {
      const channel = rng.pick(["app", "web", "marketplace"]);
      return make(D.segment, {
        title: `Average line value by customer segment, ${channel} only`, requester: cast.marketing, skillTags: ["Dashboards", "Averages", "Multiple filters"],
        scenario: `Hello, I'm checking whether our premium customers really spend more per order line. Looking only at delivered orders that came through ${channel}, chart the average revenue per line for each customer segment.`,
        dataset: reportingTable(tables, rng, 150), spec: spec({ chart_type: "bar", dimension: "segment", measure: "revenue", aggregation: "avg", filters: [delivered, { column: "channel", operator: "=", value: channel }], sort: "measure_desc" }),
      });
    },
  },
  {
    ...D.quarter, areas: AREAS,
    build(rng, tables) {
      const q = quarter(rng.int(1, 3));
      return make(D.quarter, {
        title: `${q.label}: the three categories that led`, requester: cast.category, skillTags: ["Dashboards", "Date filters", "Top N"],
        scenario: `Hi, for the ${q.label} review I want the three categories with the most delivered revenue in that quarter only. Chart them biggest first. Orders outside the quarter must not count.`,
        dataset: reportingTable(tables, rng, 150), spec: spec({ chart_type: "bar", dimension: "category", measure: "revenue", aggregation: "sum", filters: [delivered, { column: "order_date", operator: ">=", value: q.start }, { column: "order_date", operator: "<", value: q.end }], sort: "measure_desc", limit: 3 }),
      });
    },
  },
];

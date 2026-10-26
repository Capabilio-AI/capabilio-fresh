import type { BiSpec } from "@/lib/arena-workstations/engines/bi";
import type { Cell, Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { Rng } from "../rng";
import { colIndex, tableOf } from "../office/data";
import type { DashboardTemplate } from "../office/types";
import { BRANCHES, KAVERI } from "./kaveri";

const { cast } = KAVERI;
const AREAS = ["reporting"];
const branchOf = new Map(BRANCHES.map(([id, , city, region]) => [id, { city, region }]));
const spec = (s: Partial<BiSpec> & Pick<BiSpec, "chart_type" | "dimension" | "aggregation" | "measure">): BiSpec => ({ dimension_grain: "value", filters: [], sort: "dimension_asc", limit: null, ...s });
const closed = { column: "status", operator: "=" as const, value: "closed" };

/** A flat service-request report (one row per request, branch city and region joined in), sampled per user. */
function requestReport(tables: Dataset[], rng: Rng, n: number): Dataset {
  const t = tableOf(tables, "service_requests");
  const at = (r: Cell[], c: string) => r[colIndex(t, c)];
  const rows: Cell[][] = rng.shuffle(t.rows).slice(0, n).map((r) => {
    const b = branchOf.get(Number(at(r, "branch_id")));
    return [at(r, "request_id"), at(r, "opened_on"), b?.city ?? "Unknown", b?.region ?? "Unknown", at(r, "category"), at(r, "status"), at(r, "resolution_hours"), at(r, "charge")];
  });
  return {
    name: "service_report",
    columns: [
      { name: "request_id", type: "number" }, { name: "opened_on", type: "date" }, { name: "city", type: "text" }, { name: "region", type: "text" },
      { name: "category", type: "text" }, { name: "status", type: "text" }, { name: "resolution_hours", type: "number" }, { name: "charge", type: "number" },
    ],
    rows,
  };
}

type Spec = Pick<DashboardTemplate, "id" | "difficulty" | "minLevel">;
const D: Record<string, Spec> = {
  category: { id: "ba-dash-requests-by-category", difficulty: "easy", minLevel: "fresher" },
  trend: { id: "ba-dash-monthly-revenue", difficulty: "easy", minLevel: "fresher" },
  resolution: { id: "ba-dash-region-resolution", difficulty: "medium", minLevel: "fresher" },
  cities: { id: "ba-dash-top-cities", difficulty: "medium", minLevel: "fresher" },
};

export const BUSINESS_DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    ...D.category, areas: AREAS,
    build(rng, tables) {
      return {
        templateId: D.category.id, difficulty: D.category.difficulty, minLevel: D.category.minLevel, requester: cast.ops, skillTags: ["Reporting", "Bar charts", "Counts"],
        title: "Where does our service workload come from?",
        scenario: "Hi, for the staffing plan I need one chart showing how many service requests we got for each appliance category, all statuses included, biggest first.",
        dataset: requestReport(tables, rng, 120), spec: spec({ chart_type: "bar", dimension: "category", measure: null, aggregation: "count", sort: "measure_desc" }),
      };
    },
  },
  {
    ...D.trend, areas: AREAS,
    build(rng, tables) {
      return {
        templateId: D.trend.id, difficulty: D.trend.difficulty, minLevel: D.trend.minLevel, requester: cast.finance, skillTags: ["Reporting", "Line charts", "Trends"],
        title: "Monthly service revenue trend",
        scenario: "Hello, the leadership pack needs the trend of service revenue: the total charge of closed requests for each month, in date order.",
        dataset: requestReport(tables, rng, 140), spec: spec({ chart_type: "line", dimension: "opened_on", dimension_grain: "month", measure: "charge", aggregation: "sum", filters: [closed], sort: "dimension_asc" }),
      };
    },
  },
  {
    ...D.resolution, areas: AREAS,
    build(rng, tables) {
      const category = rng.pick(["AC repair", "Washing machine", "Refrigerator"]);
      return {
        templateId: D.resolution.id, difficulty: D.resolution.difficulty, minLevel: D.resolution.minLevel, requester: cast.cx, skillTags: ["Reporting", "Averages", "Filters"],
        title: `How long do ${category} jobs take in each region?`,
        scenario: `Hi, customers complain about slow ${category} visits. Please chart the average resolution hours of closed ${category} requests for each region, slowest region first.`,
        dataset: requestReport(tables, rng, 120), spec: spec({ chart_type: "bar", dimension: "region", measure: "resolution_hours", aggregation: "avg", filters: [closed, { column: "category", operator: "=", value: category }], sort: "measure_desc" }),
      };
    },
  },
  {
    ...D.cities, areas: AREAS,
    build(rng, tables) {
      return {
        templateId: D.cities.id, difficulty: D.cities.difficulty, minLevel: D.cities.minLevel, requester: cast.regional, skillTags: ["Reporting", "Top N", "Revenue"],
        title: "Our five biggest cities by service revenue",
        scenario: "Hi, I only have room for five cities on the slide. Show the five cities with the highest total charge from closed requests, highest first.",
        dataset: requestReport(tables, rng, 130), spec: spec({ chart_type: "bar", dimension: "city", measure: "charge", aggregation: "sum", filters: [closed], sort: "measure_desc", limit: 5 }),
      };
    },
  },
];

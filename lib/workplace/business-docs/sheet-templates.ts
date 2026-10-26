import type { Cell, Dataset } from "@/lib/arena-workstations/engines/dataset";
import { colIndex, tableOf } from "../office/data";
import type { SheetTemplate } from "../office/types";
import { BRANCHES, KAVERI, MONTHS } from "./kaveri";

const { cast } = KAVERI;
const AREAS = ["business-metrics"];
const branchName = new Map(BRANCHES.map(([id, name]) => [id, name]));
const MONTH_LABEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September"];

/** Branch rows of monthly_kpis for two consecutive months, with the branch named instead of numbered. */
function kpiRows(tables: Dataset[], first: number, columns: string[]): Dataset {
  const t = tableOf(tables, "monthly_kpis");
  const months = [MONTHS[first], MONTHS[first + 1]];
  const rows: Cell[][] = t.rows
    .filter((r) => months.includes(String(r[colIndex(t, "month")])))
    .map((r) => [branchName.get(Number(r[colIndex(t, "branch_id")])) ?? "Unknown", r[colIndex(t, "month")], ...columns.map((c) => r[colIndex(t, c)])]);
  return { name: "branch_kpis", columns: [{ name: "branch", type: "text" }, { name: "month", type: "text" }, ...columns.map((c) => ({ name: c, type: "number" as const }))], rows };
}

export const BUSINESS_SHEET_TEMPLATES: SheetTemplate[] = [
  {
    id: "ba-sheet-target-variance", difficulty: "easy", minLevel: "fresher", areas: AREAS,
    build(rng, tables) {
      const m = rng.int(0, MONTHS.length - 2);
      return {
        templateId: "ba-sheet-target-variance", difficulty: "easy", minLevel: "fresher", requester: cast.finance, skillTags: ["Excel", "Variance", "KPIs"],
        title: `Target vs actual for ${MONTH_LABEL[m]} and ${MONTH_LABEL[m + 1]}`,
        scenario: `Hi, for the monthly business review I need each branch's revenue variance: actual minus target, so a shortfall shows as a negative number. Please also give me total actual revenue across these rows. Use formulas, I will paste the next months in later.`,
        content: { data: kpiRows(tables, m, ["target_revenue", "actual_revenue"]), lookup: null, tasks: [{ type: "row_formula", header: "Variance", op: "subtract", left: "actual_revenue", right: "target_revenue", decimals: 0 }, { type: "summary", label: "Total actual revenue", fn: "SUM", column: "actual_revenue", decimals: 0 }] },
      };
    },
  },
  {
    id: "ba-sheet-sla-rate", difficulty: "easy", minLevel: "fresher", areas: AREAS,
    build(rng, tables) {
      const m = rng.int(0, MONTHS.length - 2);
      return {
        templateId: "ba-sheet-sla-rate", difficulty: "easy", minLevel: "fresher", requester: cast.ops, skillTags: ["Excel", "KPIs", "Percentages"],
        title: `SLA compliance by branch, ${MONTH_LABEL[m]} to ${MONTH_LABEL[m + 1]}`,
        scenario: `Hello, our KPI for service is the share of calls closed within SLA. For every row show calls within SLA as a percentage of all service calls, and the total number of service calls, so I can see which branches are slipping.`,
        content: { data: kpiRows(tables, m, ["service_calls", "calls_within_sla"]), lookup: null, tasks: [{ type: "row_formula", header: "SLA %", op: "percent_of", left: "calls_within_sla", right: "service_calls", decimals: 1 }, { type: "summary", label: "Total service calls", fn: "SUM", column: "service_calls", decimals: 0 }] },
      };
    },
  },
  {
    id: "ba-sheet-variance-pct", difficulty: "medium", minLevel: "fresher", areas: AREAS,
    build(rng, tables) {
      const m = rng.int(0, MONTHS.length - 2);
      return {
        templateId: "ba-sheet-variance-pct", difficulty: "medium", minLevel: "fresher", requester: cast.regional, skillTags: ["Excel", "Variance %", "SUMIF"],
        title: `Which branches missed target in ${MONTH_LABEL[m + 1]}?`,
        scenario: `Hi, I am preparing the regional review. For each row I need the variance in rupees (actual minus target) and the variance as a % change from target to actual. I also need total actual revenue for ${MONTH_LABEL[m + 1]} only (month ${MONTHS[m + 1]}).`,
        content: {
          data: kpiRows(tables, m, ["target_revenue", "actual_revenue"]), lookup: null,
          tasks: [
            { type: "row_formula", header: "Variance", op: "subtract", left: "actual_revenue", right: "target_revenue", decimals: 0 },
            { type: "row_formula", header: "Variance %", op: "percent_change", left: "target_revenue", right: "actual_revenue", decimals: 1 },
            { type: "conditional_summary", label: `Actual revenue, ${MONTHS[m + 1]}`, fn: "SUMIF", criteria_column: "month", criteria_value: MONTHS[m + 1], column: "actual_revenue", decimals: 0 },
          ],
        },
      };
    },
  },
  {
    id: "ba-sheet-campaign-roi", difficulty: "medium", minLevel: "fresher", areas: AREAS,
    build(rng, tables) {
      const t = tableOf(tables, "campaigns");
      const keep = ["campaign_name", "channel", "spend", "leads", "conversions", "revenue"];
      const rows = rng.shuffle(t.rows).slice(0, 18).map((r) => keep.map((c) => r[colIndex(t, c)]));
      const channel = String(rng.pick(rows)[1]);
      return {
        templateId: "ba-sheet-campaign-roi", difficulty: "medium", minLevel: "fresher", requester: cast.marketing, skillTags: ["Excel", "ROI", "Conversion rate"],
        title: "Was each campaign worth its spend?",
        scenario: `Hi, before we plan next quarter's budget I want the return on every campaign: ROI as the % change from spend to attributed revenue, and the conversion rate (conversions as a % of leads). Also the total we spent on the ${channel} channel.`,
        content: {
          data: { name: "campaigns", columns: keep.map((c) => t.columns[colIndex(t, c)]), rows }, lookup: null,
          tasks: [
            { type: "row_formula", header: "ROI %", op: "percent_change", left: "spend", right: "revenue", decimals: 1 },
            { type: "row_formula", header: "Conversion %", op: "percent_of", left: "conversions", right: "leads", decimals: 1 },
            { type: "conditional_summary", label: `Total spend, ${channel}`, fn: "SUMIF", criteria_column: "channel", criteria_value: channel, column: "spend", decimals: 0 },
          ],
        },
      };
    },
  },
];

import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { SheetTask } from "@/lib/arena-workstations/engines/spreadsheet";
import { BRIGHTCART } from "../worlds/brightcart";
import { distinct, salesSheet, type Line, type LineColumn, type LineFilter } from "./data";
import type { SheetDraft, SheetTemplate } from "./types";

const { cast } = BRIGHTCART;
const AREAS = ["spreadsheet"];
const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September"];
const pad = (n: number) => String(n).padStart(2, "0");
const monthWindow = (m: number) => ({ label: `${MONTHS[m]} 2026`, start: `2026-${pad(m)}-01`, end: m === 9 ? "2026-10-01" : `2026-${pad(m + 1)}-01` });
/** bigger sheets need more lines than a single month holds */
const quarterWindow = (q: number) => ({ label: `Q${q} 2026`, start: `2026-${pad((q - 1) * 3 + 1)}-01`, end: q === 3 ? "2026-10-01" : `2026-${pad(q * 3 + 1)}-01` });

// Indian GST slabs by what a product is, and what each sales channel charges. Fictional but realistic, and the same for everyone.
const GST: Dataset = { name: "gst_rates", columns: [{ name: "category", type: "text" }, { name: "gst_pct", type: "number" }], rows: [["Stationery", 12], ["Home", 18], ["Travel", 18], ["Kitchen", 12], ["Fitness", 18]] };
const COMMISSION: Dataset = { name: "channel_fees", columns: [{ name: "channel", type: "text" }, { name: "fee_pct", type: "number" }], rows: [["app", 0], ["web", 2], ["marketplace", 15]] };

type Spec = { id: string; difficulty: SheetTemplate["difficulty"]; minLevel: SheetTemplate["minLevel"] };
const make = (s: Spec, rng: Parameters<SheetTemplate["build"]>[0], tables: Dataset[], cfg: { n: number; columns: LineColumn[]; filter?: LineFilter; lookup?: Dataset; tasks: (lines: Line[]) => SheetTask[] }, draft: Omit<SheetDraft, "content" | "templateId" | "difficulty" | "minLevel">): SheetDraft => {
  const { data, lines } = salesSheet(tables, rng, cfg.n, cfg.columns, cfg.filter);
  return { templateId: s.id, difficulty: s.difficulty, minLevel: s.minLevel, ...draft, content: { data, lookup: cfg.lookup ?? null, tasks: cfg.tasks(lines) } };
};
/** a value that really occurs in the picked lines, so a conditional total is never empty */
const seen = <K extends keyof Line>(rng: Parameters<SheetTemplate["build"]>[0], lines: Line[], key: K): string => String(rng.pick(distinct(lines.map((l) => l[key]))));

const D: Record<string, Spec> = {
  revenue: { id: "sheet-line-revenue", difficulty: "easy", minLevel: "fresher" },
  margin: { id: "sheet-unit-margin", difficulty: "easy", minLevel: "fresher" },
  gst: { id: "sheet-gst-lookup", difficulty: "medium", minLevel: "fresher" },
  channel: { id: "sheet-channel-report", difficulty: "medium", minLevel: "fresher" },
  twoWay: { id: "sheet-two-way-report", difficulty: "medium", minLevel: "junior" },
  pivotPack: { id: "sheet-pivot-summary", difficulty: "medium", minLevel: "junior" },
  analysisPack: { id: "sheet-analysis-pack", difficulty: "hard", minLevel: "mid" },
  markup: { id: "sheet-markup", difficulty: "medium", minLevel: "junior" },
  profit: { id: "sheet-cost-profit", difficulty: "hard", minLevel: "junior" },
  returns: { id: "sheet-returns", difficulty: "hard", minLevel: "mid" },
  full: { id: "sheet-full-analysis", difficulty: "hard", minLevel: "senior" },
};

export const SHEET_TEMPLATES: SheetTemplate[] = [
  {
    ...D.revenue, areas: AREAS,
    build(rng, tables) {
      const w = monthWindow(rng.int(2, 8));
      return make(D.revenue, rng, tables, {
        n: 20, columns: ["orderId", "product", "category", "channel", "quantity", "unitPrice"], filter: { statuses: ["delivered"], window: w },
        tasks: () => [{ type: "row_formula", header: "Revenue", op: "multiply", left: "quantity", right: "unit_price", decimals: 2 }, { type: "summary", label: "Total units", fn: "SUM", column: "quantity", decimals: 0 }],
      }, {
        title: `${w.label.split(" ")[0]} order lines for the stand-up`, requester: cast.sales, skillTags: ["Excel", "Formulas", "SUM"],
        scenario: `Hi, I've exported some of ${w.label}'s delivered order lines into this sheet. For the stand-up I need the revenue of every line (quantity times price) and the total number of units. Please use formulas so I can paste in more rows later.`,
      });
    },
  },
  {
    ...D.margin, areas: AREAS,
    build(rng, tables) {
      const w = monthWindow(rng.int(2, 8));
      return make(D.margin, rng, tables, {
        n: 22, columns: ["orderId", "product", "category", "quantity", "unitPrice", "unitCost"], filter: { statuses: ["delivered"], window: w },
        tasks: () => [{ type: "row_formula", header: "Margin per unit", op: "subtract", left: "unit_price", right: "unit_cost", decimals: 0 }, { type: "summary", label: "Average selling price", fn: "AVERAGE", column: "unit_price", decimals: 2 }],
      }, {
        title: "What do we earn on each unit?", requester: cast.finance, skillTags: ["Excel", "Formulas", "AVERAGE"],
        scenario: `Hello, finance wants to see how much we make per unit on a sample of ${w.label}'s orders. For every line show the margin per unit (what we charged minus what it cost us), and give me the average selling price across the sample.`,
      });
    },
  },
  {
    ...D.gst, areas: AREAS,
    build(rng, tables) {
      const w = monthWindow(rng.int(2, 8));
      return make(D.gst, rng, tables, {
        n: 28, columns: ["orderId", "product", "category", "quantity", "unitPrice"], filter: { statuses: ["delivered"], window: w }, lookup: GST,
        tasks: () => [{ type: "lookup", header: "GST %", key_column: "category" }, { type: "row_formula", header: "Revenue", op: "multiply", left: "quantity", right: "unit_price", decimals: 2 }],
      }, {
        title: "Add the GST rate to every line", requester: cast.finance, skillTags: ["Excel", "VLOOKUP", "Lookups"],
        scenario: "Hi, the tax rate depends on the product category and we keep the rates in the small table next to the data. I need each line to show its GST % (looked up, not typed in) and its revenue, so I can work out the tax payable.",
      });
    },
  },
  {
    ...D.channel, areas: AREAS,
    build(rng, tables) {
      const w = quarterWindow(rng.int(1, 3));
      return make(D.channel, rng, tables, {
        n: 40, columns: ["orderId", "product", "category", "channel", "quantity", "unitPrice"], filter: { statuses: ["delivered"], window: w },
        tasks: (lines) => {
          const channel = seen(rng, lines, "channel");
          const others = distinct(lines.map((l) => l.channel)).filter((c) => c !== channel);
          const other = others.length ? rng.pick(others) : channel;
          const category = seen(rng, lines, "category");
          return [
            { type: "row_formula", header: "Revenue", op: "multiply", left: "quantity", right: "unit_price", decimals: 2 },
            { type: "conditional_summary", label: `Units via ${channel}`, fn: "SUMIF", criteria_column: "channel", criteria_value: channel, column: "quantity", decimals: 0 },
            { type: "conditional_summary", label: `Lines via ${other}`, fn: "COUNTIF", criteria_column: "channel", criteria_value: other, column: "quantity", decimals: 0 },
            { type: "conditional_summary", label: `Average ${category} price`, fn: "AVERAGEIF", criteria_column: "category", criteria_value: category, column: "unit_price", decimals: 2 },
          ];
        },
      }, {
        title: `Channel report, ${w.label}`, requester: cast.marketing, skillTags: ["Excel", "SUMIF", "COUNTIF", "AVERAGEIF"],
        scenario: "Hello, I'm comparing our sales channels before the budget meeting. In this sample I need the revenue of each line, how many units went through one channel, how many lines went through another, and the average price in one category. Formulas only, please, so I can change the sample.",
      });
    },
  },
  {
    ...D.twoWay, areas: AREAS,
    build(rng, tables) {
      const w = quarterWindow(rng.int(1, 3));
      return make(D.twoWay, rng, tables, {
        n: 45, columns: ["orderId", "product", "category", "channel", "quantity", "unitPrice"], filter: { statuses: ["delivered"], window: w },
        tasks: (lines) => {
          const pick = rng.pick(lines);
          const category = String(pick.category);
          const channel = String(pick.channel);
          return [
            { type: "row_formula", header: "Revenue", op: "multiply", left: "quantity", right: "unit_price", decimals: 2 },
            { type: "multi_conditional_summary", label: `${category} units via ${channel}`, fn: "SUMIFS", criteria: [{ column: "category", value: category }, { column: "channel", value: channel }], column: "quantity", decimals: 0 },
            { type: "multi_conditional_summary", label: `${category} lines via ${channel}`, fn: "COUNTIFS", criteria: [{ column: "category", value: category }, { column: "channel", value: channel }], column: "quantity", decimals: 0 },
            { type: "summary", label: "Median unit price", fn: "MEDIAN", column: "unit_price", decimals: 2 },
          ];
        },
      }, {
        title: `Where do ${w.label} sales overlap? A two-way report`, requester: cast.marketing, skillTags: ["Excel", "SUMIFS", "COUNTIFS", "MEDIAN"],
        scenario: "Hi, I need to size one segment of the business: a particular category sold through a particular channel. For this sample please give me each line's revenue, the units and the number of lines in that category-and-channel combination (both conditions must hold), and the median unit price, which I trust more than the average because of a few premium items.",
      });
    },
  },
  {
    ...D.pivotPack, areas: AREAS,
    build(rng, tables) {
      const w = quarterWindow(rng.int(1, 3));
      return make(D.pivotPack, rng, tables, {
        n: 50, columns: ["orderId", "product", "category", "channel", "quantity", "unitPrice"], filter: { statuses: ["delivered"], window: w },
        tasks: () => [
          { type: "row_formula", header: "Revenue", op: "multiply", left: "quantity", right: "unit_price", decimals: 2 },
          { type: "pivot", label: "Units by category", row_column: "category", value_column: "quantity", fn: "SUM" },
          { type: "pivot", label: "Average price by channel", row_column: "channel", value_column: "unit_price", fn: "AVERAGE" },
          { type: "summary", label: "Price spread (std dev)", fn: "STDEV", column: "unit_price", decimals: 2 },
        ],
      }, {
        title: `Summarise ${w.label} with PivotTables`, requester: cast.category, skillTags: ["Excel", "PivotTable", "STDEV"],
        scenario: "Hello, I need a quick summary I can paste into the review deck. Build two PivotTables from this sample (total units by category, and the average unit price by channel), add each line's revenue, and tell me how spread out the unit prices are with a standard deviation formula.",
      });
    },
  },
  {
    ...D.analysisPack, areas: AREAS,
    build(rng, tables) {
      const w = quarterWindow(rng.int(1, 3));
      return make(D.analysisPack, rng, tables, {
        n: 70, columns: ["orderId", "product", "category", "channel", "city", "quantity", "unitPrice"], filter: { statuses: ["delivered"], window: w }, lookup: GST,
        tasks: (lines) => {
          const pick = rng.pick(lines);
          const category = String(pick.category);
          const channel = String(pick.channel);
          return [
            { type: "row_formula", header: "Revenue", op: "multiply", left: "quantity", right: "unit_price", decimals: 2 },
            { type: "lookup", header: "GST %", key_column: "category" },
            { type: "multi_conditional_summary", label: `Avg ${category} price via ${channel}`, fn: "AVERAGEIFS", criteria: [{ column: "category", value: category }, { column: "channel", value: channel }], column: "unit_price", decimals: 2 },
            { type: "summary", label: "Median units per line", fn: "MEDIAN", column: "quantity", decimals: 1 },
            { type: "pivot", label: "Units by city", row_column: "city", value_column: "quantity", fn: "SUM" },
          ];
        },
      }, {
        title: `${w.label} analysis pack for the regional head`, requester: cast.sales, skillTags: ["Excel", "PivotTable", "AVERAGEIFS", "MEDIAN", "Lookups"],
        scenario: "Hi, the regional head wants one workbook that does it all from a single sample: line revenue, the GST rate from the rate table (use whichever lookup you prefer, INDEX/MATCH or XLOOKUP are fine), the average price for one category-and-channel combination, the median units per line, and a PivotTable of units by city. Formulas, not typed values.",
      });
    },
  },
  {
    ...D.markup, areas: AREAS,
    build(rng, tables) {
      const w = quarterWindow(rng.int(1, 3));
      return make(D.markup, rng, tables, {
        n: 45, columns: ["orderId", "product", "category", "quantity", "unitPrice", "unitCost"], filter: { statuses: ["delivered"], window: w },
        tasks: (lines) => {
          const category = seen(rng, lines, "category");
          return [
            { type: "row_formula", header: "Markup %", op: "percent_change", left: "unit_cost", right: "unit_price", decimals: 1 },
            { type: "row_formula", header: "Revenue", op: "multiply", left: "quantity", right: "unit_price", decimals: 2 },
            { type: "summary", label: "Highest price", fn: "MAX", column: "unit_price", decimals: 0 },
            { type: "conditional_summary", label: `${category} units`, fn: "SUMIF", criteria_column: "category", criteria_value: category, column: "quantity", decimals: 0 },
          ];
        },
      }, {
        title: "How much do we mark things up?", requester: cast.category, skillTags: ["Excel", "Percentages", "SUMIF", "MAX"],
        scenario: `Hi, I'm reviewing pricing. For this sample from ${w.label} I want the markup on each line (how much higher the price is than what it cost us, as a percentage), each line's revenue, the highest price we charged, and the total units sold in one category.`,
      });
    },
  },
  {
    ...D.profit, areas: AREAS,
    build(rng, tables) {
      const w = quarterWindow(rng.int(1, 3));
      return make(D.profit, rng, tables, {
        n: 60, columns: ["orderId", "product", "category", "city", "quantity", "unitPrice", "unitCost"], filter: { statuses: ["delivered"], window: w }, lookup: GST,
        tasks: (lines) => {
          const city = seen(rng, lines, "city");
          return [
            { type: "row_formula", header: "Revenue", op: "multiply", left: "quantity", right: "unit_price", decimals: 2 },
            { type: "row_formula", header: "Cost", op: "multiply", left: "quantity", right: "unit_cost", decimals: 2 },
            { type: "lookup", header: "GST %", key_column: "category" },
            { type: "conditional_summary", label: `${city} units`, fn: "SUMIF", criteria_column: "city", criteria_value: city, column: "quantity", decimals: 0 },
          ];
        },
      }, {
        title: `Revenue, cost and tax for a ${w.label} sample`, requester: cast.finance, skillTags: ["Excel", "Formulas", "VLOOKUP", "SUMIF"],
        scenario: "Hello, I'm building the profit view for the board. For every line I need revenue, cost and the GST rate (from the rate table), plus the units we sold in one city. The sheet will be reused next month, so everything must be a formula.",
      });
    },
  },
  {
    ...D.returns, areas: AREAS,
    build(rng, tables) {
      const w = quarterWindow(rng.int(1, 3));
      return make(D.returns, rng, tables, {
        n: 70, columns: ["orderId", "product", "category", "status", "quantity", "unitPrice", "unitCost"], filter: { window: w }, lookup: GST,
        tasks: () => {
          return [
            { type: "conditional_summary", label: "Returned lines", fn: "COUNTIF", criteria_column: "status", criteria_value: "returned", column: "quantity", decimals: 0 },
            { type: "conditional_summary", label: "Returned units", fn: "SUMIF", criteria_column: "status", criteria_value: "returned", column: "quantity", decimals: 0 },
            { type: "conditional_summary", label: "Average delivered price", fn: "AVERAGEIF", criteria_column: "status", criteria_value: "delivered", column: "unit_price", decimals: 2 },
            { type: "row_formula", header: "Markup %", op: "percent_change", left: "unit_cost", right: "unit_price", decimals: 1 },
            { type: "lookup", header: "GST %", key_column: "category" },
          ];
        },
      }, {
        title: `How bad are returns in ${w.label}?`, requester: cast.success, skillTags: ["Excel", "COUNTIF", "SUMIF", "AVERAGEIF", "VLOOKUP"],
        scenario: "Hi, customer success is under pressure about returns. In this sample, which includes every status, show me how many lines and units were returned, the average price of delivered lines for comparison, and for every line its markup and GST rate so finance can see what a return costs us.",
      });
    },
  },
  {
    ...D.full, areas: AREAS,
    build(rng, tables) {
      const w = quarterWindow(rng.int(1, 3));
      return make(D.full, rng, tables, {
        n: 90, columns: ["orderId", "product", "category", "channel", "city", "quantity", "unitPrice", "unitCost"], filter: { statuses: ["delivered"], window: w }, lookup: COMMISSION,
        tasks: (lines) => {
          const city = seen(rng, lines, "city");
          const category = seen(rng, lines, "category");
          return [
            { type: "row_formula", header: "Revenue", op: "multiply", left: "quantity", right: "unit_price", decimals: 2 },
            { type: "row_formula", header: "Cost share %", op: "percent_of", left: "unit_cost", right: "unit_price", decimals: 1 },
            { type: "lookup", header: "Channel fee %", key_column: "channel" },
            { type: "conditional_summary", label: `${city} units`, fn: "SUMIF", criteria_column: "city", criteria_value: city, column: "quantity", decimals: 0 },
            { type: "conditional_summary", label: `Average ${category} cost`, fn: "AVERAGEIF", criteria_column: "category", criteria_value: category, column: "unit_cost", decimals: 2 },
            { type: "summary", label: "Lowest price", fn: "MIN", column: "unit_price", decimals: 0 },
          ];
        },
      }, {
        title: `Channel economics, ${w.label}`, requester: cast.data, skillTags: ["Excel", "Formulas", "VLOOKUP", "SUMIF", "AVERAGEIF"],
        scenario: "Hi, I'm preparing the channel review. On this larger sample I need each line's revenue, what share of the price the cost represents, and the fee its channel charges (from the fee table), then the units in one city, the average cost in one category and the lowest price we charged. Everything as formulas that would survive a refresh of the data.",
      });
    },
  },
];

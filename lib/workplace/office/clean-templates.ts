import type { CleaningStep } from "@/lib/arena-workstations/engines/cleaning";
import { BRIGHTCART } from "../worlds/brightcart";
import { messyExport, type Mess } from "./data";
import type { CleanDraft, CleanTemplate } from "./types";

const { cast } = BRIGHTCART;
const AREAS = ["data_cleaning"];

type Spec = { id: string; difficulty: CleanTemplate["difficulty"]; minLevel: CleanTemplate["minLevel"] };
const make = (s: Spec, rows: number, mess: Mess, steps: CleaningStep[], draft: Omit<CleanDraft, "templateId" | "difficulty" | "minLevel" | "dataset" | "steps">, build: Parameters<CleanTemplate["build"]>): CleanDraft => {
  const [rng, tables] = build;
  return { templateId: s.id, difficulty: s.difficulty, minLevel: s.minLevel, ...draft, dataset: messyExport(tables, rng, rows, mess), steps };
};

const trim = (column: string): CleaningStep => ({ op: "trim", column });
const title = (column: string): CleaningStep => ({ op: "titlecase", column });
const lower = (column: string): CleaningStep => ({ op: "lowercase", column });
const num = (column: string): CleaningStep => ({ op: "to_number", column });
const date = (column: string): CleaningStep => ({ op: "to_date", column, format: "DD/MM/YYYY" });
const missing = (column: string): CleaningStep => ({ op: "drop_missing", column });
const dedupe = (...columns: string[]): CleaningStep => ({ op: "dedupe", columns });
const replace = (column: string, from: string, to: string): CleaningStep => ({ op: "replace", column, from, to });

const D: Record<string, Spec> = {
  cities: { id: "clean-city-and-amount", difficulty: "easy", minLevel: "fresher" },
  returns: { id: "clean-returns-list", difficulty: "easy", minLevel: "fresher" },
  monthEnd: { id: "clean-month-end-load", difficulty: "medium", minLevel: "fresher" },
  typos: { id: "clean-category-typos", difficulty: "medium", minLevel: "junior" },
  crm: { id: "clean-full-crm-export", difficulty: "hard", minLevel: "junior" },
  analysis: { id: "clean-analysis-ready", difficulty: "hard", minLevel: "mid" },
};

export const CLEAN_TEMPLATES: CleanTemplate[] = [
  {
    ...D.cities, areas: AREAS,
    build(...args) {
      return make(D.cities, 90, { city: 0.4, amountText: true }, [trim("city"), title("city"), num("amount")], {
        title: "Make the city and amount columns usable", requester: cast.sales, skillTags: ["Data cleaning", "Trim", "Text case", "Numbers"],
        scenario: "Hi, I exported last month's orders from the admin screen to build a city-wise summary, but the city names are typed every which way and the amounts came out as text with rupee signs and commas, so nothing sums. Can you tidy those two columns?",
      }, args);
    },
  },
  {
    ...D.returns, areas: AREAS,
    build(...args) {
      return make(D.returns, 210, { status: 0.5, duplicates: 0.08 }, [trim("status"), lower("status"), dedupe("order_ref"), { op: "filter", column: "status", operator: "=", value: "returned" }], {
        title: "A clean list of returned orders", requester: cast.success, skillTags: ["Data cleaning", "Duplicates", "Filtering"],
        scenario: "Hello, I need the returned orders for a call-back campaign. The export has the status written inconsistently and some orders appear twice because the loader retried. Give me each returned order exactly once.",
      }, args);
    },
  },
  {
    ...D.monthEnd, areas: AREAS,
    build(...args) {
      return make(D.monthEnd, 150, { amountText: true, dateText: { invalid: 3 }, missingNames: 0.06, city: 0.3 }, [trim("city"), num("amount"), date("order_date"), missing("order_date"), missing("customer_name")], {
        title: "Month-end load: fix dates, amounts and gaps", requester: cast.finance, skillTags: ["Data cleaning", "Dates", "Missing values", "Numbers"],
        scenario: "Hi, the finance system rejects this month-end file. Dates come as DD/MM/YYYY text and a few are impossible (31/02), amounts are text, some rows have no customer name and city names have stray spaces. Please make it loadable: real dates, real numbers, and drop any row we cannot trust.",
      }, args);
    },
  },
  {
    ...D.typos, areas: AREAS,
    build(...args) {
      const [rng] = args;
      const typo = rng.pick([["Stationery", "Stationary"], ["Kitchen", "Kitchenware"], ["Fitness", "Fitnes"]] as const);
      return make(D.typos, 140, { categoryTypo: typo, status: 0.45, city: 0.3, duplicates: 0.05 }, [replace("category", typo[1], typo[0]), trim("status"), lower("status"), trim("city"), title("city"), dedupe("order_ref")], {
        title: `The ${typo[0]} category is spelt two ways`, requester: cast.category, skillTags: ["Data cleaning", "Standardising values", "Duplicates"],
        scenario: `Hello, my category report shows "${typo[0]}" and "${typo[1]}" as two different categories, and the status and city columns have the same kind of problem. Please standardise them so every group appears once, and make sure no order is counted twice.`,
      }, args);
    },
  },
  {
    ...D.crm, areas: AREAS,
    build(...args) {
      return make(D.crm, 200, { city: 0.35, status: 0.4, amountText: true, dateText: { invalid: 4 }, duplicates: 0.07 }, [trim("city"), title("city"), trim("status"), lower("status"), num("amount"), date("order_date"), missing("order_date"), dedupe("order_ref")], {
        title: "Turn the raw CRM export into a reporting table", requester: cast.data, skillTags: ["Data cleaning", "Power Query style", "Dates", "Duplicates"],
        scenario: "Hi, this is the raw nightly CRM dump and it feeds the dashboard. Cities and statuses are inconsistent, amounts and dates are text, some dates are impossible, and retries created duplicate rows. I need one trustworthy row per order with proper types before the dashboard can use it.",
      }, args);
    },
  },
  {
    ...D.analysis, areas: AREAS,
    build(...args) {
      const [rng] = args;
      const min = rng.pick([500, 1000, 2000]);
      return make(D.analysis, 240, { city: 0.4, status: 0.4, amountText: true, dateText: { invalid: 4 }, missingNames: 0.05, duplicates: 0.06 }, [trim("city"), title("city"), trim("status"), lower("status"), num("amount"), date("order_date"), missing("order_date"), missing("customer_name"), dedupe("order_ref"), { op: "filter", column: "status", operator: "=", value: "delivered" }, { op: "filter", column: "amount", operator: ">=", value: min }], {
        title: `Delivered orders of ₹${min.toLocaleString("en-IN")} and above, analysis-ready`, requester: cast.marketing, skillTags: ["Data cleaning", "Filtering", "Power Query style", "Large datasets"],
        scenario: `Hello, I'm segmenting our bigger customers and need a clean list: only delivered orders worth at least ₹${min.toLocaleString("en-IN")}, one row per order, real dates and numbers, no rows without a customer name, and consistent city and status text. The export is big and messy, so please be thorough.`,
      }, args);
    },
  },
];

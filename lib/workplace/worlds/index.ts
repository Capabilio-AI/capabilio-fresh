import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import { BRIGHTCART, generateBrightCart } from "./brightcart";
import { BRIGHTCART_SQL_TEMPLATES, type TicketTemplate } from "../tickets";
import type { Story } from "../sprint";
import { CLEAN_TEMPLATES } from "../office/clean-templates";
import { SHEET_TEMPLATES } from "../office/sheet-templates";
import { DASHBOARD_TEMPLATES } from "../office/dashboard-templates";
import { STATS_TEMPLATES } from "../office/stats-templates";
import type { CleanTemplate, DashboardTemplate, SheetTemplate, StatsTemplate } from "../office/types";
import { INVESTIGATION_TEMPLATES } from "../investigate/templates";
import type { InvestigationTemplate } from "../investigate/types";
import type { Dialect } from "@/lib/arena-workstations/engines/seed-sql";
import { BRIGHTCART_PG_TEMPLATES, PG_WORLD_SETUP } from "../tickets/pg-index";

/** A fictional company a role works in: one warehouse per user and the tickets that can be asked of it. */
export interface World {
  key: string;
  name: string;
  generate(seed: number): Dataset[];
  templates: readonly TicketTemplate[];
  /** which database the world runs on */
  engine: Dialect;
  /** constraints and other setup every ticket starts from (run after the tables are built) */
  setupSql?: string;
  /** spreadsheet, data-cleaning, dashboard and statistics tickets on the same company data (only the Data Analyst has them so far) */
  office?: { sheets: readonly SheetTemplate[]; cleaning: readonly CleanTemplate[]; dashboards: readonly DashboardTemplate[]; statistics: readonly StatsTemplate[] };
  /** detective and incident tickets: a fault planted in the user's data that they must find and measure */
  investigations?: readonly InvestigationTemplate[];
  /** the stories a sprint (one work week) can be about */
  stories: readonly Story[];
}

const BRIGHTCART_STORIES: readonly Story[] = [
  { title: "Festive-season prep", blurb: "The festive sales are weeks away. Sales, marketing and the category team all need numbers before they commit stock and ad spend." },
  { title: "Month-end close", blurb: "Finance is closing the books. Every number has to tie out, and every odd record has to be explained or fixed." },
  { title: "Board review week", blurb: "The board meets on Friday. Leadership wants clear answers on growth, loyalty and what is slowing us down." },
  { title: "Win back the quiet customers", blurb: "Marketing has noticed buyers drifting away. The team needs to know who, how many, and what they were worth." },
  { title: "Tidy the warehouse before the audit", blurb: "Auditors arrive soon. Stale orders, messy city names and missing history all need cleaning up the right way." },
  { title: "Planning the next quarter", blurb: "Category managers are setting targets. They need trends, running totals and a trustworthy view of what really sells." },
];

const BRIGHTCART_SQLITE: World = { key: BRIGHTCART.key, name: BRIGHTCART.name, engine: "sqlite", generate: generateBrightCart, templates: BRIGHTCART_SQL_TEMPLATES, office: { sheets: SHEET_TEMPLATES, cleaning: CLEAN_TEMPLATES, dashboards: DASHBOARD_TEMPLATES, statistics: STATS_TEMPLATES }, investigations: INVESTIGATION_TEMPLATES, stories: BRIGHTCART_STORIES };
// the same company and the same data, on real PostgreSQL with its constraints, for the database roles
const BRIGHTCART_POSTGRES: World = {
  key: `${BRIGHTCART.key}-pg`, name: BRIGHTCART.name, engine: "postgres", setupSql: PG_WORLD_SETUP, generate: generateBrightCart, templates: BRIGHTCART_PG_TEMPLATES,
  // the BI Developer builds dashboards on the same company data; the other office tools are not enabled for these roles
  office: { sheets: [], cleaning: [], dashboards: DASHBOARD_TEMPLATES, statistics: [] }, stories: BRIGHTCART_STORIES,
};

const WORLDS: Record<string, World> = {
  "data-analyst": BRIGHTCART_SQLITE,
  "sql-developer": BRIGHTCART_POSTGRES,
  "database-admin": BRIGHTCART_POSTGRES,
  "bi-developer": BRIGHTCART_POSTGRES,
  "data-engineer-sql": BRIGHTCART_POSTGRES,
};

export const worldForRole = (roleKey: string | undefined): World | null => (roleKey ? (WORLDS[roleKey] ?? null) : null);

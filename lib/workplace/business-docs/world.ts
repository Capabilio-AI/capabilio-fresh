import type { World } from "../worlds";
import { KAVERI, generateKaveri } from "./kaveri";
import { BUSINESS_SQL_TEMPLATES } from "./sql-templates";
import { BUSINESS_SHEET_TEMPLATES } from "./sheet-templates";
import { BUSINESS_DASHBOARD_TEMPLATES } from "./dashboard-templates";

/**
 * The Business Analyst's company for the reused tools (SQL, spreadsheet, dashboard). Its templates belong only to the BA areas
 * (data-queries, business-metrics, reporting), so no other role's tickets can be served here. The requirement, process and gap
 * tickets live in ./templates.ts and do not need company data.
 */
export const KAVERI_WORLD: World = {
  key: KAVERI.key,
  name: KAVERI.name,
  engine: "sqlite",
  generate: generateKaveri,
  templates: BUSINESS_SQL_TEMPLATES,
  office: { sheets: BUSINESS_SHEET_TEMPLATES, cleaning: [], dashboards: BUSINESS_DASHBOARD_TEMPLATES, statistics: [] },
  stories: [
    { title: "Monthly business review", blurb: "Leadership reviews every branch against target on Friday. The numbers, the reasons and the next steps all need to be ready." },
    { title: "Warranty portal discovery", blurb: "Customer experience wants claims online. Stakeholders disagree on the rules, and the backlog has to be written before the build starts." },
    { title: "Fixing the slow repairs", blurb: "Repairs are breaching SLA in some cities. Map how a job really flows, find the gaps and measure the damage." },
    { title: "Budget season", blurb: "Marketing and finance are fighting over spend. They need ROI they both trust and a clear view of what each channel returns." },
  ],
};

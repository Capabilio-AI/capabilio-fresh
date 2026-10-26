import type { RoleToolkit } from "./types";

/** MBA-01 Business Analyst: what the student is told about the workstation before and during Arena work. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "business-analyst",
  roleId: "MBA-01",
  stream: "MBA",
  headline: "Turn messy stakeholder notes into a backlog, map the process, find the gaps, and back it with numbers from the company's data.",
  workstations: [
    {
      name: "Business Docs Studio",
      mirrors: ["Jira", "Confluence", "Lucidchart", "Visio"],
      toolType: "business_docs_workspace",
      tier: "A",
      runsIn: "browser",
      summary: "Write user stories with Given/When/Then criteria, flag duplicates and contradictions, trace tests, draw a process map, fill a RACI or a gap table; the server checks the rules.",
    },
    { name: "Excel workbook", mirrors: ["Microsoft Excel", "Google Sheets"], toolType: "spreadsheet_workspace", tier: "S", runsIn: "browser", summary: "Compute variance, SLA %, ROI and conversion with formulas on branch and campaign data." },
    { name: "BI workspace", mirrors: ["Power BI", "Tableau"], toolType: "dashboard_workspace", tier: "S", runsIn: "browser", summary: "Build the one chart that answers a stakeholder's question from a service-request report." },
    { name: "SQL workspace", mirrors: ["DBeaver", "Metabase"], toolType: "sql_workspace", tier: "R", runsIn: "server", summary: "Query targets, campaigns and service requests to answer KPI questions." },
  ],
  environment: [
    { label: "Company data", detail: "Kaveri Appliance Care (fictional): 8 branches, monthly targets and actuals, 30 marketing campaigns, 200 service requests. Different numbers for every student." },
    { label: "Stakeholder notes", detail: "Numbered statements from named people at fictional Indian companies, with opinions, vague asks, repeats and a contradiction mixed in." },
    { label: "Team lists", detail: "The owners you may assign to steps, gaps and RACI letters are given with each ticket." },
  ],
  firstWeek: [
    "Turn reschedule-meeting notes into user stories with testable acceptance criteria.",
    "Map a loan application process with owners and a decision that rejoins.",
    "Find where an invoice process falls short of what finance wants, and only there.",
    "Work out target variance per branch in a spreadsheet.",
    "Query which region hit its revenue target.",
  ],
  portfolioArtifacts: ["Graded business documents (stories, process maps, RACI, gap tables) with per-check results", "Graded spreadsheet, dashboard and SQL tickets on the company data"],
  honestLimits: [
    "Documents are graded by structural and traceability rules, never by how well they are written.",
    "Requirement coverage is matched by cited note IDs plus a keyword; unusual wording can be missed.",
    "Live stakeholder interviews, workshops and presentations are not assessed.",
    "Only two business-docs tickets per area so far, easy and medium; no hard tickets yet.",
  ],
};

import type { RoleBlueprint } from "../blueprint";

/**
 * MBA-01 Business Analyst. Mirrors supabase/migrations/133_business_analyst_role.sql (NOT applied).
 *
 * - requirements / process-mapping / gap-analysis: Business Docs Studio. The student fills a structured document; the server checks structure,
 *   traceability and a hidden key (which notes are real requirements, the planted contradiction and duplicate, stated owners and decision rights).
 *   Prose quality is never graded. Mode "computed-key".
 * - business-metrics: the spreadsheet tool, formulas recalculated against values computed from the company data.
 * - reporting: the dashboard tool, the chart spec evaluated on the data.
 * - data-queries: the SQL tool, the student's query run and compared with the reference.
 */
export const BUSINESS_ANALYST: RoleBlueprint = {
  roleId: "MBA-01",
  domainRoleKey: "business-analyst",
  name: "Business Analyst",
  competencies: [
    { id: "ba.requirements", label: "Eliciting requirements from stakeholder notes (coverage, duplicates, contradictions)" },
    { id: "ba.stories", label: "User stories and testable acceptance criteria" },
    { id: "ba.traceability", label: "Requirement-to-test traceability" },
    { id: "ba.process", label: "Process mapping (owners, decisions, flow)" },
    { id: "ba.raci", label: "Decision rights and RACI" },
    { id: "ba.gap", label: "Gap analysis (as-is versus to-be)" },
    { id: "ba.kpi", label: "KPIs, variance and ROI" },
    { id: "ba.reporting", label: "Reporting and dashboards" },
    { id: "ba.sql", label: "Querying business data with SQL" },
  ],
  unassessed: [
    { id: "ba.facilitation", label: "Running workshops and interviewing stakeholders live" },
    { id: "ba.writing", label: "Quality of written prose (BRDs, emails, presentations)" },
    { id: "ba.recommendation", label: "Persuasive business recommendations" },
  ],
  areas: [
    { areaKey: "requirements", toolType: "business_docs_workspace", generationVersion: "business_docs.gen.v1", gradingVersion: "business_docs.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ba.requirements", "ba.stories", "ba.traceability"] },
    { areaKey: "process-mapping", toolType: "business_docs_workspace", generationVersion: "business_docs.gen.v1", gradingVersion: "business_docs.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ba.process", "ba.raci"] },
    { areaKey: "gap-analysis", toolType: "business_docs_workspace", generationVersion: "business_docs.gen.v1", gradingVersion: "business_docs.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ba.gap", "ba.requirements"] },
    { areaKey: "business-metrics", toolType: "spreadsheet_workspace", generationVersion: "spreadsheet.gen.v1", gradingVersion: "spreadsheet.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["ba.kpi"] },
    { areaKey: "reporting", toolType: "dashboard_workspace", generationVersion: "dashboard.gen.v1", gradingVersion: "dashboard.grade.v1", executionMode: "evaluated-spec", status: "enabled", competencies: ["ba.reporting", "ba.kpi"] },
    { areaKey: "data-queries", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["ba.sql", "ba.kpi"] },
  ],
  limitations: [
    "Business documents are checked by rules (story form, Given/When/Then, numbers behind vague words, coverage by note ID plus a keyword, one Accountable per task, rejoining branches), not by reading quality. A student can satisfy the rules with weak wording; the explain-your-work interview is the only check on judgement.",
    "Coverage is matched by the note IDs a story cites and a keyword from the note, so an unusual synonym can be marked as not covering a requirement.",
    "Business-docs tickets are fixed: two per area, so a student can see the same ticket again.",
    "Spreadsheet, dashboard and SQL tickets need the Kaveri world registered in lib/workplace/worlds/index.ts; without it those tools fall back to AI generation.",
  ],
};

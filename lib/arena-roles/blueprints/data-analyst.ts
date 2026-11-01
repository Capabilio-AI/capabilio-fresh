import type { RoleBlueprint } from "../blueprint";

/**
 * IT-01 Data Analyst. `domainRoleKey`, area keys, tools and versions mirror the live `arena_skill_areas` rows (checked 2026-10-22); the test in
 * blueprint.test.ts fails if a tool's registered versions drift from what is declared here.
 *
 * Execution modes are stated as they really are:
 * - "executed": the student's own query/work is run and its output compared with the server's.
 * - "computed-key": the server derives the expected answer from the task parameters and checks the submission against it. Student work is
 *   not executed as code.
 * - "client-run": the student's code runs in their browser; the server grades the numbers they send against a key it never shipped.
 * - "evaluated-spec": a structured spec is evaluated on the dataset and compared with the expected series.
 */
export const DATA_ANALYST: RoleBlueprint = {
  roleId: "IT-01",
  domainRoleKey: "data-analyst",
  name: "Data Analyst",
  competencies: [
    { id: "da.sql", label: "SQL querying and analytical reasoning" },
    { id: "da.cleaning", label: "Data profiling, cleaning and validation" },
    { id: "da.spreadsheet", label: "Spreadsheet analysis" },
    { id: "da.metrics", label: "Business metrics and KPI interpretation" },
    { id: "da.statistics", label: "Statistical reasoning" },
    { id: "da.bi", label: "BI dashboards and reporting" },
    { id: "da.root_cause", label: "Root-cause investigation" },
    { id: "da.anomaly", label: "Data quality and anomaly detection" },
    { id: "da.communication", label: "Communicating evidence-based findings" },
    { id: "da.python", label: "Data analysis in Python (pandas)" },
    { id: "da.dax", label: "DAX measures: CALCULATE, filter context, ratios" },
    { id: "da.pivot", label: "PivotTables and multi-criteria summaries" },
  ],
  areas: [
    { areaKey: "sql", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["da.sql", "da.metrics"] },
    { areaKey: "debugging", toolType: "sql_workspace", generationVersion: "sql.gen.v1", gradingVersion: "sql.grade.v1", executionMode: "executed", status: "enabled", competencies: ["da.sql"] },
    { areaKey: "spreadsheet", toolType: "spreadsheet_workspace", generationVersion: "spreadsheet.gen.v1", gradingVersion: "spreadsheet.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["da.spreadsheet", "da.metrics", "da.pivot"] },
    { areaKey: "dashboard", toolType: "dashboard_workspace", generationVersion: "dashboard.gen.v1", gradingVersion: "dashboard.grade.v1", executionMode: "evaluated-spec", status: "enabled", competencies: ["da.bi", "da.metrics", "da.dax"] },
    { areaKey: "statistics", toolType: "statistics_workspace", generationVersion: "statistics.gen.v1", gradingVersion: "statistics.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["da.statistics"] },
    { areaKey: "data_cleaning", toolType: "cleaning_workspace", generationVersion: "cleaning.gen.v1", gradingVersion: "cleaning.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["da.cleaning", "da.anomaly"] },
    { areaKey: "investigation", toolType: "investigation_workspace", generationVersion: "investigation.gen.v1", gradingVersion: "investigation.grade.v1", executionMode: "executed", status: "enabled", competencies: ["da.root_cause", "da.anomaly", "da.communication"] },
    { areaKey: "incident", toolType: "investigation_workspace", generationVersion: "investigation.gen.v1", gradingVersion: "investigation.grade.v1", executionMode: "executed", status: "enabled", competencies: ["da.root_cause", "da.communication"] },
    { areaKey: "python", toolType: "ml_workspace", generationVersion: "ml.gen.v1", gradingVersion: "ml.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["da.python", "da.cleaning", "da.metrics"] },
  ],
  // Honest limits: these are graded through findings, not free-text quality.
  limitations: [
    "da.communication: from junior level up, the note to the requester is graded against the real answer (states the key figure, names where it is, says what to do next, 20 to 150 words). These are number and keyword checks, not a judgement of writing quality; the explain-your-work interview is the other signal.",
    "Excel is assessed on formulas (SUMIFS, COUNTIFS, INDEX/MATCH, XLOOKUP, MEDIAN, STDEV) and PivotTables built from a field list; there is no chart or macro grading.",
    "Python runs in the student's own browser (Pyodide), never on our servers. Only the numbers they report are graded, not their code, so code style is not assessed.",
    "Dashboard grading compares the series a chart plots, not visual design. The builder covers quick measures and DAX basics (CALCULATE, ALL, DIVIDE, SUMX and filter context) but no data model or relationships, so the skill proven is writing measures and charts from a brief, not designing a model.",
  ],
};

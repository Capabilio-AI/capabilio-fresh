import { BRIGHTCART_SQL_TEMPLATES } from "@/lib/workplace/tickets";
import { BRIGHTCART_PG_TEMPLATES } from "@/lib/workplace/tickets/pg-index";
import { PIPELINE_TEMPLATES } from "@/lib/workplace/pipeline/templates";
import { DEVOPS_TEMPLATES } from "@/lib/workplace/devops/tickets";
import { FRONTEND_TEMPLATES } from "@/lib/workplace/frontend/tickets";
import { CLEAN_TEMPLATES } from "@/lib/workplace/office/clean-templates";
import { STATS_TEMPLATES } from "@/lib/workplace/office/stats-templates";
import { SHEET_TEMPLATES } from "@/lib/workplace/office/sheet-templates";
import { DASHBOARD_TEMPLATES } from "@/lib/workplace/office/dashboard-templates";
import { DS_STATS_TEMPLATES, DS_STORY_TEMPLATES } from "@/lib/workplace/data-science/world-templates";
import { DATA_SCIENCE_ML_TEMPLATES } from "@/lib/workplace/data-science/ml-templates";
import { INVESTIGATION_TEMPLATES } from "@/lib/workplace/investigate/templates";
import { SOC_TEMPLATES } from "@/lib/workplace/soc/templates";
import { ML_ENGINEER_TEMPLATES } from "@/lib/workplace/ml-engineer/tickets";
import { ML_TEMPLATES } from "@/lib/workplace/ml/tickets";
import { CALC_TEMPLATES } from "@/lib/workplace/calc/templates-index";
import { APP_DEV_FRONTEND_TEMPLATES } from "@/lib/workplace/application-developer/frontend-templates";
import { APP_DEV_SQL_TEMPLATES } from "@/lib/workplace/application-developer/sql-templates";
import { APP_DEV_DEVOPS_TEMPLATES } from "@/lib/workplace/application-developer/devops-templates";
import { BUSINESS_SQL_TEMPLATES } from "@/lib/workplace/business-docs/sql-templates";
import { BUSINESS_DOCS_TEMPLATES } from "@/lib/workplace/business-docs/templates";
import { BUSINESS_DASHBOARD_TEMPLATES } from "@/lib/workplace/business-docs/dashboard-templates";
import { BUSINESS_SHEET_TEMPLATES } from "@/lib/workplace/business-docs/sheet-templates";
import { ANALYST_PYTHON_TEMPLATES } from "@/lib/workplace/analyst-python/templates";
import { CODE_PROBLEMS } from "@/lib/workplace/code/problems";
import { APP_DEV_CODE_PROBLEMS } from "@/lib/workplace/application-developer/code-problems";
import { EMBEDDED_CODE_PROBLEMS } from "@/lib/workplace/embedded/code-problems";
import { IOT_CODE_PROBLEMS } from "@/lib/workplace/iot/code-problems";
import { PLC_CODE_PROBLEMS } from "@/lib/workplace/plc/code-problems";

/**
 * Every ticket template written in code, in one list, so coverage can be counted. Each source is a different shape; they all carry an id, an area list,
 * a difficulty and a minimum level, and that is all the registry keeps. A template source added elsewhere must be added here, or its tasks stay
 * invisible to the audit (the test below fails if a source is empty or has a duplicate id, not if one is missing: the audit lists areas that no
 * source covers, which is how a forgotten source shows up).
 */
export interface RegisteredTemplate {
  /** the source list, for finding where a template lives */
  source: string;
  id: string;
  areas: readonly string[];
  difficulty: string;
  minLevel: string;
}

interface Shape { id: string; areas?: readonly string[]; difficulty: string; minLevel: string }
const from = (source: string, list: readonly Shape[], defaultArea?: string): RegisteredTemplate[] =>
  list.map((t) => ({ source, id: t.id, areas: t.areas ?? (defaultArea ? [defaultArea] : []), difficulty: t.difficulty, minLevel: t.minLevel }));

export const TEMPLATE_REGISTRY: readonly RegisteredTemplate[] = [
  // the Data Analyst SQL tickets that name no area are the SQL area (see lib/workplace/tickets/coverage.test.ts)
  ...from("brightcart-sql", BRIGHTCART_SQL_TEMPLATES, "sql"),
  ...from("brightcart-pg", BRIGHTCART_PG_TEMPLATES, "sql"),
  ...from("pipeline", PIPELINE_TEMPLATES),
  ...from("devops", DEVOPS_TEMPLATES),
  ...from("frontend", FRONTEND_TEMPLATES),
  ...from("office-clean", CLEAN_TEMPLATES),
  ...from("office-stats", STATS_TEMPLATES),
  ...from("office-sheet", SHEET_TEMPLATES),
  ...from("office-dashboard", DASHBOARD_TEMPLATES),
  ...from("ds-stats", DS_STATS_TEMPLATES),
  ...from("ds-story", DS_STORY_TEMPLATES),
  ...from("ds-ml", DATA_SCIENCE_ML_TEMPLATES),
  ...from("investigation", INVESTIGATION_TEMPLATES),
  ...from("soc", SOC_TEMPLATES),
  ...from("ml-engineer", ML_ENGINEER_TEMPLATES),
  ...from("ml", ML_TEMPLATES),
  ...from("calc", CALC_TEMPLATES),
  ...from("appdev-frontend", APP_DEV_FRONTEND_TEMPLATES),
  ...from("appdev-sql", APP_DEV_SQL_TEMPLATES),
  ...from("appdev-devops", APP_DEV_DEVOPS_TEMPLATES),
  ...from("business-sql", BUSINESS_SQL_TEMPLATES),
  ...from("business-docs", BUSINESS_DOCS_TEMPLATES),
  ...from("business-dashboard", BUSINESS_DASHBOARD_TEMPLATES),
  ...from("business-sheet", BUSINESS_SHEET_TEMPLATES),
  ...from("analyst-python", ANALYST_PYTHON_TEMPLATES),
  ...from("code-problems", CODE_PROBLEMS),
  ...from("appdev-code", APP_DEV_CODE_PROBLEMS),
  ...from("embedded-code", EMBEDDED_CODE_PROBLEMS),
  ...from("iot-code", IOT_CODE_PROBLEMS),
  ...from("plc-code", PLC_CODE_PROBLEMS),
];

/** Pure. How many registered templates serve each area key (a template listing several areas counts once in each). */
export function templatesPerArea(registry: readonly RegisteredTemplate[] = TEMPLATE_REGISTRY): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of registry) for (const a of new Set(t.areas)) out.set(a, (out.get(a) ?? 0) + 1);
  return out;
}

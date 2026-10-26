"use client";

import type { ComponentType } from "react";
import { BusinessDocsTool } from "./BusinessDocsTool";
import { CalcTool } from "./CalcTool";
import { CleaningTool } from "./CleaningTool";
import { CodeTool } from "./CodeTool";
import { ConfigTool } from "./ConfigTool";
import { DashboardTool } from "./DashboardTool";
import { InvestigationTool } from "./InvestigationTool";
import { MlTool } from "./MlTool";
import { PipelineTool } from "./PipelineTool";
import { SocTool } from "./SocTool";
import { SpreadsheetTool } from "./SpreadsheetTool";
import { SqlTool } from "./SqlTool";
import { StatisticsTool } from "./StatisticsTool";
import type { ToolProps } from "./useDraft";

// Client half of the single workstation registry (server half:
// lib/arena-workstations/registry.ts). tool_type → renderer.
export const WORKSTATIONS: Record<string, { label: string; component: ComponentType<ToolProps<never>> }> = {
  sql_workspace: { label: "SQL workspace", component: SqlTool as ComponentType<ToolProps<never>> },
  statistics_workspace: { label: "Statistics workspace", component: StatisticsTool as ComponentType<ToolProps<never>> },
  cleaning_workspace: { label: "Data prep workspace", component: CleaningTool as ComponentType<ToolProps<never>> },
  dashboard_workspace: { label: "BI workspace", component: DashboardTool as ComponentType<ToolProps<never>> },
  investigation_workspace: { label: "Investigation workspace", component: InvestigationTool as ComponentType<ToolProps<never>> },
  code_workspace: { label: "Code editor", component: CodeTool as ComponentType<ToolProps<never>> },
  devops_workspace: { label: "Config editor", component: ConfigTool as ComponentType<ToolProps<never>> },
  frontend_workspace: { label: "Frontend editor", component: ConfigTool as ComponentType<ToolProps<never>> },
  ml_workspace: { label: "ML notebook", component: MlTool as ComponentType<ToolProps<never>> },
  calc_workspace: { label: "Calculation worksheet", component: CalcTool as ComponentType<ToolProps<never>> },
  business_docs_workspace: { label: "Business Docs Studio", component: BusinessDocsTool as ComponentType<ToolProps<never>> },
  pipeline_workspace: { label: "Pipeline Lab", component: PipelineTool as ComponentType<ToolProps<never>> },
  soc_workspace: { label: "SOC console", component: SocTool as ComponentType<ToolProps<never>> },
  spreadsheet_workspace: { label: "Excel workbook", component: SpreadsheetTool as ComponentType<ToolProps<never>> },
};

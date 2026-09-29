"use client";

import type { ComponentType } from "react";
import { CleaningTool } from "./CleaningTool";
import { DashboardTool } from "./DashboardTool";
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
  spreadsheet_workspace: { label: "Excel workbook", component: SpreadsheetTool as ComponentType<ToolProps<never>> },
};

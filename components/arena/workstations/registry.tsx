"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ToolProps } from "./useDraft";

// Client half of the single workstation registry; each tool loads on demand (server half:
// lib/arena-workstations/registry.ts). tool_type → renderer.
export const WORKSTATIONS: Record<string, { label: string; component: ComponentType<ToolProps<never>> }> = {
  sql_workspace: { label: "SQL workspace", component: dynamic(() => import("./SqlTool").then((m) => m.SqlTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  statistics_workspace: { label: "Statistics workspace", component: dynamic(() => import("./StatisticsTool").then((m) => m.StatisticsTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  cleaning_workspace: { label: "Data prep workspace", component: dynamic(() => import("./CleaningTool").then((m) => m.CleaningTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  dashboard_workspace: { label: "BI workspace", component: dynamic(() => import("./DashboardTool").then((m) => m.DashboardTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  investigation_workspace: { label: "Investigation workspace", component: dynamic(() => import("./InvestigationTool").then((m) => m.InvestigationTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  code_workspace: { label: "Code editor", component: dynamic(() => import("./CodeTool").then((m) => m.CodeTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  devops_workspace: { label: "Config editor", component: dynamic(() => import("./ConfigTool").then((m) => m.ConfigTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  frontend_workspace: { label: "Frontend editor", component: dynamic(() => import("./ConfigTool").then((m) => m.ConfigTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  ml_workspace: { label: "ML notebook", component: dynamic(() => import("./MlTool").then((m) => m.MlTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  calc_workspace: { label: "Calculation worksheet", component: dynamic(() => import("./CalcTool").then((m) => m.CalcTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  business_docs_workspace: { label: "Business Docs Studio", component: dynamic(() => import("./BusinessDocsTool").then((m) => m.BusinessDocsTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  pipeline_workspace: { label: "Pipeline Lab", component: dynamic(() => import("./PipelineTool").then((m) => m.PipelineTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  soc_workspace: { label: "SOC console", component: dynamic(() => import("./SocTool").then((m) => m.SocTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
  spreadsheet_workspace: { label: "Excel workbook", component: dynamic(() => import("./SpreadsheetTool").then((m) => m.SpreadsheetTool as ComponentType<ToolProps<never>>), { ssr: false }) as ComponentType<ToolProps<never>> },
};

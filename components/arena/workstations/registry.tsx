"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { ToolProps } from "./useDraft";

const RELOAD_KEY = "capabilio:tool-reload";

/**
 * Shown when a workspace's code cannot be fetched, which happens when a deploy replaces the files under a page that is already open: the old page asks for a
 * file that no longer exists and, with nothing to catch it, simply does nothing. Reloading fixes it, so do that once automatically, and if it still fails say
 * so plainly instead of leaving the student clicking a button that does nothing.
 */
function ToolLoadFailed() {
  // this component only ever renders in the browser (the tools are client-only), so the guard can be read while rendering
  const [auto] = useState(() => {
    try {
      return !window.sessionStorage.getItem(RELOAD_KEY);
    } catch {
      return false; // storage blocked: show the button instead of risking a reload loop
    }
  });
  useEffect(() => {
    if (!auto) return;
    try {
      window.sessionStorage.setItem(RELOAD_KEY, "1");
    } catch {
      return;
    }
    window.location.reload();
  }, [auto]);
  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-app-border bg-white p-6 text-center">
      <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{auto ? "Updating your workspace…" : "This workspace could not be loaded"}</p>
      {!auto && (
        <>
          <p className="mt-1 font-lp-body text-[13px] text-app-muted">Capabilio was updated while this page was open, or your connection dropped. Reload to continue; your work on this ticket is saved on this device.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white">Reload</button>
        </>
      )}
    </div>
  );
}

/** A workspace loaded on demand. A successful load clears the one-reload guard; a failed one shows ToolLoadFailed instead of nothing. */
export function lazyTool(load: () => Promise<ComponentType<ToolProps<never>>>): ComponentType<ToolProps<never>> {
  return dynamic(
    () =>
      load().then(
        (component) => {
          try {
            window.sessionStorage.removeItem(RELOAD_KEY);
          } catch {
            // storage blocked
          }
          return component;
        },
        () => ToolLoadFailed as ComponentType<ToolProps<never>>
      ),
    { ssr: false }
  ) as ComponentType<ToolProps<never>>;
}

// Client half of the single workstation registry; each tool loads on demand (server half:
// lib/arena-workstations/registry.ts). tool_type → renderer.
export const WORKSTATIONS: Record<string, { label: string; component: ComponentType<ToolProps<never>> }> = {
  sql_workspace: { label: "SQL workspace", component: lazyTool(() => import("./SqlTool").then((m) => m.SqlTool as ComponentType<ToolProps<never>>)) },
  statistics_workspace: { label: "Statistics workspace", component: lazyTool(() => import("./StatisticsTool").then((m) => m.StatisticsTool as ComponentType<ToolProps<never>>)) },
  cleaning_workspace: { label: "Data prep workspace", component: lazyTool(() => import("./CleaningTool").then((m) => m.CleaningTool as ComponentType<ToolProps<never>>)) },
  dashboard_workspace: { label: "BI workspace", component: lazyTool(() => import("./DashboardTool").then((m) => m.DashboardTool as ComponentType<ToolProps<never>>)) },
  investigation_workspace: { label: "Investigation workspace", component: lazyTool(() => import("./InvestigationTool").then((m) => m.InvestigationTool as ComponentType<ToolProps<never>>)) },
  code_workspace: { label: "Code editor", component: lazyTool(() => import("./CodeTool").then((m) => m.CodeTool as ComponentType<ToolProps<never>>)) },
  devops_workspace: { label: "Config editor", component: lazyTool(() => import("./ConfigTool").then((m) => m.ConfigTool as ComponentType<ToolProps<never>>)) },
  frontend_workspace: { label: "Frontend editor", component: lazyTool(() => import("./ConfigTool").then((m) => m.ConfigTool as ComponentType<ToolProps<never>>)) },
  ml_workspace: { label: "Python notebook", component: lazyTool(() => import("./MlTool").then((m) => m.MlTool as ComponentType<ToolProps<never>>)) },
  calc_workspace: { label: "Calculation worksheet", component: lazyTool(() => import("./CalcTool").then((m) => m.CalcTool as ComponentType<ToolProps<never>>)) },
  business_docs_workspace: { label: "Business Docs Studio", component: lazyTool(() => import("./BusinessDocsTool").then((m) => m.BusinessDocsTool as ComponentType<ToolProps<never>>)) },
  pipeline_workspace: { label: "Pipeline Lab", component: lazyTool(() => import("./PipelineTool").then((m) => m.PipelineTool as ComponentType<ToolProps<never>>)) },
  soc_workspace: { label: "SOC console", component: lazyTool(() => import("./SocTool").then((m) => m.SocTool as ComponentType<ToolProps<never>>)) },
  spreadsheet_workspace: { label: "Excel workbook", component: lazyTool(() => import("./SpreadsheetTool").then((m) => m.SpreadsheetTool as ComponentType<ToolProps<never>>)) },
};

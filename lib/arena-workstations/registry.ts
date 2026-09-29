import { cleaningTool } from "./tools/cleaning";
import { dashboardTool } from "./tools/dashboard";
import { spreadsheetTool } from "./tools/spreadsheet";
import { sqlTool } from "./tools/sql";
import { statisticsTool } from "./tools/statistics";
import type { ToolDefinition } from "./types";

// The single workstation registry (server side): tool type → generation
// contract, validator, answer-key builder and grader. The client-side
// renderer registry lives in components/arena/workstations/registry.tsx.
// `python_workspace` is deliberately absent: its skill area is disabled
// until an isolated executor exists (docs/workstation-progress.md).
const TOOLS: Record<string, ToolDefinition<unknown>> = Object.fromEntries(
  [sqlTool, statisticsTool, cleaningTool, dashboardTool, spreadsheetTool].map((t) => [t.toolType, t as ToolDefinition<unknown>])
);

export function toolFor(toolType: string): ToolDefinition<unknown> {
  const tool = TOOLS[toolType];
  if (!tool) throw new Error(`No workstation registered for tool type ${toolType}`);
  return tool;
}

export function isRegisteredTool(toolType: string): boolean {
  return toolType in TOOLS;
}

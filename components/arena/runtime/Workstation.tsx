"use client";

import type { RuntimeType } from "@/lib/arena-runtime/types";
import type { ComponentType } from "react";
import { CalculationWorksheet } from "./CalculationWorksheet";
import { CodeEditorPreview } from "./CodeEditorPreview";
import { NotebookPython } from "./NotebookPython";
import { QuestionFlow } from "./QuestionFlow";
import { SqlConsole } from "./SqlConsole";
import type { RuntimeProps } from "./types";

// The client-side half of the runtime registry (lib/arena-runtime/registry.ts holds the descriptors). A challenge only names its runtime type.
const WORKSTATIONS: Partial<Record<RuntimeType, ComponentType<RuntimeProps>>> = {
  QUESTION_FLOW: QuestionFlow,
  CALCULATION_WORKSHEET: CalculationWorksheet,
  SQL_CONSOLE: SqlConsole,
  CODE_EDITOR_PREVIEW: CodeEditorPreview,
  NOTEBOOK_PYTHON: NotebookPython,
};

export function Workstation({ runtimeType, ...props }: RuntimeProps & { runtimeType: RuntimeType }) {
  const Component = WORKSTATIONS[runtimeType];
  if (!Component) return <p className="font-lp-body text-[13px] text-app-muted">This workstation isn&apos;t available yet.</p>;
  return <Component {...props} />;
}

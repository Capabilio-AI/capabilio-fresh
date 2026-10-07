import { z } from "zod";
import type { RuntimeType, Verification } from "./types";

// Pyodide-provided packages a notebook may load; nothing is ever pip-installed from the network.
export const NOTEBOOK_PACKAGES = ["numpy", "pandas", "scipy", "scikit-learn", "matplotlib"] as const;

const CodeEditorConfig = z.object({
  framework: z.enum(["vanilla", "react"]),
  entry: z.string().min(1),
  showPreview: z.boolean().default(true),
});
const NotebookConfig = z.object({
  packages: z.array(z.enum(NOTEBOOK_PACKAGES)).default([]),
  evaluationHarness: z.string().min(1),
});
const SqlConfig = z.object({
  engine: z.literal("sqlite").default("sqlite"),
  showSchema: z.boolean().default(true),
  maxRows: z.number().int().min(1).max(500).default(500),
});
const TerminalConfig = z.object({ image: z.string().min(1) });
const SimulatorConfig = z.object({
  simulator: z.string().min(1),
  // A simulator may only be embedded once its licence/embedding terms were checked and recorded by a person.
  licenceVerified: z.literal(true),
  licenceNote: z.string().min(1),
});
const WorksheetConfig = z.object({
  inputs: z
    .array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_]*$/), label: z.string().min(1), unit: z.string().min(1) }))
    .min(1),
});
const QuestionFlowConfig = z.object({ shuffle: z.boolean().default(false) });

export interface RuntimeDescriptor {
  runtimeType: RuntimeType;
  label: string;
  /** "planned" runtimes may be configured but are never startable until built and enabled */
  status: "available" | "planned";
  /** how a check of this runtime is verified unless the check says otherwise */
  defaultVerification: Verification;
  executesUserCode: boolean;
  requiresDesktop: boolean;
  configSchema: z.ZodType;
}

export const RUNTIMES: Record<RuntimeType, RuntimeDescriptor> = {
  QUESTION_FLOW: { runtimeType: "QUESTION_FLOW", label: "Scenario questions", status: "available", defaultVerification: "SERVER", executesUserCode: false, requiresDesktop: false, configSchema: QuestionFlowConfig },
  CALCULATION_WORKSHEET: { runtimeType: "CALCULATION_WORKSHEET", label: "Calculation worksheet", status: "available", defaultVerification: "SERVER", executesUserCode: false, requiresDesktop: false, configSchema: WorksheetConfig },
  SQL_CONSOLE: { runtimeType: "SQL_CONSOLE", label: "SQL console", status: "available", defaultVerification: "SERVER", executesUserCode: true, requiresDesktop: true, configSchema: SqlConfig },
  CODE_EDITOR_PREVIEW: { runtimeType: "CODE_EDITOR_PREVIEW", label: "Code editor with live preview", status: "available", defaultVerification: "CLIENT", executesUserCode: true, requiresDesktop: true, configSchema: CodeEditorConfig },
  NOTEBOOK_PYTHON: { runtimeType: "NOTEBOOK_PYTHON", label: "Python notebook", status: "available", defaultVerification: "CLIENT", executesUserCode: true, requiresDesktop: true, configSchema: NotebookConfig },
  TERMINAL_VM: { runtimeType: "TERMINAL_VM", label: "Sandboxed terminal", status: "planned", defaultVerification: "SERVER", executesUserCode: true, requiresDesktop: true, configSchema: TerminalConfig },
  SIMULATOR: { runtimeType: "SIMULATOR", label: "Engineering simulator", status: "planned", defaultVerification: "CLIENT", executesUserCode: false, requiresDesktop: true, configSchema: SimulatorConfig },
};

export const ResourceLimits = z
  .object({
    memoryMb: z.number().int().min(16).max(4096),
    wallTimeSeconds: z.number().int().min(5).max(7200),
    cpuMillis: z.number().int().min(100).max(8000).optional(),
    // Egress is denied unless a host allow-list is given.
    networkEgress: z.enum(["deny", "allowlist"]).default("deny"),
    egressAllowlist: z.array(z.string().min(1)).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.networkEgress === "allowlist" && v.egressAllowlist.length === 0) ctx.addIssue({ code: "custom", message: "networkEgress 'allowlist' needs at least one host.", path: ["egressAllowlist"] });
    if (v.networkEgress === "deny" && v.egressAllowlist.length > 0) ctx.addIssue({ code: "custom", message: "An egress allow-list is only valid with networkEgress 'allowlist'.", path: ["egressAllowlist"] });
  });

export interface TemplateInput {
  runtimeType: RuntimeType;
  config: unknown;
  resourceLimits: unknown;
}

export type TemplateValidation = { ok: true; config: unknown; resourceLimits: z.infer<typeof ResourceLimits> | null } | { ok: false; errors: string[] };

const describe = (e: z.ZodError, prefix: string) => e.issues.map((i) => `${prefix}${i.path.length ? `.${i.path.join(".")}` : ""}: ${i.message}`);

/** Pure. Config must satisfy its runtime's schema; any runtime that executes user code must declare resource limits. */
export function validateTemplate(input: TemplateInput): TemplateValidation {
  const runtime = RUNTIMES[input.runtimeType];
  if (!runtime) return { ok: false, errors: [`Unknown runtime type ${String(input.runtimeType)}.`] };

  const errors: string[] = [];
  const config = runtime.configSchema.safeParse(input.config);
  if (!config.success) errors.push(...describe(config.error, "config"));

  const limitsGiven = input.resourceLimits != null && Object.keys(input.resourceLimits as object).length > 0;
  let limits: z.infer<typeof ResourceLimits> | null = null;
  if (limitsGiven) {
    const parsed = ResourceLimits.safeParse(input.resourceLimits);
    if (parsed.success) limits = parsed.data;
    else errors.push(...describe(parsed.error, "resource_limits"));
  } else if (runtime.executesUserCode) {
    errors.push(`resource_limits: ${runtime.label} executes user code and must declare memoryMb and wallTimeSeconds.`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, config: (config as { data: unknown }).data, resourceLimits: limits };
}

import { SubmissionSchema, type CheckRow, type RunSql, type Submission } from "@/lib/arena-challenges/checks";
import { gradeAttempt } from "@/lib/arena-challenges/grade";
import { RUNTIMES, validateTemplate } from "@/lib/arena-runtime/registry";
import type { CheckType, RuntimeType } from "@/lib/arena-runtime/types";
import type { ChallengeSpec, TemplateSpec } from "./spec";

/** Check types each workstation can actually collect. A challenge asking for anything else could never be passed. */
export const RUNTIME_CHECKS: Record<RuntimeType, CheckType[]> = {
  QUESTION_FLOW: ["CHOICE_ANSWER"],
  CALCULATION_WORKSHEET: ["NUMERIC_ANSWER"],
  SQL_CONSOLE: ["QUERY_RESULT"],
  CODE_EDITOR_PREVIEW: ["FILE_STATE", "DOM_ASSERTION", "TEST_RUN"],
  NOTEBOOK_PYTHON: ["NUMERIC_ANSWER", "OUTPUT_MATCH"],
  TERMINAL_VM: ["TERMINAL_OUTPUT", "FILE_STATE"],
  SIMULATOR: ["NUMERIC_ANSWER"],
};

export interface ValidationDeps {
  runSql: RunSql;
  /** runs Python source and returns stdout; absent where no interpreter is available */
  runPython?: (source: string) => Promise<{ stdout: string; error: string | null }>;
  templates: Map<string, TemplateSpec>;
  skillNames: ReadonlySet<string>;
  careerKeys: ReadonlySet<string>;
}

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** what a pass will be worth: VERIFIED_AUTOMATED only when every check is server-verifiable */
  evidenceStatus: "VERIFIED_AUTOMATED" | "UNVERIFIED" | null;
}

const asString = (v: unknown) => (typeof v === "string" ? v : "");
const pub = (c: ChallengeSpec["checks"][number]) => (c.config.public ?? {}) as Record<string, unknown>;

/** Static checks that need no execution: the template, what each check needs to be passable, and that references resolve. */
export function staticChecks(spec: ChallengeSpec, deps: Pick<ValidationDeps, "templates" | "skillNames" | "careerKeys">): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const template = deps.templates.get(spec.template);
  if (!template) errors.push(`Unknown workstation template "${spec.template}".`);
  else {
    const t = validateTemplate({ runtimeType: template.runtimeType, config: template.config, resourceLimits: template.resourceLimits });
    if (!t.ok) errors.push(...t.errors.map((e) => `template ${template.key}: ${e}`));
    if (RUNTIMES[template.runtimeType].status !== "available") warnings.push(`${template.runtimeType} is not available yet; this challenge cannot be started until it is.`);
    const allowed = RUNTIME_CHECKS[template.runtimeType];
    for (const c of spec.checks) if (!allowed.includes(c.type)) errors.push(`Check "${c.key}" is ${c.type}, which ${template.runtimeType} cannot collect (allowed: ${allowed.join(", ")}).`);
  }

  for (const s of spec.skills) if (!deps.skillNames.has(s)) errors.push(`Unknown or inactive skill "${s}".`);
  for (const c of spec.careers) if (!deps.careerKeys.has(c)) errors.push(`Unknown career "${c}".`);
  if (spec.track === "domain" && spec.branches.length) warnings.push("Branches are ignored on a domain challenge.");
  if (spec.track === "stream" && spec.careers.length) warnings.push("Careers are ignored on a stream challenge.");

  for (const c of spec.checks) {
    const p = pub(c);
    switch (c.type) {
      case "CHOICE_ANSWER": {
        const options = Array.isArray(p.options) ? p.options.map(String) : [];
        const correct = [c.config.correct].flat().map(String);
        if (!asString(p.prompt)) errors.push(`Check "${c.key}": config.public.prompt is required.`);
        if (options.length < 2) errors.push(`Check "${c.key}": config.public.options needs at least two options.`);
        if (correct.length === 0 || correct.some((a) => !options.includes(a))) errors.push(`Check "${c.key}": every correct answer must be one of the options.`);
        if (correct.length > 1 && p.multiple !== true) errors.push(`Check "${c.key}": several correct answers need config.public.multiple = true.`);
        break;
      }
      case "NUMERIC_ANSWER":
        if (typeof c.config.expected !== "number") errors.push(`Check "${c.key}": config.expected must be a number.`);
        if (!asString(p.label) && !c.label) errors.push(`Check "${c.key}": needs a label.`);
        break;
      case "QUERY_RESULT":
        if (!asString(c.config.groundTruthQuery)) errors.push(`Check "${c.key}": config.groundTruthQuery is required.`);
        if (!asString(spec.assets?.seedSql) && !asString(c.config.seedSql)) errors.push(`Check "${c.key}": the challenge needs assets.seedSql.`);
        break;
      case "FILE_STATE":
        if (!asString(c.config.path)) errors.push(`Check "${c.key}": config.path is required.`);
        else if (!(c.config.contains || c.config.regex || c.config.notContains)) errors.push(`Check "${c.key}": give contains, notContains or regex.`);
        break;
      case "DOM_ASSERTION":
        if (!asString((p.assert as { selector?: unknown } | undefined)?.selector)) errors.push(`Check "${c.key}": config.public.assert.selector is required.`);
        break;
      default:
        break;
    }
    if (template?.runtimeType === "NOTEBOOK_PYTHON" && !asString(p.variable)) errors.push(`Check "${c.key}": a notebook check needs config.public.variable.`);
    if (!c.visible && !c.label) warnings.push(`Check "${c.key}" is hidden and unlabeled.`);
  }
  return { errors, warnings };
}

/** Builds the Python program that runs the reference cells with the challenge's files in place, then prints each target variable. */
export function notebookProgram(spec: ChallengeSpec, cells: string[]): { source: string; targets: { key: string; variable: string }[] } {
  const files = Object.entries((spec.assets?.files ?? {}) as Record<string, string>);
  const targets = spec.checks.flatMap((c) => (asString(pub(c).variable) ? [{ key: c.key, variable: asString(pub(c).variable) }] : []));
  const prelude = files.map(([name, text]) => `open(${JSON.stringify(name)}, "w").write(${JSON.stringify(text)})`).join("\n");
  const harvest = targets.map((t) => `print("@@${t.key}=" + str(globals().get(${JSON.stringify(t.variable)})))`).join("\n");
  return { source: [prelude, ...cells, harvest].join("\n"), targets };
}

/** Turns the spec's reference (or wrong) solution into a Submission keyed by check key. For a notebook, runs its cells to get the answers. */
async function solutionToSubmission(spec: ChallengeSpec, solution: ChallengeSpec["reference"], deps: ValidationDeps, errors: string[]): Promise<Submission> {
  const answers: Record<string, string | number | string[]> = { ...solution.answers };
  if (solution.cells) {
    if (!deps.runPython) errors.push("This challenge's reference is a notebook, which needs Python here to be run; validate it with the CLI.");
    else {
      const { source, targets } = notebookProgram(spec, solution.cells);
      const out = await deps.runPython(source);
      if (out.error) errors.push(`The reference notebook failed to run: ${out.error}`);
      for (const t of targets) {
        const m = out.stdout.match(new RegExp(`^@@${t.key}=(.*)$`, "m"));
        if (m && m[1] !== "None") answers[t.key] = m[1];
      }
    }
  }
  return SubmissionSchema.parse({ answers, queries: solution.queries, terminal: solution.terminal, files: solution.files, reported: solution.reported });
}

/**
 * Proves a challenge can be passed and cannot be faked: the reference solution must pass EVERY check, a blank submission and the optional
 * `wrong` one must fail, a SQL ground truth must run and return rows, and a notebook's reference cells must run and produce the answers.
 */
export async function validateSpec(spec: ChallengeSpec, deps: ValidationDeps): Promise<ValidationReport> {
  const { errors, warnings } = staticChecks(spec, deps);
  if (errors.length) return { ok: false, errors, warnings, evidenceStatus: null };

  // grade with the spec's own check keys standing in for ids
  const rows: CheckRow[] = spec.checks.map((c) => ({ id: c.key, stepId: c.step ? String(c.step) : null, checkType: c.type, label: c.label, config: c.config, visible: c.visible, weight: c.weight, verification: c.verification }));
  const ctx = { assets: spec.assets, runSql: deps.runSql };
  const grade = (submission: Submission) => gradeAttempt({ checks: rows, submission, ctx, hintPenaltyPoints: 0, difficulty: spec.difficulty });

  for (const c of spec.checks.filter((c) => c.type === "QUERY_RESULT")) {
    const [truth] = await deps.runSql(asString(c.config.seedSql) || asString(spec.assets?.seedSql), [asString(c.config.groundTruthQuery)]);
    if (!truth || "error" in truth) errors.push(`Check "${c.key}": the ground-truth query fails: ${truth && "error" in truth ? truth.error : "no result"}`);
    else if (truth.rows.length === 0) errors.push(`Check "${c.key}": the ground-truth query returns no rows, so nothing can be compared.`);
  }
  if (errors.length) return { ok: false, errors, warnings, evidenceStatus: null };

  const reference = await solutionToSubmission(spec, spec.reference, deps, errors);
  if (errors.length) return { ok: false, errors, warnings, evidenceStatus: null };

  const good = await grade(reference);
  for (const o of good.outcomes) if (!o.passed) errors.push(`The reference solution fails check "${o.checkId}".`);
  if (good.evidenceStatus === "UNVERIFIED") warnings.push("A pass on this challenge is UNVERIFIED (some checks run only in the browser): it locks the challenge but earns no ELO, points or skill evidence.");

  const blank = await grade(SubmissionSchema.parse({}));
  if (blank.passed) errors.push("A blank submission passes — the checks are too weak.");
  for (const o of blank.outcomes) if (o.passed) warnings.push(`A blank submission already passes check "${o.checkId}".`);

  if (spec.wrong) {
    const wrong = await grade(await solutionToSubmission(spec, spec.wrong, deps, errors));
    if (wrong.passed) errors.push("The `wrong` submission passes — the checks do not catch it.");
  }
  return { ok: errors.length === 0, errors, warnings, evidenceStatus: errors.length ? null : good.evidenceStatus };
}

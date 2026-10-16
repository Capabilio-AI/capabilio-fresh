import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";
import { GenerationRejected, type GenerationContext } from "@/lib/arena-workstations/types";
import { MAX_SUBMISSIONS, type CheckResult, type ConfigFile, type FileDraft, type FileLanguage } from "./types";

const FILE_NAME = /^[A-Za-z0-9._][A-Za-z0-9._/-]{0,58}$/;

export interface Deps {
  llm<T>(prompt: string, system: string, schema: z.ZodType<T>): Promise<T>;
}
export const realDeps: Deps = { llm: (p, s, schema) => completeJson(p, s, schema, { task: "arena_task" }) };

/** Everything that differs between kinds of file task (DevOps config, frontend pages ...): the checks, how to run them, and the words. */
export interface FileTaskKit<K extends { label: string; file: string }> {
  languages: readonly [FileLanguage, ...FileLanguage[]];
  checkSchema: z.ZodType<K>;
  run(files: readonly ConfigFile[], checks: readonly K[]): CheckResult[];
  /** a problem when this check cannot apply to a file of this language, else null */
  fit(check: K, language: FileLanguage): string | null;
  /** a problem when the content is not valid for its language, else null */
  parses(language: FileLanguage, content: string): string | null;
  /** areas where the starter must be partly right (debugging) */
  debugAreas: readonly string[];
  system: string;
  solverSystem: string;
  brief(ctx: GenerationContext): string;
}

const SolverSchema = z.object({ files: z.array(z.object({ name: z.string().max(60), content: z.string().max(6000) })).min(1).max(4) });

function genSchema<K extends { label: string; file: string }>(kit: FileTaskKit<K>) {
  return z.object({
    title: z.string().min(8).max(90),
    requester_name: z.string().min(2).max(40),
    requester_title: z.string().min(2).max(60),
    scenario: z.string().min(40).max(600),
    deliverable: z.string().min(20).max(500),
    skill_tags: z.array(z.string().min(1).max(30)).min(1).max(5),
    files: z.array(z.object({ name: z.string().regex(FILE_NAME), language: z.enum(kit.languages), starter: z.string().min(1).max(6000), solution: z.string().min(1).max(6000) })).min(1).max(4),
    checks: z.array(kit.checkSchema).min(5).max(12),
  });
}
type Gen<K extends { label: string; file: string }> = z.infer<ReturnType<typeof genSchema<K>>>;

/** Throws GenerationRejected with the first reason the exercise is not fair. */
export async function validateFileTask<K extends { label: string; file: string }>(kit: FileTaskKit<K>, raw: Gen<K>, area: string, avoid: readonly string[], solve: (statement: string) => Promise<ConfigFile[]>): Promise<void> {
  if (avoid.some((t) => t.trim().toLowerCase() === raw.title.trim().toLowerCase())) throw new GenerationRejected("title repeats an earlier ticket");
  const names = raw.files.map((f) => f.name);
  if (new Set(names).size !== names.length) throw new GenerationRejected("file names repeat");
  if (new Set(raw.checks.map((c) => c.label)).size !== raw.checks.length) throw new GenerationRejected("check labels repeat");
  for (const c of raw.checks) {
    const f = raw.files.find((x) => x.name === c.file);
    if (!f) throw new GenerationRejected(`a check refers to a missing file: ${c.file}`);
    const misfit = kit.fit(c, f.language);
    if (misfit) throw new GenerationRejected(misfit);
  }
  for (const f of raw.files) {
    const bad = kit.parses(f.language, f.solution);
    if (bad) throw new GenerationRejected(`solution ${f.name} ${bad}`);
  }
  const answer = kit.run(raw.files.map((f) => ({ name: f.name, content: f.solution })), raw.checks);
  const miss = answer.find((r) => !r.passed);
  if (miss) throw new GenerationRejected(`the solution fails its own check: ${miss.label}`);
  const start = kit.run(raw.files.map((f) => ({ name: f.name, content: f.starter })), raw.checks).filter((r) => r.passed).length;
  if (raw.checks.length - start < 2) throw new GenerationRejected("the starter already meets nearly every check");
  if (kit.debugAreas.includes(area) && start < 1) throw new GenerationRejected("a debugging task's starter should be partly right");

  // an independent solver sees the task and the starter files, never the checks or the solution: if it cannot pass, the task is under-explained
  const statement = `Task: ${raw.title}\n${raw.scenario}\n${raw.deliverable}\nRequirements:\n${raw.checks.map((c) => `- ${c.label}`).join("\n")}\n\nFiles:\n${raw.files.map((f) => `=== ${f.name} ===\n${f.starter}`).join("\n")}`;
  const solved = await solve(statement);
  const second = kit.run(raw.files.map((f) => ({ name: f.name, content: solved.find((s) => s.name === f.name)?.content ?? "" })), raw.checks).find((r) => !r.passed);
  if (second) throw new GenerationRejected(`an independent solver could not satisfy: ${second.label}`);
}

/** One fresh exercise for this user's area and level, served only if its own solution passes its own checks and an independent solver agrees. */
export async function generateFileTask<K extends { label: string; file: string }>(kit: FileTaskKit<K>, ctx: GenerationContext, deps: Deps = realDeps, previousProblem?: string): Promise<FileDraft<K>> {
  const area = ctx.areaKey ?? "";
  const retry = previousProblem ? `\nYour previous attempt was rejected because: ${previousProblem}. Make sure every check is satisfied by your own solution this time, and keep the checks simple.` : "";
  const raw = await deps.llm(`Create the task.\n${kit.brief(ctx)}${retry}`, kit.system, genSchema(kit));
  await validateFileTask(kit, raw, area, ctx.avoidTitles, async (statement) => (await deps.llm(statement, kit.solverSystem, SolverSchema)).files);
  return {
    title: raw.title,
    requester: { name: raw.requester_name, title: raw.requester_title },
    scenario: raw.scenario,
    skillTags: raw.skill_tags,
    content: { files: raw.files.map((f) => ({ name: f.name, language: f.language, content: f.starter })), requirements: raw.checks.map((c) => c.label), deliverable: raw.deliverable, maxSubmissions: MAX_SUBMISSIONS },
    key: { checks: raw.checks as K[] },
  };
}

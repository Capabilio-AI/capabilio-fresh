import { z } from "zod";
import { CHECK_TYPES, RUNTIME_TYPES } from "@/lib/arena-runtime/types";

const key = z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/, "lowercase letters, digits and dashes");
const checkKey = z.string().regex(/^[a-z][a-z0-9_]{0,40}$/);

export const CheckSpec = z.object({
  key: checkKey,
  /** 1-based index into steps; omitted = not tied to a step */
  step: z.number().int().min(1).optional(),
  type: z.enum(CHECK_TYPES),
  label: z.string().min(1).max(200),
  /** expected values live here and never reach the browser, except `config.public` (prompt, options, units, assertions) */
  config: z.record(z.string(), z.unknown()).default({}),
  visible: z.boolean().default(true),
  weight: z.number().int().min(1).max(10).default(1),
  verification: z.enum(["SERVER", "CLIENT"]).default("SERVER"),
});

/** The reference solution is keyed by check key. For a notebook, `cells` are run to produce the answers. */
export const SolutionSpec = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])).default({}),
  queries: z.record(z.string(), z.string()).default({}),
  terminal: z.record(z.string(), z.string()).default({}),
  files: z.record(z.string(), z.string()).default({}),
  reported: z.record(z.string(), z.boolean()).default({}),
  cells: z.array(z.string()).optional(),
});

export const TemplateSpec = z.object({
  key: z.string().regex(/^[a-z0-9-]{2,60}$/),
  name: z.string().min(2).max(120),
  runtimeType: z.enum(RUNTIME_TYPES),
  description: z.string().max(600).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  tools: z.array(z.string()).default([]),
  resourceLimits: z.record(z.string(), z.unknown()).default({}),
  startupTimeEstimateS: z.number().int().min(0).optional(),
});
export type TemplateSpec = z.infer<typeof TemplateSpec>;

export const ChallengeSpec = z
  .object({
    key,
    specVersion: z.literal(1).default(1),
    track: z.enum(["stream", "domain"]),
    title: z.string().min(3).max(200),
    category: z.string().min(2).max(80),
    difficulty: z.enum(["easy", "medium", "hard"]),
    estMinutes: z.number().int().min(1).max(240),
    timeLimitMinutes: z.number().int().min(1).max(240).optional(),
    source: z.enum(["CAPABILIO", "COLLEGE", "MENTOR"]).default("CAPABILIO"),
    institutionId: z.string().uuid().optional(),
    isSeed: z.boolean().default(false),
    /** workstation template key */
    template: z.string().regex(/^[a-z0-9-]{2,60}$/),
    ticketBrief: z.string().min(20).max(8000),
    /** starter material the student sees (seed SQL, files, notebook cells, datasets); never answers */
    assets: z.record(z.string(), z.unknown()).nullable().default(null),
    /** canonical skill names */
    skills: z.array(z.string().min(1)).min(1),
    /** career keys (domain) */
    careers: z.array(z.string().min(1)).default([]),
    /** branch names as students record them, e.g. "Civil Engineering" (stream) */
    branches: z.array(z.string().min(1)).default([]),
    courseTags: z.array(z.string().min(1)).default([]),
    steps: z.array(z.object({ title: z.string().min(1).max(200), instruction: z.string().min(1).max(4000) })).min(1),
    checks: z.array(CheckSpec).min(1),
    hints: z.array(z.object({ body: z.string().min(1).max(2000), penalty: z.number().int().min(0).max(50).default(5) })).default([]),
    /** where the material comes from; required for seed content */
    provenance: z.object({ source: z.string().min(1), license: z.string().min(1), notes: z.string().optional() }).optional(),
    reference: SolutionSpec,
    /** an incorrect attempt that must FAIL (the blank submission is always tried too) */
    wrong: SolutionSpec.optional(),
  })
  .superRefine((s, ctx) => {
    const add = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
    if (s.track === "domain" && s.careers.length === 0) add("A domain challenge needs at least one career.", ["careers"]);
    if (s.track === "stream" && s.branches.length === 0) add("A stream challenge needs at least one branch.", ["branches"]);
    if (s.source === "COLLEGE" && !s.institutionId) add("A COLLEGE challenge needs an institutionId.", ["institutionId"]);
    if (s.isSeed && !s.provenance) add("Seed content must record its provenance (source and licence).", ["provenance"]);
    const seen = new Set<string>();
    s.checks.forEach((c, i) => {
      if (seen.has(c.key)) add(`Duplicate check key "${c.key}".`, ["checks", i, "key"]);
      seen.add(c.key);
      if (c.step !== undefined && c.step > s.steps.length) add(`Check "${c.key}" points at step ${c.step}, but there are ${s.steps.length}.`, ["checks", i, "step"]);
    });
  });
export type ChallengeSpec = z.infer<typeof ChallengeSpec>;

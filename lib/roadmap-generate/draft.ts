import { validateChildSkills, type ChildSkillSpec, type ExistingSkill } from "@/lib/roadmap-visual/skills-spec";
import { validateTemplateSpec, type TemplateSpec } from "@/lib/roadmap-visual/template-spec";
import type { RoadmapAnswer } from "./model";
import { childSkillsFrom, qualityErrors, toTemplateSpec } from "./normalize";

export const MAX_ROUNDS = 3;
const MAX_FEEDBACK = 14;

export interface Taxonomy {
  existing: ExistingSkill[];
  aliases: ReadonlySet<string>;
}

export interface Draft {
  spec: TemplateSpec;
  newSkills: ChildSkillSpec[];
  model: string;
  rounds: number;
  warnings: string[];
}

/** Pure. Every reason an answer cannot be saved, in the words fed back to the model. Empty means it can. */
export function judgeAnswer(answer: RoadmapAnswer, ctx: { careerKey: string; careerId: string; version: number; model: string; taxonomy: Taxonomy }): { errors: string[]; warnings: string[]; spec: TemplateSpec; newSkills: ChildSkillSpec[] } {
  const { taxonomy } = ctx;
  const newSkills = childSkillsFrom(answer, new Set(taxonomy.existing.map((s) => s.name)));
  const skillErrors = validateChildSkills(newSkills, taxonomy.existing, taxonomy.aliases);
  const spec = toTemplateSpec(answer, ctx);
  // the new skills will exist (active) by the time the roadmap is saved, so the roadmap may use them
  const status = new Map<string, "active" | "candidate" | "deprecated">(taxonomy.existing.map((s) => [s.name, s.status]));
  for (const s of newSkills) status.set(s.name, "active");
  const tree = validateTemplateSpec(spec, { skills: { statusByName: status }, careers: new Map([[ctx.careerKey, ctx.careerId]]) });
  const errors = [...skillErrors.errors, ...tree.errors, ...qualityErrors(spec)];
  return { errors, warnings: [...skillErrors.warnings, ...tree.warnings], spec, newSkills };
}

/**
 * Asks the model, judges the answer, and on rejection asks again with the exact problems, up to MAX_ROUNDS. The model's output only ever becomes
 * a roadmap through the same validator a person-authored one passes.
 */
export async function draftRoadmap(input: {
  careerKey: string;
  careerId: string;
  version: number;
  taxonomy: Taxonomy;
  ask: (feedback: string[]) => Promise<{ answer: RoadmapAnswer; model: string }>;
}): Promise<{ ok: true; draft: Draft } | { ok: false; errors: string[] }> {
  let feedback: string[] = [];
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const { answer, model } = await input.ask(feedback);
    const verdict = judgeAnswer(answer, { careerKey: input.careerKey, careerId: input.careerId, version: input.version, model, taxonomy: input.taxonomy });
    if (verdict.errors.length === 0) return { ok: true, draft: { spec: verdict.spec, newSkills: verdict.newSkills, model, rounds: round, warnings: verdict.warnings } };
    feedback = verdict.errors.slice(0, MAX_FEEDBACK);
    if (round === MAX_ROUNDS) return { ok: false, errors: verdict.errors.slice(0, 40) };
  }
  return { ok: false, errors: ["No answer."] };
}

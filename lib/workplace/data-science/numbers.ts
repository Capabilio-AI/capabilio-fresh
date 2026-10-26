import type { Rng } from "../rng";
import { MAX_SUBMISSIONS, MlRejected, type MlDraft, type Texts } from "../ml/tickets";

/** One number the learner reports, with the answer and how far off it may be. The answer and tolerance stay in the key; the learner sees only key, label and help. */
export interface NumberField {
  key: string;
  label: string;
  help?: string;
  value: number;
  tolerance: number;
}

export const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
export const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
/** standard normal draw (Box-Muller) */
export const normal = (rng: Rng) => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

/** A notebook ticket graded on numbers (ml_workspace "numbers" kind): every expected value is computed here from the generated data. */
export function numbersDraft(texts: Texts, o: { skillTags: string[]; files: { name: string; text: string }[]; starter: string; fields: NumberField[]; deliverable: string }): MlDraft {
  return {
    title: texts.title,
    requester: texts.requester,
    scenario: texts.scenario,
    skillTags: o.skillTags,
    content: {
      company: texts.company, kind: "numbers", files: o.files, starter: o.starter, maxSubmissions: MAX_SUBMISSIONS, deliverable: o.deliverable,
      fields: o.fields.map((f) => (f.help ? { key: f.key, label: f.label, help: f.help } : { key: f.key, label: f.label })),
    },
    key: {
      kind: "numbers",
      expected: Object.fromEntries(o.fields.map((f) => [f.key, f.value])),
      tolerance: Object.fromEntries(o.fields.map((f) => [f.key, f.tolerance])),
    },
  };
}

/** A fixed template must always produce a ticket: when one draw is ambiguous (for example a p-value right at 5%), draw fresh data. */
export const persist = (build: (rng: Rng) => MlDraft, tries = 8) => (rng: Rng): MlDraft => {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return build(rng);
    } catch (e) {
      if (!(e instanceof MlRejected)) throw e;
      last = e;
    }
  }
  throw last;
};

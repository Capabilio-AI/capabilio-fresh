import type { Rng } from "../rng";
import { accuracy, confusion, recall } from "../ml/metrics";
import { MAX_SUBMISSIONS, MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";

// Error analysis: a headline metric hides a segment where the model fails. The learner slices the results and finds it. One segment is built to be
// clearly worst, and the build is rejected if the generated rows do not make that unambiguous.

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const MARGIN = 0.03;

/** Accuracy by store: one store is much worse than the rest. */
export function buildSlices(rng: Rng, texts: Texts): MlDraft {
  const stores = rng.shuffle([101, 102, 103, 104, 105, 106, 107]).slice(0, 5).sort((a, b) => a - b);
  const weak = rng.pick(stores);
  const rows = stores.flatMap((store) => {
    const right = store === weak ? 0.55 + rng.next() * 0.1 : 0.84 + rng.next() * 0.1;
    return Array.from({ length: rng.int(80, 120) }, () => {
      const actual = rng.chance(0.4) ? 1 : 0;
      return [store, actual, rng.chance(right) ? actual : 1 - actual];
    });
  });
  const acc = (rs: number[][]) => accuracy(confusion(rs.map((r) => r[1]), rs.map((r) => r[2])));
  const byStore = stores.map((s) => ({ s, a: acc(rows.filter((r) => r[0] === s)) })).sort((x, y) => x.a - y.a);
  if (byStore[0].s !== weak || byStore[1].a - byStore[0].a < MARGIN) throw new MlRejected("no clearly worst store");
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Error analysis", "Slice metrics", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "results.csv", text: csv(["store_code", "actual", "predicted"], rng.shuffle(rows)) }],
      starter: `import pandas as pd

r = pd.read_csv("results.csv")   # one row per case: the store it came from, what happened, and the model's call
# the overall accuracy looks fine; find out where the model fails
`,
      fields: [
        { key: "overall", label: "Overall accuracy", help: "Three decimals." },
        { key: "worst_store", label: "store_code where the model is least accurate" },
        { key: "worst_accuracy", label: "Accuracy at that store", help: "Three decimals." },
        { key: "best_accuracy", label: "Accuracy at the best store", help: "Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Break the accuracy down by store and report the four numbers.",
    },
    key: {
      kind: "numbers",
      expected: { overall: round(acc(rows), 3), worst_store: weak, worst_accuracy: round(byStore[0].a, 3), best_accuracy: round(byStore[byStore.length - 1].a, 3) },
      tolerance: { overall: 0.002, worst_store: 0, worst_accuracy: 0.002, best_accuracy: 0.002 },
    },
  };
}

/** Missed positives by region on a rare outcome: one region holds most of the misses. */
export function buildFailingSegment(rng: Rng, texts: Texts): MlDraft {
  const regions = [11, 12, 13, 14, 15, 16];
  const weak = rng.pick(regions);
  const rows = regions.flatMap((region) => {
    const caught = region === weak ? 0.3 + rng.next() * 0.15 : 0.72 + rng.next() * 0.15;
    return Array.from({ length: rng.int(120, 180) }, () => {
      const actual = rng.chance(0.15) ? 1 : 0;
      return [region, actual, actual ? (rng.chance(caught) ? 1 : 0) : rng.chance(0.04) ? 1 : 0];
    });
  });
  const misses = (region: number) => rows.filter((r) => r[0] === region && r[1] === 1 && r[2] === 0).length;
  const ranked = regions.map((r) => ({ r, fn: misses(r) })).sort((a, b) => b.fn - a.fn);
  if (ranked[0].r !== weak || ranked[0].fn - ranked[1].fn < 3) throw new MlRejected("no region clearly holds the misses");
  const c = confusion(rows.map((r) => r[1]), rows.map((r) => r[2]));
  const fnWeak = ranked[0].fn;
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Error analysis", "False negatives", "Recall"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "results.csv", text: csv(["region_code", "actual", "predicted"], rng.shuffle(rows)) }],
      starter: `import pandas as pd

r = pd.read_csv("results.csv")   # actual 1 = the case we must catch; predicted = the model's call
# a missed case (false negative) is actual 1, predicted 0
`,
      fields: [
        { key: "recall", label: "Overall recall", help: "Three decimals." },
        { key: "region", label: "region_code with the most missed cases" },
        { key: "region_fn", label: "Missed cases in that region" },
        { key: "share", label: "Share of all missed cases that come from that region", help: "Three decimals." },
        { key: "recall_if_fixed", label: "Overall recall if every miss in that region were caught", help: "Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Find the region where the model misses the most and report the five numbers.",
    },
    key: {
      kind: "numbers",
      expected: { recall: round(recall(c), 3), region: weak, region_fn: fnWeak, share: round(fnWeak / c.fn, 3), recall_if_fixed: round((c.tp + fnWeak) / (c.tp + c.fn), 3) },
      tolerance: { recall: 0.002, region: 0, region_fn: 0, share: 0.002, recall_if_fixed: 0.002 },
    },
  };
}

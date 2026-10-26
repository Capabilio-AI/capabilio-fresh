import { twoProportionTest } from "@/lib/arena-workstations/engines/stats";
import type { Rng } from "../rng";
import { MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";
import { numbersDraft, round } from "./numbers";

/**
 * Experiment-design tickets: read an A/B test, size one before it runs, correct for many comparisons, and spot Simpson's paradox. Every answer is
 * computed here from exact counts; the learner works in the notebook and reports numbers.
 */

const Z_975 = 1.959964; // norm.ppf(0.975)
const Z_80 = 0.841621; // norm.ppf(0.80)
const YES_NO = "Enter 1 for yes, 0 for no.";

interface Cell { variant: string; segment?: string; n: number; conversions: number }

/** One row per user with exactly the given conversions per cell, shuffled so the order says nothing. */
function userRows(rng: Rng, cells: readonly Cell[], withSegment: boolean): string {
  const rows = cells.flatMap((c) => Array.from({ length: c.n }, (_, i) => [...(withSegment ? [c.segment!] : []), c.variant, i < c.conversions ? 1 : 0]));
  const shuffled = rng.shuffle(rows).map((r, i) => [i + 1, ...r]);
  return csv(["user_id", ...(withSegment ? ["device"] : []), "variant", "converted"], shuffled);
}

/** Read a finished A/B test: rates, uplift, a pooled two-proportion z-test and the call at 5%. Rejected when p sits too close to 5% to be a fair call. */
export function abSignificance(rng: Rng, texts: Texts): MlDraft {
  const nA = rng.int(1800, 2600);
  const nB = rng.int(1800, 2600);
  const base = 0.08 + rng.next() * 0.06;
  const lift = rng.chance(0.5) ? 0.024 + rng.next() * 0.016 : rng.next() * 0.006 - 0.003;
  const cA = Math.round(nA * base);
  const cB = Math.round(nB * (base + lift));
  const { z, pValue } = twoProportionTest(cA, nA, cB, nB);
  if (pValue > 0.03 && pValue < 0.08) throw new MlRejected("the p-value is too close to 5% for a fair yes/no");
  const rA = cA / nA;
  const rB = cB / nB;
  return numbersDraft(texts, {
    skillTags: ["A/B testing", "Hypothesis testing", "Two-proportion z-test"],
    files: [{ name: "ab_test.csv", text: userRows(rng, [{ variant: "A", n: nA, conversions: cA }, { variant: "B", n: nB, conversions: cB }], false) }],
    starter: `import pandas as pd
import numpy as np
from scipy import stats

df = pd.read_csv("ab_test.csv")   # one row per user: variant A (current) or B (new), converted 1/0
# conversion rate per variant, then a two-sided two-proportion z-test of B minus A with the POOLED standard error:
#   p_pool = all conversions / all users;  se = sqrt(p_pool * (1 - p_pool) * (1/n_A + 1/n_B));  z = (rate_B - rate_A) / se
#   p-value = 2 * stats.norm.sf(abs(z))
`,
    fields: [
      { key: "rate_a", label: "Conversion rate of A", help: "As a proportion, e.g. 0.1234. Four decimals.", value: round(rA, 4), tolerance: 0.0005 },
      { key: "rate_b", label: "Conversion rate of B", help: "Four decimals.", value: round(rB, 4), tolerance: 0.0005 },
      { key: "uplift_pp", label: "Uplift of B over A, in percentage points", help: "(rate B - rate A) x 100. Two decimals.", value: round((rB - rA) * 100, 2), tolerance: 0.02 },
      { key: "z", label: "z statistic", help: "Pooled standard error. Three decimals.", value: round(z, 3), tolerance: 0.01 },
      { key: "p_value", label: "Two-sided p-value", help: "Four decimals.", value: round(pValue, 4), tolerance: 0.002 },
      { key: "significant", label: "Is the difference significant at the 5% level?", help: YES_NO, value: pValue < 0.05 ? 1 : 0, tolerance: 0 },
    ],
    deliverable: "Report the two rates, the uplift, the test result and whether it is significant at 5%.",
  });
}

/** How many users the test needs before it starts, by the standard normal-approximation formula, and how many days of traffic that is. */
export function sampleSize(rng: Rng, texts: Texts): MlDraft {
  const p1 = rng.pick([0.04, 0.05, 0.06, 0.08, 0.1, 0.12]);
  const relative = rng.pick([0.1, 0.15, 0.2, 0.25]);
  const p2 = round(p1 * (1 + relative), 4);
  const daily = rng.pick([1500, 2000, 2500, 3000, 4000]);
  const pBar = (p1 + p2) / 2;
  const n = Math.ceil((Z_975 * Math.sqrt(2 * pBar * (1 - pBar)) + Z_80 * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2);
  const days = Math.ceil((2 * n) / daily);
  return numbersDraft(texts, {
    skillTags: ["Experiment design", "Statistical power", "Sample size"],
    files: [],
    starter: `import numpy as np
from scipy import stats

p1 = ${p1}        # today's conversion rate
p2 = ${p2}      # the smallest rate worth detecting (+${Math.round(relative * 100)}% relative)
alpha = 0.05     # two-sided
power = 0.80
daily_visitors = ${daily}   # split evenly between the two variants

# n per group = (z_a * sqrt(2 * p_bar * (1 - p_bar)) + z_b * sqrt(p1*(1-p1) + p2*(1-p2)))**2 / (p2 - p1)**2, rounded UP
#   p_bar = (p1 + p2) / 2;  z_a = stats.norm.ppf(1 - alpha/2);  z_b = stats.norm.ppf(power)
`,
    fields: [
      { key: "difference_pp", label: "Absolute difference to detect, in percentage points", help: "(p2 - p1) x 100. Two decimals.", value: round((p2 - p1) * 100, 2), tolerance: 0.01 },
      { key: "n_per_group", label: "Users needed in EACH variant", help: "Rounded up to a whole user.", value: n, tolerance: Math.max(2, Math.ceil(n * 0.01)) },
      { key: "days", label: "Days the test must run", help: "Both variants together, at the daily traffic given; rounded up.", value: days, tolerance: 1 },
    ],
    deliverable: "Report the difference you are powering for, the users needed per variant and how many days the test must run.",
  });
}

/** Five variants against one control: how many look like winners at 5%, and how many survive a Bonferroni correction. */
export function multipleComparisons(rng: Rng, texts: Texts): MlDraft {
  for (let attempt = 0; attempt < 60; attempt++) {
    const base = 0.09 + rng.next() * 0.03;
    const nC = rng.int(3500, 4500);
    const control = { variant: "control", n: nC, conversions: Math.round(nC * base) };
    const variants = Array.from({ length: 5 }, (_, i) => {
      const n = rng.int(3500, 4500);
      return { variant: `v${i + 1}`, n, conversions: Math.round(n * (base + rng.next() * 0.03 - 0.004)) };
    });
    const ps = variants.map((v) => twoProportionTest(control.conversions, control.n, v.conversions, v.n).pValue);
    const near = (p: number, cut: number) => Math.abs(p - cut) < cut * 0.25;
    if (ps.some((p) => near(p, 0.05) || near(p, 0.01))) continue;
    const raw = ps.filter((p) => p < 0.05).length;
    const corrected = ps.filter((p) => p < 0.01).length;
    if (raw < 2 || corrected >= raw) continue;
    return numbersDraft(texts, {
      skillTags: ["Experiment design", "Multiple comparisons", "Bonferroni correction"],
      files: [{ name: "variants.csv", text: csv(["variant", "visitors", "conversions"], [control, ...variants].map((v) => [v.variant, v.n, v.conversions])) }],
      starter: `import pandas as pd
from scipy import stats

df = pd.read_csv("variants.csv")   # the control and five variants of the same page
# compare EACH variant with the control: two-sided two-proportion z-test, pooled standard error, variant minus control
`,
      fields: [
        { key: "significant_raw", label: "Variants significant at 5% without any correction", value: raw, tolerance: 0 },
        { key: "bonferroni_alpha", label: "Bonferroni-corrected significance level", help: "Four decimals.", value: 0.01, tolerance: 0.0001 },
        { key: "significant_bonferroni", label: "Variants still significant after the correction", value: corrected, tolerance: 0 },
      ],
      deliverable: "Report how many variants look significant, the corrected level, and how many really hold up.",
    });
  }
  throw new MlRejected("no unambiguous set of variants");
}

/** Traffic was split unevenly across devices: B wins inside every device, yet loses when the devices are pooled. */
export function simpsons(rng: Rng, texts: Texts): MlDraft {
  const big = () => rng.int(1500, 1800);
  const small = () => rng.int(300, 450);
  const desktopRate = 0.15 + rng.next() * 0.05;
  const mobileRate = 0.04 + rng.next() * 0.02;
  const lift = 0.015 + rng.next() * 0.01;
  const cell = (variant: string, segment: string, n: number, rate: number): Cell => ({ variant, segment, n, conversions: Math.round(n * rate) });
  const cells = [cell("A", "desktop", big(), desktopRate), cell("B", "desktop", small(), desktopRate + lift), cell("A", "mobile", small(), mobileRate), cell("B", "mobile", big(), mobileRate + lift)];
  const rate = (keep: (c: Cell) => boolean) => {
    const picked = cells.filter(keep);
    return picked.reduce((s, c) => s + c.conversions, 0) / picked.reduce((s, c) => s + c.n, 0);
  };
  const pooledA = rate((c) => c.variant === "A");
  const pooledB = rate((c) => c.variant === "B");
  const seg = (s: string, v: string) => rate((c) => c.segment === s && c.variant === v);
  const wins = ["desktop", "mobile"].filter((s) => seg(s, "B") > seg(s, "A")).length;
  if (!(pooledA > pooledB + 0.005) || wins !== 2) throw new MlRejected("the paradox did not appear");
  return numbersDraft(texts, {
    skillTags: ["Experiment design", "Simpson's paradox", "Segmentation", "Confounding"],
    files: [{ name: "ab_test.csv", text: userRows(rng, cells, true) }],
    starter: `import pandas as pd

df = pd.read_csv("ab_test.csv")   # one row per user: device, variant (A current, B new), converted 1/0
# conversion rate per variant overall, then per variant within each device
`,
    fields: [
      { key: "pooled_a", label: "Conversion rate of A, all devices together", help: "Four decimals.", value: round(pooledA, 4), tolerance: 0.0005 },
      { key: "pooled_b", label: "Conversion rate of B, all devices together", help: "Four decimals.", value: round(pooledB, 4), tolerance: 0.0005 },
      { key: "mobile_a", label: "Conversion rate of A on mobile", help: "Four decimals.", value: round(seg("mobile", "A"), 4), tolerance: 0.0005 },
      { key: "mobile_b", label: "Conversion rate of B on mobile", help: "Four decimals.", value: round(seg("mobile", "B"), 4), tolerance: 0.0005 },
      { key: "segments_b_wins", label: "In how many of the two devices does B convert better than A?", value: wins, tolerance: 0 },
    ],
    deliverable: "Report the pooled rates, the mobile rates and in how many devices B is ahead.",
  });
}

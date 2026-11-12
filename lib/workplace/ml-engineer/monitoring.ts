import type { Rng } from "../rng";
import { MAX_SUBMISSIONS, MlRejected, type MlDraft, type Texts } from "../ml/tickets";
import { csv } from "../ml/world";

// Production monitoring, as numbers the notebook can produce: the population stability index of each input feature, and a rolling recall alert over
// a daily log. Every answer is computed here from the generated rows.

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

const FEATURES = ["tenure_months", "monthly_spend", "support_tickets", "data_usage_gb"] as const;
const BINS = 5;
const PSI_ALERT = 0.2;

const psiOf = (ref: readonly number[], cur: readonly number[]) => {
  const rt = ref.reduce((s, x) => s + x, 0);
  const ct = cur.reduce((s, x) => s + x, 0);
  return ref.reduce((s, r, i) => {
    const p = r / rt;
    const q = cur[i] / ct;
    return s + (q - p) * Math.log(q / p);
  }, 0);
};

/** PSI per feature between the training data and last week's requests; two features have drifted. */
export function buildPsi(rng: Rng, texts: Texts): MlDraft {
  const drifted = new Set(rng.shuffle([0, 1, 2, 3]).slice(0, 2));
  const tables = FEATURES.map((name, f) => {
    const ref = Array.from({ length: BINS }, () => rng.int(150, 450));
    const cur = ref.map((r, i) => (drifted.has(f) ? Math.max(20, Math.round(r * (i < 2 ? 0.45 + rng.next() * 0.3 : 1.2 + rng.next() * 0.7))) : Math.max(20, Math.round(r * (0.9 + rng.next() * 0.2)))));
    return { name, ref, cur, psi: psiOf(ref, cur) };
  });
  const alerts = tables.filter((t) => round(t.psi, 3) > PSI_ALERT).length;
  if (tables.some((t) => Math.abs(round(t.psi, 3) - PSI_ALERT) < 0.01) || alerts === 0 || alerts === FEATURES.length) throw new MlRejected("a feature sits on the alert threshold or none/all drifted");
  return {
    title: texts.title, requester: texts.requester, scenario: `${texts.scenario} Our rule: a feature is flagged when its PSI is above ${PSI_ALERT}.`,
    skillTags: ["Drift monitoring", "Population stability index", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "bins.csv", text: csv(["feature", "bin", "training_count", "last_week_count"], tables.flatMap((t) => t.ref.map((r, i) => [t.name, i + 1, r, t.cur[i]]))) }],
      starter: `import numpy as np
import pandas as pd

bins = pd.read_csv("bins.csv")   # for each feature: how many rows fell in each of ${BINS} bins, in training and last week
# PSI = sum over bins of (q - p) * ln(q / p), where p is the bin's share of training rows and q its share of last week's rows
`,
      fields: [
        ...FEATURES.map((name) => ({ key: `psi_${name}`, label: `PSI of ${name}`, help: "Three decimals." })),
        { key: "flagged", label: "Features flagged for drift" },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Compute the PSI of each feature and count the flagged ones.",
    },
    key: {
      kind: "numbers",
      expected: { ...Object.fromEntries(tables.map((t) => [`psi_${t.name}`, round(t.psi, 3)])), flagged: alerts },
      tolerance: { ...Object.fromEntries(tables.map((t) => [`psi_${t.name}`, 0.0015])), flagged: 0 },
    },
  };
}

const DAYS = 45;
const WINDOW = 7;
const RECALL_FLOOR = 0.6;

/** A daily log of what the model caught and missed; alert when recall over the last 7 days falls below the floor. */
export function buildRollingAlert(rng: Rng, texts: Texts): MlDraft {
  const dipStart = rng.int(18, 30);
  const dipLen = rng.int(6, 12);
  const days = Array.from({ length: DAYS }, (_, i) => {
    const positives = rng.int(30, 60);
    const inDip = i >= dipStart && i < dipStart + dipLen;
    const hit = inDip ? 0.35 + rng.next() * 0.2 : 0.66 + rng.next() * 0.12;
    const tp = Math.round(positives * hit);
    return { day: i + 1, tp, fn: positives - tp };
  });
  const rolling = days.map((_, i) => {
    if (i < WINDOW - 1) return null;
    const w = days.slice(i - WINDOW + 1, i + 1);
    return w.reduce((s, d) => s + d.tp, 0) / w.reduce((s, d) => s + d.tp + d.fn, 0);
  });
  const below = rolling.map((r, i) => (r !== null && r < RECALL_FLOOR ? i + 1 : null)).filter((d): d is number => d !== null);
  const min = Math.min(...rolling.filter((r): r is number => r !== null));
  if (below.length < 3 || rolling.some((r) => r !== null && Math.abs(r - RECALL_FLOOR) < 0.004)) throw new MlRejected("no clear alert window");
  return {
    title: texts.title, requester: texts.requester, scenario: `${texts.scenario} Our rule: raise an alert on any day when the recall over that day and the 6 days before it is below ${RECALL_FLOOR.toFixed(2)}.`,
    skillTags: ["Model monitoring", "Rolling metrics", "pandas"],
    content: {
      company: texts.company, kind: "numbers",
      files: [{ name: "daily.csv", text: csv(["day", "caught", "missed"], days.map((d) => [d.day, d.tp, d.fn])) }],
      starter: `import pandas as pd

d = pd.read_csv("daily.csv")   # caught = leavers the model flagged that day, missed = leavers it did not flag
# rolling recall = caught over the 7-day window / (caught + missed) over the same window.
# It exists from day 7 onwards: pool the counts of the window, do not average the daily recalls.
`,
      fields: [
        { key: "first_alert", label: "First day an alert is raised" },
        { key: "alert_days", label: "Days with an alert" },
        { key: "lowest_recall", label: "Lowest rolling recall", help: "Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Find when the alert fires and how bad the dip got.",
    },
    key: { kind: "numbers", expected: { first_alert: below[0], alert_days: below.length, lowest_recall: round(min, 3) }, tolerance: { first_alert: 0, alert_days: 0, lowest_recall: 0.0015 } },
  };
}

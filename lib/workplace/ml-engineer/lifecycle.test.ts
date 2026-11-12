import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mlTool } from "@/lib/arena-workstations/tools/ml";
import { toolFor } from "@/lib/arena-workstations/registry";
import { referenceSubmission } from "@/lib/arena-workstations/reference-submission";
import { AI_ML_ENGINEER } from "@/lib/arena-roles/blueprints/ai-ml-engineer";
import { AI_ML_PIPELINE } from "@/lib/arena-roles/sessions/ai-ml-engineer-pipeline";
import { SPECS } from "@/lib/arena-roles/session/service";
import { catalogRole } from "@/lib/arena-roles/catalog";
import { isTemplateOnlyArea } from "@/lib/arena-workstations/template-only";
import { runChecks } from "../devops/checks";
import { hashSeed, makeRng } from "../rng";
import { templateTiers } from "../tickets/pick";
import type { MlDraft } from "../ml/tickets";
import { ML_ENGINEER_TEMPLATES } from "./tickets";
import { ML_ENGINEER_DEVOPS_TEMPLATES } from "./devops-templates";

// Independent solutions: each reads only what the learner is given (the CSV files and the starter), never the builder's own variables.
type Row = Record<string, string>;
const SEEDS = 6;
const build = (id: string, i: number): MlDraft => ML_ENGINEER_TEMPLATES.find((x) => x.id === id)!.build(makeRng(hashSeed("mle-lifecycle", id, i)));
const table = (d: MlDraft, name: string): Row[] => {
  const [head, ...lines] = d.content.files.find((f) => f.name === name)!.text.trim().split("\n");
  const cols = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
};
const n = (s: string) => Number(s);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const r = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const std = (xs: number[]) => Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / (xs.length - 1));
const grade = (d: MlDraft, answers: Record<string, string>) => mlTool.grade(d.content as never, d.key as never, { answers });
const starterNum = (d: MlDraft, name: string) => n(d.content.starter.match(new RegExp(`${name} = (-?[\\d.]+)`))![1]);

const SOLVERS: Record<string, (d: MlDraft) => Record<string, number>> = {
  "mle-ratio-features": (d) => {
    const rows = table(d, "customers.csv");
    const tpm = (x: Row) => n(x.support_tickets) / n(x.months_active);
    const gone = mean(rows.filter((x) => x.churned === "1").map(tpm));
    const stayed = mean(rows.filter((x) => x.churned === "0").map(tpm));
    return { spm_mean: r(mean(rows.map((x) => n(x.total_spend) / n(x.months_active))), 2), tpm_churned: r(gone, 3), tpm_retained: r(stayed, 3), tpm_ratio: r(gone / stayed, 2) };
  },
  "mle-rare-cities": (d) => {
    const counts = new Map<string, number>();
    for (const x of table(d, "customers.csv")) counts.set(x.city, (counts.get(x.city) ?? 0) + 1);
    const min = starterNum(d, "MIN_ROWS");
    const kept = [...counts.values()].filter((c) => c >= min).length;
    return { raw_cities: counts.size, kept_cities: kept, other_rows: [...counts.values()].filter((c) => c < min).reduce((s, c) => s + c, 0), onehot_columns: kept + 1 };
  },
  "mle-date-features": (d) => {
    const orders = table(d, "orders.csv").map((x) => ({ c: x.customer_id, t: new Date(`${x.order_ts.replace(" ", "T")}Z`) }));
    const snap = Date.UTC(2026, 5, 30);
    const last = new Map<string, number>();
    for (const o of orders) last.set(o.c, Math.max(last.get(o.c) ?? 0, o.t.getTime()));
    const days = [...last.values()].map((t) => Math.floor((snap - t) / 86_400_000));
    return {
      weekend_share: r(orders.filter((o) => o.t.getUTCDay() === 0 || o.t.getUTCDay() === 6).length / orders.length, 3),
      night_share: r(orders.filter((o) => o.t.getUTCHours() >= 22 || o.t.getUTCHours() < 6).length / orders.length, 3),
      median_days_silent: r(median(days), 1),
      silent_over_90: days.filter((x) => x > 90).length,
    };
  },
  "mle-target-encoding": (d) => {
    const rows = table(d, "train.csv");
    const id = starterNum(d, "ROW_ID");
    const me = rows.find((x) => n(x.customer_id) === id)!;
    const same = rows.filter((x) => x.city === me.city);
    const cities = new Map<string, number>();
    for (const x of rows) cities.set(x.city, (cities.get(x.city) ?? 0) + 1);
    return { city_mean: r(mean(same.map((x) => n(x.churned))), 3), loo_row: r(mean(same.filter((x) => x !== me).map((x) => n(x.churned))), 3), single_cities: [...cities.values()].filter((c) => c === 1).length };
  },
  "mle-pick-by-validation": (d) => {
    const rows = table(d, "runs.csv");
    const byVal = [...rows].sort((a, b) => n(b.val_f1) - n(a.val_f1))[0];
    const byTest = [...rows].sort((a, b) => n(b.test_f1) - n(a.test_f1))[0];
    return { chosen_run: n(byVal.run_id), chosen_val: n(byVal.val_f1), chosen_test: n(byVal.test_f1), trap_run: n(byTest.run_id), selection_gap: r(n(byTest.test_f1) - n(byVal.test_f1), 3) };
  },
  "mle-repro-audit": (d) => {
    const rows = table(d, "runs.csv");
    const ok = rows.filter((x) => x.seed !== "" && x.git_sha !== "" && x.data_version !== "");
    const best = [...ok].sort((a, b) => n(b.val_f1) - n(a.val_f1))[0];
    const top = Math.max(...rows.map((x) => n(x.val_f1)));
    return { reproducible: ok.length, unreproducible: rows.length - ok.length, best_run: n(best.run_id), best_val: n(best.val_f1), lost_score: r(top - n(best.val_f1), 3) };
  },
  "mle-seed-variance": (d) => {
    const rows = table(d, "seeds.csv");
    const a = rows.filter((x) => x.config === "A").map((x) => n(x.val_f1));
    const b = rows.filter((x) => x.config === "B").map((x) => n(x.val_f1));
    return { mean_a: r(mean(a), 4), mean_b: r(mean(b), 4), std_a: r(std(a), 4), std_b: r(std(b), 4), adopt_b: mean(b) - mean(a) > 2 * Math.max(std(a), std(b)) ? 1 : 0 };
  },
  "mle-feature-drift": (d) => {
    const rows = table(d, "bins.csv");
    const out: Record<string, number> = {};
    let flagged = 0;
    for (const f of ["tenure_months", "monthly_spend", "support_tickets", "data_usage_gb"]) {
      const mine = rows.filter((x) => x.feature === f);
      const rt = mine.reduce((s, x) => s + n(x.training_count), 0);
      const ct = mine.reduce((s, x) => s + n(x.last_week_count), 0);
      const psi = mine.reduce((s, x) => s + (n(x.last_week_count) / ct - n(x.training_count) / rt) * Math.log(n(x.last_week_count) / ct / (n(x.training_count) / rt)), 0);
      out[`psi_${f}`] = r(psi, 3);
      if (r(psi, 3) > 0.2) flagged++;
    }
    return { ...out, flagged };
  },
  "mle-rolling-recall-alert": (d) => {
    const rows = table(d, "daily.csv");
    const alerts: number[] = [];
    let min = 1;
    for (let i = 6; i < rows.length; i++) {
      const w = rows.slice(i - 6, i + 1);
      const rec = w.reduce((s, x) => s + n(x.caught), 0) / w.reduce((s, x) => s + n(x.caught) + n(x.missed), 0);
      min = Math.min(min, rec);
      if (rec < 0.6) alerts.push(n(rows[i].day));
    }
    return { first_alert: alerts[0], alert_days: alerts.length, lowest_recall: r(min, 3) };
  },
  "mle-cv-comparison": (d) => {
    const rows = table(d, "cv_results.csv").map((x) => ({ id: n(x.model_id), f: [1, 2, 3, 4, 5].map((k) => n(x[`fold_${k}`])) }));
    const byMean = [...rows].sort((a, b) => mean(b.f) - mean(a.f));
    const stable = [...rows].sort((a, b) => std(a.f) - std(b.f))[0];
    const gap = (mean(byMean[0].f) - mean(byMean[1].f)) / std(byMean[0].f);
    return { best_id: byMean[0].id, best_mean: r(mean(byMean[0].f), 4), stable_id: stable.id, gap_sigmas: r(gap, 2), clear_win: gap > 1 ? 1 : 0 };
  },
  "mle-grid-search": (d) => {
    const rows = table(d, "grid.csv");
    const best = [...rows].sort((a, b) => n(b.val_accuracy) - n(a.val_accuracy))[0];
    const tempt = [...rows].sort((a, b) => n(b.train_accuracy) - n(a.train_accuracy))[0];
    return { best_combo: n(best.combo_id), best_val: n(best.val_accuracy), its_gap: r(n(best.train_accuracy) - n(best.val_accuracy), 3), overfit_combos: rows.filter((x) => n(x.train_accuracy) - n(x.val_accuracy) > 0.1).length, tempting_combo: n(tempt.combo_id) };
  },
  "mle-kmeans-elbow": (d) => {
    const v = table(d, "inertia.csv").map((x) => n(x.inertia));
    let best = 0; let bestK = 0;
    for (let k = 2; k <= 7; k++) { const s = v[k - 2] - 2 * v[k - 1] + v[k]; if (s > best) { best = s; bestK = k; } }
    return { elbow_k: bestK, second_diff: best, drop_pct: r(((v[0] - v[bestK - 1]) / v[0]) * 100, 1) };
  },
  "mle-roc-auc": (d) => {
    const rows = table(d, "scores.csv").map((x) => ({ y: n(x.actual), s: n(x.score) }));
    const pos = rows.filter((x) => x.y === 1); const neg = rows.filter((x) => x.y === 0);
    const wins = pos.flatMap((p) => neg.map((q) => (p.s > q.s ? 1 : p.s === q.s ? 0.5 : 0))).reduce((a: number, b: number) => a + b, 0);
    return { auc: r(wins / (pos.length * neg.length), 3), positives: pos.length, tpr_at_half: r(pos.filter((x) => x.s >= 0.5).length / pos.length, 3), fpr_at_half: r(neg.filter((x) => x.s >= 0.5).length / neg.length, 3) };
  },
  "mle-pca-variance": (d) => {
    const e = table(d, "eigenvalues.csv").map((x) => n(x.eigenvalue));
    const total = e.reduce((a, b) => a + b, 0);
    let run = 0; let keep = 0;
    for (let i = 0; i < e.length; i++) { run += e[i]; if (run / total >= 0.9) { keep = i + 1; break; } }
    return { pc1_ratio: r(e[0] / total, 3), top2_ratio: r((e[0] + e[1]) / total, 3), keep, kept_ratio: r(e.slice(0, keep).reduce((a, b) => a + b, 0) / total, 3) };
  },
  "mle-nn-forward": (d) => {
    const s = d.content.starter;
    const arr = (name: string) => JSON.parse(s.match(new RegExp(`${name} = (?:np\\.array\\()?(\\[[^=]*?\\])\\)?\\s`))![1]) as number[] | number[][];
    const X = arr("X") as number[][]; const y = arr("y") as number[]; const W1 = arr("W1") as number[][]; const b1 = arr("b1") as number[]; const W2 = arr("W2") as number[];
    const b2 = starterNum(d, "b2");
    const hid = X.map((x) => [0, 1, 2].map((j) => Math.max(0, x[0] * W1[0][j] + x[1] * W1[1][j] + b1[j])));
    const p = hid.map((h) => 1 / (1 + Math.exp(-(h[0] * W2[0] + h[1] * W2[1] + h[2] * W2[2] + b2))));
    const loss = -mean(p.map((pi, i) => (y[i] ? Math.log(pi) : Math.log(1 - pi))));
    return { hidden_sum: r(hid[0].reduce((a, v) => a + v, 0), 3), p1: r(p[0], 3), p2: r(p[1], 3), p3: r(p[2], 3), loss: r(loss, 3) };
  },
  "mle-nn-backprop": (d) => {
    const s = d.content.starter;
    const pair = (a: string, b: string) => s.match(new RegExp(`${a}, ${b} = (-?[\\d.]+), (-?[\\d.]+)`))!.slice(1).map(Number);
    const [x, y] = pair("x", "y"); const [w1, b1] = pair("w1", "b1"); const [w2, b2] = pair("w2", "b2");
    const lr = starterNum(d, "LR");
    const h = Math.max(0, w1 * x + b1);
    const p = 1 / (1 + Math.exp(-(w2 * h + b2)));
    const dz = p - y;
    return { p: r(p, 4), dw2: r(dz * h, 4), dw1: r(dz * w2 * x, 4), w2_new: r(w2 - lr * dz * h, 4), w1_new: r(w1 - lr * dz * w2 * x, 4) };
  },
};

describe("AI/ML lifecycle tickets", () => {
  for (const id of Object.keys(SOLVERS)) {
    it(`${id}: an independent solution from the learner's files passes, blanks and zeros fail, for ${SEEDS} students`, async () => {
      for (let i = 0; i < SEEDS; i++) {
        const d = build(id, i);
        const mine = SOLVERS[id](d);
        const result = await grade(d, Object.fromEntries(Object.entries(mine).map(([k, v]) => [k, String(v)])));
        expect(result.passed, `${id} seed ${i}: ${JSON.stringify(result.checks.filter((c) => !c.passed))}`).toBe(true);
        expect((await grade(d, {})).passed).toBe(false);
        expect((await grade(d, Object.fromEntries(d.content.fields.map((f) => [f.key, "0"])))).passed).toBe(false);
      }
    }, 60_000);
  }

  it("every new template is covered by an independent solver", () => {
    const fresh = ML_ENGINEER_TEMPLATES.filter((t) => t.areas.some((a) => ["ml-feature-engineering", "experiment-tracking", "drift-monitoring", "neural-networks", "mle-algorithm-selection"].includes(a)));
    expect(fresh.map((t) => t.id).sort()).toEqual(Object.keys(SOLVERS).sort());
  });

  it("the traps are real: the shortcut answer fails", async () => {
    for (let i = 0; i < SEEDS; i++) {
      const pick = build("mle-pick-by-validation", i);
      const trapped = { ...SOLVERS["mle-pick-by-validation"](pick), chosen_run: SOLVERS["mle-pick-by-validation"](pick).trap_run };
      expect((await grade(pick, Object.fromEntries(Object.entries(trapped).map(([k, v]) => [k, String(v)])))).passed).toBe(false);
      const repro = build("mle-repro-audit", i);
      const best = table(repro, "runs.csv").sort((a, b) => n(b.val_f1) - n(a.val_f1))[0];
      const naive = { ...SOLVERS["mle-repro-audit"](repro), best_run: n(best.run_id) };
      expect((await grade(repro, Object.fromEntries(Object.entries(naive).map(([k, v]) => [k, String(v)])))).passed).toBe(false);
    }
  });

  it("every new area has an easy fresher ticket and at least two tickets", () => {
    for (const area of ["ml-feature-engineering", "experiment-tracking", "drift-monitoring", "neural-networks", "mle-algorithm-selection"]) {
      const own = ML_ENGINEER_TEMPLATES.filter((t) => t.areas.includes(area));
      expect(own.length, area).toBeGreaterThanOrEqual(2);
      expect(templateTiers(ML_ENGINEER_TEMPLATES, { difficulty: "easy", level: "fresher", areaKey: area })[0]?.length, area).toBeGreaterThan(0);
      expect(isTemplateOnlyArea(area), area).toBe(true);
    }
    expect(isTemplateOnlyArea("mlops-config")).toBe(true);
  });
});

describe("AI/ML MLOps config tickets", () => {
  it("has at least two tickets including an easy fresher one", () => {
    expect(ML_ENGINEER_DEVOPS_TEMPLATES.length).toBeGreaterThanOrEqual(2);
    expect(ML_ENGINEER_DEVOPS_TEMPLATES.some((t) => t.difficulty === "easy" && t.minLevel === "fresher")).toBe(true);
  });
  for (const t of ML_ENGINEER_DEVOPS_TEMPLATES) {
    it(`${t.id}: the solution passes every check and the starter fails at least two`, () => {
      const files = t.draft.content.files.map((f) => t.solution.find((s) => s.name === f.name) ?? f);
      const checks = t.draft.key.checks;
      expect(runChecks(files, checks).filter((x) => !x.passed).map((x) => x.label)).toEqual([]);
      expect(runChecks(t.draft.content.files, checks).filter((x) => !x.passed).length).toBeGreaterThanOrEqual(2);
      expect(runChecks([{ name: t.draft.content.files[0].name, content: "" }], checks).every((x) => x.passed)).toBe(false);
      expect(t.draft.content.requirements).toHaveLength(checks.length);
    });
  }
});

describe("IT-07 Proof Session spec", () => {
  it("is the AI/ML Engineer session, registered for its role", () => {
    expect([AI_ML_PIPELINE.roleId, AI_ML_PIPELINE.domainRoleKey]).toEqual(["IT-07", AI_ML_ENGINEER.domainRoleKey]);
    expect(catalogRole(AI_ML_PIPELINE.roleId)?.domainRoleKey).toBe(AI_ML_PIPELINE.domainRoleKey);
    expect(SPECS[AI_ML_PIPELINE.domainRoleKey]).toBe(AI_ML_PIPELINE);
  });

  it("has one stage per lifecycle step, each an enabled notebook area of the role, the same for every level", () => {
    const stages = AI_ML_PIPELINE.stagesFor("fresher");
    expect(new Set(stages.map((s) => s.key)).size).toBe(stages.length);
    for (const stage of stages) {
      const area = AI_ML_ENGINEER.areas.find((a) => a.areaKey === stage.areaKey);
      expect([area?.status, area?.toolType], stage.key).toEqual(["enabled", "ml_workspace"]);
    }
    for (const level of ["junior", "mid", "senior"] as const) expect(AI_ML_PIPELINE.stagesFor(level)).toEqual(stages);
  });

  it("does not claim what the notebook cannot show", () => {
    expect(AI_ML_PIPELINE.limitations.join(" ")).toMatch(/browser/);
    expect(AI_ML_PIPELINE.limitations.join(" ")).toMatch(/no GPU|no real model server/i);
    expect(AI_ML_PIPELINE.claimSubject).not.toMatch(/certif|professional/i);
  });
});

describe("every AI/ML stage is solvable, whichever student gets it", () => {
  // the fixed templates stand in for the AI-written ones, so this runs with no AI and no database
  const before = process.env.ML_AI_GENERATION;
  beforeAll(() => { process.env.ML_AI_GENERATION = "off"; });
  afterAll(() => { if (before === undefined) delete process.env.ML_AI_GENERATION; else process.env.ML_AI_GENERATION = before; });

  const STUDENTS = 12;
  for (const stage of AI_ML_PIPELINE.stagesFor("fresher")) {
    it(`${stage.key} (${stage.areaKey}): the reference answer passes and an empty one fails, for ${STUDENTS} students`, async () => {
      const tool = toolFor("ml_workspace");
      const problems: string[] = [];
      for (let k = 0; k < STUDENTS; k++) {
        const userId = `student-${k}`;
        const generated = await tool.generate({
          roleName: "AI/ML Engineer", parentSkill: "AI and Machine Learning", areaName: stage.title, difficulty: "easy", avoidTitles: [], roleKey: "ai-ml-engineer", areaKey: stage.areaKey,
          ticketSeed: hashSeed(userId, "ai-ml-engineer", "session", `s-${k}`, stage.key), level: "fresher", recentKinds: [],
        });
        const parsed = tool.submissionSchema.safeParse(referenceSubmission("ml_workspace", generated.content, generated.answer_key));
        if (!parsed.success) { problems.push(`${userId}: reference rejected`); continue; }
        if (!(await tool.grade(generated.content, generated.answer_key, parsed.data)).passed) problems.push(`${userId}: reference did not pass`);
        if ((await tool.grade(generated.content, generated.answer_key, tool.submissionSchema.parse({}))).passed) problems.push(`${userId}: empty answer passed`);
      }
      expect(problems).toEqual([]);
    }, 120_000);
  }
});

describe("AI/ML plain-Python and SQL tickets", () => {
  it("python problems: answers are plain JSON, examples agree, the untouched starter does not pass, and each area has an easy fresher ticket", async () => {
    const { ML_ENGINEER_PYTHON_PROBLEMS } = await import("./python-problems");
    const { same } = await import("../code/compare");
    expect(ML_ENGINEER_PYTHON_PROBLEMS.length).toBeGreaterThanOrEqual(4);
    expect(ML_ENGINEER_PYTHON_PROBLEMS.some((p) => p.difficulty === "easy" && p.minLevel === "fresher")).toBe(true);
    for (const p of ML_ENGINEER_PYTHON_PROBLEMS) {
      for (let i = 0; i < SEEDS; i++) {
        const d = p.build(makeRng(hashSeed("mle-py", p.id, i)));
        expect(d.content.cases.length, p.id).toBeGreaterThanOrEqual(8);
        expect(JSON.parse(JSON.stringify(d.key.expected))).toEqual(d.key.expected);
        d.content.examples.forEach((ex, k) => expect(same(ex.expected, d.key.expected[k]), p.id).toBe(true));
        const run = (c: unknown[]) => { try { return new Function(`${d.content.starters.javascript}\nreturn ${d.content.fn};`)()(...structuredClone(c)); } catch { return Symbol("error"); } };
        expect(d.content.cases.every((c, k) => same(run(c), d.key.expected[k])), p.id).toBe(false);
      }
    }
  });

  it("sql tickets: the reference passes and the common mistake (and doing nothing) is caught for most students", async () => {
    const { sqlJsRunner } = await import("@/lib/arena-content/sqljs-runner");
    const { validateDraft } = await import("../tickets/pick");
    const { ML_ENGINEER_SQL_TEMPLATES } = await import("./sql-templates");
    const { generateBrightCart } = await import("../worlds/brightcart");
    const { runSqlScript } = await import("../sql/local-runner");
    expect(ML_ENGINEER_SQL_TEMPLATES.some((t) => t.difficulty === "easy" && t.minLevel === "fresher")).toBe(true);
    for (const template of ML_ENGINEER_SQL_TEMPLATES) {
      let ok = 0;
      const reasons: string[] = [];
      for (let i = 0; i < 10; i++) {
        const seed = hashSeed("mle-sql", template.id, i);
        const verdict = await validateDraft(template.build(makeRng(seed)), generateBrightCart(seed), { query: sqlJsRunner, script: (s, sc, p) => runSqlScript(s, sc, p) });
        if (verdict.ok) ok++; else reasons.push(verdict.reason);
      }
      expect(ok, `${template.id}: ${reasons.join(" | ")}`).toBeGreaterThanOrEqual(7);
    }
  }, 120_000);

  it("the world for ai-ml-engineer serves only the role's own SQL tickets", async () => {
    const { worldForRole } = await import("../worlds");
    const { ML_ENGINEER_SQL_TEMPLATES } = await import("./sql-templates");
    expect(worldForRole("ai-ml-engineer")!.templates).toBe(ML_ENGINEER_SQL_TEMPLATES);
  });
});

describe("worked methods are revealed with the grade, for every numbers ticket", () => {
  it("each numbers ticket carries a method, and the grade message shows it for a pass and for a miss", async () => {
    for (const template of ML_ENGINEER_TEMPLATES) {
      const d = template.build(makeRng(hashSeed("mle-method", template.id)));
      if (d.key.kind !== "numbers") continue;
      expect(d.key.method, template.id).toBeTruthy();
      const miss = await grade(d, {});
      expect(miss.message, template.id).toContain("How it is solved:");
      const hit = await grade(d, Object.fromEntries(Object.entries(d.key.expected).map(([k, v]) => [k, String(v)])));
      expect(hit.message, template.id).toContain(d.key.method!);
      // the method is server-only: it is in the answer key, never in the content the student is given while working
      expect(JSON.stringify(d.content), template.id).not.toContain(d.key.method!);
    }
  });
});

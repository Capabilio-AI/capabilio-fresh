import { describe, expect, it } from "vitest";
import { hashSeed, makeRng } from "../rng";
import { generateBrightCart } from "../worlds/brightcart";
import { checkStats, pickOffice } from "../office/pick";
import { checkInvestigation } from "../investigate/check";
import { templateTiers } from "../tickets/pick";
import { score } from "../ml/metrics";
import type { MlDraft } from "../ml/tickets";
import { mlTool } from "@/lib/arena-workstations/tools/ml";
import { statisticsTool } from "@/lib/arena-workstations/tools/statistics";
import { investigationTool } from "@/lib/arena-workstations/tools/investigation";
import { validateBlueprint } from "@/lib/arena-roles/blueprint";
import { validateToolkit } from "@/lib/arena-roles/toolkit/types";
import { DATA_SCIENTIST } from "@/lib/arena-roles/blueprints/data-scientist";
import { TOOLKIT } from "@/lib/arena-roles/toolkit/data-scientist";
import { DATA_SCIENCE_ML_AREAS, DATA_SCIENCE_ML_TEMPLATES, isDataScienceMlArea } from "./ml-templates";
import { DATA_SCIENCE_WORLD } from "./world";
import { DS_STATS_TEMPLATES, DS_STORY_TEMPLATES } from "./world-templates";

type NumbersKey = Extract<MlDraft["key"], { kind: "numbers" }>;
type PredictKey = Extract<MlDraft["key"], { kind: "predict" }>;
const SEEDS = 5;
const build = (id: string, i: number) => DATA_SCIENCE_ML_TEMPLATES.find((t) => t.id === id)!.build(makeRng(hashSeed("ds-test", id, i)));
const parse = (text: string) => {
  const [head, ...lines] = text.split("\n");
  return { cols: head.split(","), rows: lines.map((l) => l.split(",")) };
};
const file = (d: MlDraft, name: string) => parse(d.content.files.find((f) => f.name === name)!.text);
const exact = (key: NumbersKey) => Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v)]));
const NUMBER_IDS = DATA_SCIENCE_ML_TEMPLATES.filter((t) => !["ds-course-completion", "ds-default-leakage"].includes(t.id)).map((t) => t.id);

describe("data-scientist role shape", () => {
  it("blueprint and toolkit are valid and every enabled area has an easy fresher ticket", () => {
    expect(validateBlueprint(DATA_SCIENTIST)).toEqual([]);
    expect(validateToolkit(TOOLKIT)).toEqual([]);
    expect(TOOLKIT.roleKey).toBe(DATA_SCIENTIST.domainRoleKey);
    const all = [...DATA_SCIENCE_ML_TEMPLATES, ...DS_STATS_TEMPLATES, ...DS_STORY_TEMPLATES];
    const areas = DATA_SCIENTIST.areas.filter((a) => a.status === "enabled").map((a) => a.areaKey);
    expect(areas.length).toBeGreaterThanOrEqual(5);
    for (const area of areas) expect(all.some((t) => t.areas.includes(area) && t.difficulty === "easy" && t.minLevel === "fresher"), area).toBe(true);
    for (const t of all) expect(t.areas.every((a) => areas.includes(a)), t.id).toBe(true);
    expect(new Set(all.map((t) => t.difficulty))).toEqual(new Set(["easy", "medium"]));
  });

  it("serves only its own areas: the ML hook matches the blueprint and never claims an AI/ML Engineer area", () => {
    expect([...DATA_SCIENCE_ML_AREAS].sort()).toEqual(DATA_SCIENTIST.areas.filter((a) => a.toolType === "ml_workspace").map((a) => a.areaKey).sort());
    for (const k of ["model-training", "evaluation", "pipeline-debugging", "data-preparation", "ml-fundamentals"]) {
      expect(isDataScienceMlArea(k)).toBe(false);
      expect(templateTiers(DATA_SCIENCE_ML_TEMPLATES, { difficulty: "easy", level: "fresher", areaKey: k })).toEqual([]);
    }
    expect(DATA_SCIENCE_WORLD.templates).toEqual([]);
    expect(DATA_SCIENCE_WORLD.office!.cleaning).toEqual([]);
  });
});

describe("data-scientist notebook tickets", () => {
  it("keep their fixed title and rebuild identically from the same seed", () => {
    for (const t of DATA_SCIENCE_ML_TEMPLATES) {
      const a = t.build(makeRng(11));
      expect(a.title).toBe(t.title);
      expect(JSON.stringify(t.build(makeRng(11)))).toBe(JSON.stringify(a));
    }
  }, 60_000);

  for (const id of NUMBER_IDS) {
    it(`${id}: the computed answers pass, a blank or wrong answer fails, and no answer is in the content`, async () => {
      for (let i = 0; i < SEEDS; i++) {
        const d = build(id, i);
        const key = d.key as NumbersKey;
        expect(Object.keys(key.expected).sort()).toEqual(d.content.fields.map((f) => f.key).sort());
        expect((await mlTool.grade(d.content as never, key as never, { answers: exact(key) })).passed).toBe(true);
        expect((await mlTool.grade(d.content as never, key as never, { answers: {} })).passed).toBe(false);
        const [first] = d.content.fields;
        const wrong = { ...exact(key), [first.key]: String(key.expected[first.key] + key.tolerance[first.key] + 1) };
        expect((await mlTool.grade(d.content as never, key as never, { answers: wrong })).passed).toBe(false);
        expect(JSON.stringify(d.content)).not.toContain('"expected"');
      }
    });
  }

  it("A/B significance: the key matches an independent count of the log", () => {
    for (let i = 0; i < SEEDS; i++) {
      const d = build("ds-ab-significance", i);
      const { cols, rows } = file(d, "ab_test.csv");
      const rate = (v: string) => {
        const g = rows.filter((r) => r[cols.indexOf("variant")] === v);
        return g.filter((r) => r[cols.indexOf("converted")] === "1").length / g.length;
      };
      const key = d.key as NumbersKey;
      expect(Math.abs(rate("A") - key.expected.rate_a)).toBeLessThan(0.0001);
      expect(Math.abs(rate("B") - key.expected.rate_b)).toBeLessThan(0.0001);
      expect(key.expected.significant).toBe(key.expected.p_value < 0.05 ? 1 : 0);
      expect(key.expected.p_value < 0.03 || key.expected.p_value > 0.08).toBe(true);
    }
  });

  it("Simpson's paradox: B loses pooled yet wins in both devices", () => {
    for (let i = 0; i < SEEDS; i++) {
      const key = build("ds-simpsons-paradox", i).key as NumbersKey;
      expect(key.expected.pooled_a).toBeGreaterThan(key.expected.pooled_b);
      expect(key.expected.mobile_b).toBeGreaterThan(key.expected.mobile_a);
      expect(key.expected.segments_b_wins).toBe(2);
    }
  });

  it("multiple comparisons: the uncorrected count is a trap", () => {
    for (let i = 0; i < SEEDS; i++) {
      const key = build("ds-multiple-comparisons", i).key as NumbersKey;
      expect(key.expected.significant_raw).toBeGreaterThan(key.expected.significant_bonferroni);
    }
  });

  it("train-only scaling: fitting the scaler on train and test together fails", async () => {
    for (let i = 0; i < SEEDS; i++) {
      const d = build("ds-train-only-scaling", i);
      const spends = [...file(d, "train.csv").rows, ...file(d, "test.csv").rows].map((r) => Number(r[2]));
      const m = spends.reduce((s, v) => s + v, 0) / spends.length;
      const sd = Math.sqrt(spends.reduce((s, v) => s + (v - m) ** 2, 0) / spends.length);
      const key = d.key as NumbersKey;
      const leaky = { ...exact(key), train_mean: m.toFixed(2), train_std: sd.toFixed(2) };
      expect((await mlTool.grade(d.content as never, key as never, { answers: leaky })).passed).toBe(false);
    }
  });

  for (const id of ["ds-course-completion", "ds-default-leakage"]) {
    it(`${id}: labels stay on the server, constant answers fail, and the grade never reveals the score`, async () => {
      for (let i = 0; i < 3; i++) {
        const d = build(id, i);
        const key = d.key as PredictKey;
        const test = file(d, "test.csv");
        expect(test.rows.length).toBe(d.content.expectedPredictions);
        expect(test.cols).not.toContain(id === "ds-course-completion" ? "completed" : "defaulted");
        expect(JSON.stringify(d.content)).not.toContain("yTest");
        expect(key.threshold).toBeGreaterThan(key.baseline);
        for (const c of [0, 1]) expect(score(key.metric, key.yTest, key.yTest.map(() => c))).toBeLessThan(key.threshold);
        const perfect = await mlTool.grade(d.content as never, key as never, { predictions: key.yTest });
        expect(perfect.passed).toBe(true);
        expect(perfect.message).not.toMatch(/\d\.\d/);
        expect((await mlTool.grade(d.content as never, key as never, { predictions: key.yTest.map(() => 0) })).passed).toBe(false);
      }
    }, 60_000);
  }
});

describe("data-scientist tickets on the company data", () => {
  const seeds = Array.from({ length: 8 }, (_, i) => hashSeed("ds-world", i));

  for (const t of DS_STATS_TEMPLATES) {
    it(`${t.id}: passes checks, and the server-computed answers grade as correct`, async () => {
      for (const seed of seeds.slice(0, 4)) {
        const picked = pickOffice({ templates: [t], areaKey: "exploratory-analysis", difficulty: t.difficulty, level: "fresher", rng: makeRng(seed), avoidTitles: [], tables: generateBrightCart(seed) }, checkStats);
        expect(picked).not.toBeNull();
        const expected = picked!.checked.expected;
        const content = { questions: picked!.draft.questions.map((q) => ({ id: q.id, fields: [] })) };
        const answers = Object.fromEntries(expected.map((e) => [e.key, typeof e.value === "number" ? e.value.toFixed(4) : e.value]));
        expect((await statisticsTool.grade(content as never, { questions: picked!.draft.questions, expected } as never, { answers })).passed).toBe(true);
        expect((await statisticsTool.grade(content as never, { questions: picked!.draft.questions, expected } as never, { answers: {} })).passed).toBe(false);
      }
    });
  }

  for (const t of DS_STORY_TEMPLATES) {
    it(`${t.id}: buildable for most users, answers fit the form and grade as correct`, async () => {
      let ok = 0;
      for (const seed of seeds) {
        const clean = generateBrightCart(seed);
        const before = JSON.stringify(clean);
        const draft = t.build(makeRng(seed), clean);
        expect(JSON.stringify(clean), "the clean warehouse must not be changed").toBe(before);
        if (!draft) continue;
        const verdict = checkInvestigation(draft);
        expect(verdict.ok, verdict.ok ? "" : verdict.reason).toBe(true);
        const content = { fields: draft.fields };
        const key = { answers: draft.answers, tolerance: draft.tolerance };
        expect((await investigationTool.grade(content as never, key as never, { answers: draft.answers })).passed).toBe(true);
        const wrong = { ...draft.answers, [draft.fields[0].key]: draft.fields[0].type === "number" ? 999999999 : "nobody" };
        expect((await investigationTool.grade(content as never, key as never, { answers: wrong })).passed).toBe(false);
        ok++;
      }
      expect(ok).toBeGreaterThanOrEqual(5);
    });
  }
});

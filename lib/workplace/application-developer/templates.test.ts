import { describe, expect, it } from "vitest";
import { sqlJsRunner } from "@/lib/arena-content/sqljs-runner";
import { datasetProblems } from "@/lib/arena-workstations/engines/dataset";
import { validateBlueprint } from "@/lib/arena-roles/blueprint";
import { APPLICATION_DEVELOPER } from "@/lib/arena-roles/blueprints/application-developer";
import { TOOLKIT } from "@/lib/arena-roles/toolkit/application-developer";
import { validateToolkit } from "@/lib/arena-roles/toolkit/types";
import { same } from "../code/compare";
import { runChecks } from "../devops/checks";
import { runFrontendChecks } from "../frontend/checks";
import { hashSeed, makeRng } from "../rng";
import { runSqlScript } from "../sql/local-runner";
import { templateTiers, validateDraft, type Runners } from "../tickets/pick";
import { APP_DEV_CODE_PROBLEMS } from "./code-problems";
import { APP_DEV_DEVOPS_TEMPLATES } from "./devops-templates";
import { APP_DEV_FRONTEND_TEMPLATES } from "./frontend-templates";
import { APP_DEV_SQL_TEMPLATES } from "./sql-templates";
import { generateKaarya } from "./world";

const ALL = [...APP_DEV_CODE_PROBLEMS, ...APP_DEV_FRONTEND_TEMPLATES, ...APP_DEV_DEVOPS_TEMPLATES, ...APP_DEV_SQL_TEMPLATES];
const runners: Runners = { query: sqlJsRunner, script: (seed, script, probes) => runSqlScript(seed, script, probes) };
const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("appdev-test", i));
const runJs = (source: string, fn: string, args: unknown[]) => new Function(`${source}\nreturn ${fn};`)()(...structuredClone(args));

describe("Application Developer role", () => {
  it("has a valid blueprint and toolkit, and every area has a fresher easy ticket", () => {
    expect(validateBlueprint(APPLICATION_DEVELOPER)).toEqual([]);
    expect(validateToolkit(TOOLKIT)).toEqual([]);
    expect(TOOLKIT.roleKey).toBe(APPLICATION_DEVELOPER.domainRoleKey);
    expect(ALL.length).toBeGreaterThanOrEqual(10);
    for (const area of APPLICATION_DEVELOPER.areas) {
      const own = ALL.filter((t) => t.areas?.includes(area.areaKey));
      expect(own.some((t) => t.difficulty === "easy" && t.minLevel === "fresher"), area.areaKey).toBe(true);
      // the shared resolver finds this area's tickets for a fresher
      expect(templateTiers(own, { difficulty: "easy", level: "fresher", areaKey: area.areaKey })[0]?.length, area.areaKey).toBeGreaterThan(0);
    }
    expect(new Set(ALL.map((t) => t.difficulty))).toEqual(new Set(["easy", "medium"]));
  });

  it("states the client-run limit and does not claim what is not assessed", () => {
    expect(APPLICATION_DEVELOPER.limitations.join(" ")).toMatch(/browser/);
    expect(TOOLKIT.honestLimits.join(" ")).toMatch(/client-run/);
    expect(TOOLKIT.honestLimits.join(" ")).toMatch(/Git/);
    expect(APPLICATION_DEVELOPER.unassessed!.map((u) => u.id)).toEqual(expect.arrayContaining(["ad.git", "ad.tests", "ad.integration"]));
  });
});

describe("Application Developer code tickets", () => {
  for (const p of APP_DEV_CODE_PROBLEMS) {
    it(`${p.id}: answers are plain JSON, an empty or all-null answer fails, and a debugging starter is partly right`, () => {
      for (const seed of SEEDS) {
        const d = p.build(makeRng(seed));
        expect(d.content.cases.length).toBeGreaterThanOrEqual(8);
        expect(d.key.expected).toHaveLength(d.content.cases.length);
        expect(JSON.parse(JSON.stringify(d.key.expected))).toEqual(d.key.expected);
        expect(d.key.expected.every((e) => same(e, null))).toBe(false);
        if (p.areas[0] === "app-debugging") {
          const got = d.content.cases.map((c) => { try { return runJs(d.content.starters.javascript, d.content.fn, c); } catch { return Symbol("error"); } });
          const right = got.filter((g, i) => same(g, d.key.expected[i])).length;
          expect(right, `${p.id} broken starter`).toBeGreaterThan(0);
          expect(right, `${p.id} broken starter`).toBeLessThan(got.length);
        }
      }
    });
  }
});

describe("Application Developer file tickets", () => {
  const cases = [
    ...APP_DEV_FRONTEND_TEMPLATES.map((t) => ({ t, run: runFrontendChecks })),
    ...APP_DEV_DEVOPS_TEMPLATES.map((t) => ({ t, run: runChecks as typeof runFrontendChecks })),
  ];
  for (const { t, run } of cases) {
    it(`${t.id}: the solution passes every check and the starter fails at least two`, () => {
      const files = t.draft.content.files.map((f) => t.solution.find((s) => s.name === f.name) ?? f);
      const checks = t.draft.key.checks as Parameters<typeof run>[1];
      expect(run(files, checks).filter((r) => !r.passed).map((r) => r.label)).toEqual([]);
      expect(run(t.draft.content.files, checks).filter((r) => !r.passed).length).toBeGreaterThanOrEqual(2);
      expect(run([{ name: t.draft.content.files[0].name, content: "" }], checks).every((r) => r.passed)).toBe(false);
      expect(t.draft.content.requirements).toHaveLength(checks.length);
    });
  }
});

describe("Kaarya app database and data-access tickets", () => {
  it("is deterministic per seed, valid, and plants one case-only duplicate email with no tasks", () => {
    expect(generateKaarya(3)).toEqual(generateKaarya(3));
    expect(generateKaarya(3)).not.toEqual(generateKaarya(4));
    const [users, , tasks] = generateKaarya(7);
    for (const t of generateKaarya(7)) expect(datasetProblems(t, { minRows: 5, maxRows: 2000 })).toEqual([]);
    const emails = users.rows.map((r) => String(r[2]).toLowerCase());
    expect(emails.length - new Set(emails).size).toBe(1);
    const twinId = users.rows[users.rows.length - 1][0];
    expect(tasks.rows.some((r) => r[2] === twinId)).toBe(false);
  });

  for (const template of APP_DEV_SQL_TEMPLATES) {
    it(`${template.id}: the reference passes and the common mistake (and doing nothing) is caught for most users`, async () => {
      let ok = 0;
      const reasons: string[] = [];
      for (const seed of SEEDS) {
        const verdict = await validateDraft(template.build(makeRng(seed)), generateKaarya(seed), runners);
        if (verdict.ok) ok++;
        else reasons.push(verdict.reason);
      }
      expect(ok, `rejections: ${reasons.join(" | ")}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.7));
    }, 90_000);
  }
});

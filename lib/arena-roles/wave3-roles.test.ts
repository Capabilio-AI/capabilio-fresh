import { describe, expect, it } from "vitest";
import { sqlJsRunner } from "@/lib/arena-content/sqljs-runner";
import { isRegisteredTool, toolFor } from "@/lib/arena-workstations/registry";
import { WORKSTATIONS } from "@/components/arena/workstations/registry";
import { isTemplateOnlyArea } from "@/lib/arena-workstations/template-only";
import { same } from "@/lib/workplace/code/compare";
import { runChecks } from "@/lib/workplace/devops/checks";
import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { runSqlScript } from "@/lib/workplace/sql/local-runner";
import { templateTiers, validateDraft, type Runners } from "@/lib/workplace/tickets/pick";
import { generateKaarya } from "@/lib/workplace/application-developer/world";
import { worldForRole } from "@/lib/workplace/worlds";
import { CLOUD_SUPPORT_CODE_PROBLEMS } from "@/lib/workplace/cloud-platform-support/code-problems";
import { CLOUD_SUPPORT_DEVOPS_TEMPLATES } from "@/lib/workplace/cloud-platform-support/devops-templates";
import { DATA_APPS_CODE_PROBLEMS } from "@/lib/workplace/data-applications/code-problems";
import { DATA_APPS_SQL_TEMPLATES } from "@/lib/workplace/data-applications/sql-templates";
import { TEST_AUTOMATION_CODE_PROBLEMS } from "@/lib/workplace/test-automation/code-problems";
import { TEST_AUTOMATION_DEVOPS_TEMPLATES } from "@/lib/workplace/test-automation/devops-templates";
import { catalogRoleForDomainKey } from "./catalog";
import { validateBlueprint, type RoleBlueprint } from "./blueprint";
import { validateToolkit } from "./toolkit/types";
import { toolkitFor } from "./toolkit";
import { APPLICATION_DEVELOPER } from "./blueprints/application-developer";
import { CLOUD_PLATFORM_SUPPORT_ENGINEER } from "./blueprints/cloud-platform-support-engineer";
import { DATA_APPLICATIONS_ENGINEER } from "./blueprints/data-applications-engineer";
import { TEST_AUTOMATION_ENGINEER } from "./blueprints/test-automation-engineer";

type Tickets = { areas?: string[]; difficulty: string; minLevel: string };
const ROLES: { blueprint: RoleBlueprint; tickets: Tickets[] }[] = [
  { blueprint: DATA_APPLICATIONS_ENGINEER, tickets: [...DATA_APPS_CODE_PROBLEMS, ...DATA_APPS_SQL_TEMPLATES] },
  { blueprint: CLOUD_PLATFORM_SUPPORT_ENGINEER, tickets: [...CLOUD_SUPPORT_CODE_PROBLEMS, ...CLOUD_SUPPORT_DEVOPS_TEMPLATES] },
  { blueprint: TEST_AUTOMATION_ENGINEER, tickets: [...TEST_AUTOMATION_CODE_PROBLEMS, ...TEST_AUTOMATION_DEVOPS_TEMPLATES] },
];

const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("wave3-test", i));
const runners: Runners = { query: sqlJsRunner, script: (seed, script, probes) => runSqlScript(seed, script, probes) };
const runJs = (source: string, fn: string, args: unknown[]) => new Function(`${source}\nreturn ${fn};`)()(...structuredClone(args));

describe("wave 3 software roles (MCA-03, MCA-04, MCA-05)", () => {
  for (const { blueprint: b, tickets } of ROLES) {
    describe(b.name, () => {
      it("has a well-formed blueprint and toolkit, and is the catalog's role for its key", () => {
        expect(validateBlueprint(b)).toEqual([]);
        const kit = toolkitFor(b.domainRoleKey);
        expect(kit, "toolkit").not.toBeNull();
        expect(validateToolkit(kit!)).toEqual([]);
        expect(kit!.roleId).toBe(b.roleId);
        expect(catalogRoleForDomainKey(b.domainRoleKey)?.id).toBe(b.roleId);
      });

      it("serves every enabled area with a registered server tool and client renderer at the declared versions", () => {
        for (const a of b.areas.filter((x) => x.status === "enabled")) {
          expect(isRegisteredTool(a.toolType), a.areaKey).toBe(true);
          const tool = toolFor(a.toolType);
          expect([tool.generationVersion, tool.gradingVersion], a.areaKey).toEqual([a.generationVersion, a.gradingVersion]);
          expect(WORKSTATIONS[a.toolType], `${a.toolType} renderer`).toBeDefined();
        }
      });

      it("has a fresher easy ticket and at least two tickets in every area, and the shared resolver finds them", () => {
        for (const a of b.areas) {
          const mine = tickets.filter((t) => t.areas?.includes(a.areaKey));
          expect(mine.length, a.areaKey).toBeGreaterThanOrEqual(2);
          expect(mine.some((t) => t.difficulty === "easy" && t.minLevel === "fresher"), a.areaKey).toBe(true);
          expect(templateTiers(mine as never, { difficulty: "easy", level: "fresher", areaKey: a.areaKey })[0]?.length, a.areaKey).toBeGreaterThan(0);
        }
      });

      it("says what it cannot assess", () => {
        expect(b.limitations.join(" ")).toMatch(/fixed templates/);
        expect(b.unassessed!.length).toBeGreaterThanOrEqual(4);
        expect(toolkitFor(b.domainRoleKey)!.honestLimits.join(" ")).toMatch(/not assessed|not built|no live|nothing is deployed|no pipeline/i);
      });
    });
  }

  it("never shares an area key with another role, so each role's tickets stay its own", () => {
    const seen = new Map<string, string>();
    for (const b of [APPLICATION_DEVELOPER, ...ROLES.map((r) => r.blueprint)]) {
      for (const a of b.areas) {
        const k = `${a.toolType}:${a.areaKey}`;
        expect(seen.get(k) ?? b.domainRoleKey, k).toBe(b.domainRoleKey);
        seen.set(k, b.domainRoleKey);
      }
    }
  });

  it("keeps the code and config areas template-only (the shared AI generators have no brief for them)", () => {
    for (const { blueprint: b } of ROLES) {
      for (const a of b.areas.filter((x) => x.toolType !== "sql_workspace")) expect(isTemplateOnlyArea(a.areaKey), a.areaKey).toBe(true);
    }
  });

  it("gives the data role the Kaarya database with its own tickets, not the Application Developer's", () => {
    const world = worldForRole("data-applications-engineer")!;
    expect(world.templates).toBe(DATA_APPS_SQL_TEMPLATES);
    expect(worldForRole("application-developer")!.templates).not.toBe(DATA_APPS_SQL_TEMPLATES);
    expect(world.engine).toBe("sqlite");
  });
});

describe("wave 3 code tickets", () => {
  for (const p of [...DATA_APPS_CODE_PROBLEMS, ...CLOUD_SUPPORT_CODE_PROBLEMS, ...TEST_AUTOMATION_CODE_PROBLEMS]) {
    it(`${p.id}: answers are plain JSON, the examples agree with the answers, and an all-null answer fails`, () => {
      for (const seed of SEEDS) {
        const d = p.build(makeRng(seed));
        expect(d.content.cases.length).toBeGreaterThanOrEqual(8);
        expect(d.key.expected).toHaveLength(d.content.cases.length);
        expect(JSON.parse(JSON.stringify(d.key.expected))).toEqual(d.key.expected);
        expect(d.key.expected.every((e) => same(e, null))).toBe(false);
        d.content.examples.forEach((ex, i) => expect(same(ex.expected, d.key.expected[i])).toBe(true));
        // an untouched starter must not already pass every case
        const got = d.content.cases.map((c) => { try { return runJs(d.content.starters.javascript, d.content.fn, c); } catch { return Symbol("error"); } });
        expect(got.every((g, i) => same(g, d.key.expected[i]))).toBe(false);
      }
    });
  }
});

describe("wave 3 config tickets", () => {
  for (const t of [...CLOUD_SUPPORT_DEVOPS_TEMPLATES, ...TEST_AUTOMATION_DEVOPS_TEMPLATES]) {
    it(`${t.id}: the solution passes every check and the starter fails at least two`, () => {
      const files = t.draft.content.files.map((f) => t.solution.find((s) => s.name === f.name) ?? f);
      const checks = t.draft.key.checks;
      expect(runChecks(files, checks).filter((r) => !r.passed).map((r) => r.label)).toEqual([]);
      expect(runChecks(t.draft.content.files, checks).filter((r) => !r.passed).length).toBeGreaterThanOrEqual(2);
      expect(runChecks([{ name: t.draft.content.files[0].name, content: "" }], checks).every((r) => r.passed)).toBe(false);
      expect(t.draft.content.requirements).toHaveLength(checks.length);
    });
  }
});

describe("data applications SQL tickets on the Kaarya database", () => {
  for (const template of DATA_APPS_SQL_TEMPLATES) {
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

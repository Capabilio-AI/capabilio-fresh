import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isRegisteredTool, toolFor } from "@/lib/arena-workstations/registry";
import { referenceSubmission } from "@/lib/arena-workstations/reference-submission";
import { hashSeed } from "@/lib/workplace/rng";
import { BACKEND_DEVELOPER } from "../blueprints/backend-developer";
import { catalogRole } from "../catalog";
import { BACKEND_SERVICE } from "../sessions/backend-developer-service";
import { SPECS } from "./service";

describe("IT-02 Backend Developer Proof Session spec", () => {
  it("is the Backend Developer session, registered for its role", () => {
    expect([BACKEND_SERVICE.roleId, BACKEND_SERVICE.domainRoleKey]).toEqual([BACKEND_DEVELOPER.roleId, BACKEND_DEVELOPER.domainRoleKey]);
    expect(catalogRole(BACKEND_SERVICE.roleId)?.domainRoleKey).toBe(BACKEND_SERVICE.domainRoleKey);
    expect(SPECS[BACKEND_SERVICE.domainRoleKey]).toBe(BACKEND_SERVICE);
  });

  it("has one stage per backend skill area, each an enabled, registered area, in the same order for every level", () => {
    const stages = BACKEND_SERVICE.stagesFor("fresher");
    expect(stages.map((s) => s.areaKey)).toEqual(BACKEND_DEVELOPER.areas.map((a) => a.areaKey));
    expect(new Set(stages.map((s) => s.key)).size).toBe(5);
    for (const stage of stages) {
      const area = BACKEND_DEVELOPER.areas.find((a) => a.areaKey === stage.areaKey);
      expect(area?.status, stage.key).toBe("enabled");
      expect(isRegisteredTool(area!.toolType), stage.key).toBe(true);
    }
    for (const level of ["junior", "mid", "senior"] as const) expect(BACKEND_SERVICE.stagesFor(level)).toEqual(stages);
  });

  it("does not claim what the code workstation cannot show", () => {
    expect(BACKEND_SERVICE.limitations.join(" ")).toMatch(/browser/);
    expect(BACKEND_SERVICE.limitations.join(" ")).toMatch(/no real HTTP server/);
    expect(BACKEND_SERVICE.claimSubject).not.toMatch(/certif|professional/i);
  });
});

describe("every Backend stage is solvable, whichever student gets it", () => {
  // the fixed problems stand in for the AI-written ones, so this runs with no AI and no database
  const before = process.env.CODE_AI_GENERATION;
  beforeAll(() => { process.env.CODE_AI_GENERATION = "off"; });
  afterAll(() => { if (before === undefined) delete process.env.CODE_AI_GENERATION; else process.env.CODE_AI_GENERATION = before; });

  const STUDENTS = 25;
  for (const stage of BACKEND_SERVICE.stagesFor("fresher")) {
    it(`${stage.key} (${stage.areaKey}): the reference answer passes and a wrong one fails, for ${STUDENTS} students`, async () => {
      const tool = toolFor("code_workspace");
      const problems: string[] = [];
      for (let n = 0; n < STUDENTS; n++) {
        const userId = `student-${n}`;
        const generated = await tool.generate({
          roleName: "Backend Developer", parentSkill: "Backend Development", areaName: stage.title, difficulty: "easy", avoidTitles: [], roleKey: "backend-developer", areaKey: stage.areaKey,
          ticketSeed: hashSeed(userId, "backend-developer", "session", `s-${n}`, stage.key), level: "fresher", recentKinds: [],
        });
        const parsed = tool.submissionSchema.safeParse(referenceSubmission("code_workspace", generated.content, generated.answer_key));
        if (!parsed.success) { problems.push(`${userId}: reference rejected`); continue; }
        if (!(await tool.grade(generated.content, generated.answer_key, parsed.data)).passed) problems.push(`${userId}: reference did not pass`);
        const wrong = tool.submissionSchema.parse({ language: "javascript", outputs: [] });
        if ((await tool.grade(generated.content, generated.answer_key, wrong)).passed) problems.push(`${userId}: empty answer passed`);
      }
      expect(problems).toEqual([]);
    }, 120_000);
  }
});

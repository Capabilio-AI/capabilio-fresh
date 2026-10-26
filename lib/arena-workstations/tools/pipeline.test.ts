import { describe, expect, it } from "vitest";
import { PIPELINE_TEMPLATES } from "@/lib/workplace/pipeline/templates";
import { GenerationRejected } from "../types";
import { pipelineTool } from "./pipeline";

const ctx = (areaKey: string) => ({ roleName: "Data Engineer", parentSkill: "Data Engineering", areaName: areaKey, difficulty: "easy" as const, avoidTitles: [], areaKey, level: "fresher" as const, ticketSeed: 1 });

describe("pipeline tool", () => {
  it("serves a ticket for each of its areas, with the checks kept out of the content", async () => {
    for (const area of ["pipelines", "data-quality", "partitioning-and-storage"]) {
      const c = await pipelineTool.generate(ctx(area));
      expect(PIPELINE_TEMPLATES.find((t) => t.draft.title === c.title)?.areas).toContain(area);
      expect(JSON.stringify(c.content)).not.toContain("\"checks\"");
    }
  });

  it("never serves another area's ticket", async () => {
    await expect(pipelineTool.generate(ctx("transformation"))).rejects.toBeInstanceOf(GenerationRejected);
  });

  it("grades the solution as passed and the starter as not, from the server-held key", async () => {
    const t = PIPELINE_TEMPLATES[0];
    const ok = await pipelineTool.grade(t.draft.content as never, t.draft.key as never, { spec: t.solution });
    expect(ok.passed).toBe(true);
    const bad = await pipelineTool.grade(t.draft.content as never, t.draft.key as never, { spec: t.draft.content.file.content });
    expect(bad.passed).toBe(false);
    expect(bad.checks.some((c) => !c.passed)).toBe(true);
    const empty = await pipelineTool.grade(t.draft.content as never, t.draft.key as never, { spec: "" });
    expect(empty.passed).toBe(false);
    expect(empty.message).toMatch(/could not run/);
  });
});

describe("data engineer role descriptors", () => {
  it("blueprint and toolkit are well-formed and use this tool's versions", async () => {
    const { validateBlueprint } = await import("@/lib/arena-roles/blueprint");
    const { validateToolkit } = await import("@/lib/arena-roles/toolkit/types");
    const { DATA_ENGINEER } = await import("@/lib/arena-roles/blueprints/data-engineer");
    const { TOOLKIT } = await import("@/lib/arena-roles/toolkit/data-engineer");
    expect(validateBlueprint(DATA_ENGINEER)).toEqual([]);
    expect(validateToolkit(TOOLKIT)).toEqual([]);
    for (const a of DATA_ENGINEER.areas.filter((x) => x.toolType === pipelineTool.toolType)) {
      expect([a.generationVersion, a.gradingVersion]).toEqual([pipelineTool.generationVersion, pipelineTool.gradingVersion]);
    }
  });
});

import { describe, expect, it } from "vitest";
import type { Json } from "@/lib/supabase/types";
import { solutionFor } from "@/lib/workplace/soc/checks";
import type { SocKey } from "@/lib/workplace/soc/types";
import { GenerationRejected, type Difficulty } from "../types";
import { socTool } from "./soc";

const AREAS = ["alert-triage", "log-investigation", "threat-mapping", "incident-response", "phishing-analysis"];
const ctx = (areaKey: string, difficulty: Difficulty = "easy", ticketSeed = 17) => ({ roleName: "SOC Analyst", parentSkill: "Security Operations", areaName: areaKey, difficulty, avoidTitles: [], areaKey, ticketSeed, level: "fresher" as const });

describe("soc_workspace tool", () => {
  it("serves a ticket for every area and difficulty; the server-side solution passes and an empty submission fails", async () => {
    for (const area of AREAS) {
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        const g = await socTool.generate(ctx(area, difficulty));
        expect(g.title.length).toBeGreaterThan(8);
        expect(g.origin?.provider).toBe("template");
        const ok = await socTool.grade(g.content, g.answer_key, socTool.submissionSchema.parse(solutionFor(g.answer_key as unknown as SocKey)));
        expect(ok.passed).toBe(true);
        const empty = await socTool.grade(g.content, g.answer_key, socTool.submissionSchema.parse({ alerts: {} }));
        expect(empty.passed).toBe(false);
        expect(empty.checks.every((c) => !c.passed)).toBe(true);
      }
    }
  });

  it("is deterministic for a ticket seed", async () => {
    expect(await socTool.generate(ctx("alert-triage", "medium", 3))).toEqual(await socTool.generate(ctx("alert-triage", "medium", 3)));
  });

  it("refuses an area it does not serve instead of handing out another role's work", async () => {
    await expect(socTool.generate(ctx("model-training"))).rejects.toBeInstanceOf(GenerationRejected);
  });

  it("never puts expected values in the feedback", async () => {
    const g = await socTool.generate(ctx("phishing-analysis"));
    const res = await socTool.grade(g.content, g.answer_key, { alerts: {} });
    const said = JSON.stringify(res);
    for (const word of ["true_positive", "false_positive", "critical", "isolate_host", "T1"]) expect(said).not.toContain(word);
  });

  it("rejects oversized submissions at the schema", () => {
    expect(socTool.submissionSchema.safeParse({ alerts: { A: { evidence: Array.from({ length: 41 }, () => "L0001") } } }).success).toBe(false);
    expect(socTool.submissionSchema.safeParse({ alerts: {}, note: "x".repeat(2001) }).success).toBe(false);
    expect(socTool.submissionSchema.safeParse({ alerts: {} } as Json).success).toBe(true);
  });
});

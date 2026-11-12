import { afterEach, describe, expect, it } from "vitest";
import { mockAdapter, setAdapterForTest } from "@/lib/ai/llm";
import { FrameworkUnavailable, buildFramework, frameworkMeta, identifyRole } from "./role-framework";

const deps = { env: { LLM_PROVIDER: "mock", LLM_MODEL: "m" }, sleep: async () => {}, random: () => 0, attempts: 1, repairs: 0 };
const TIERS = ["CORE", "CORE", "CORE", "CORE", "CORE", "CORE", "INDUSTRY", "TOOL", "PRACTICAL", "SUPPORTING", "SUPPORTING", "ADVANCED"];
const skills = (tag: string) => TIERS.map((tier, i) => ({ name: `${tag} skill ${i}`, tier, category: "technical", description: `Do the ${tag} thing ${i} at entry level.`, rationale: `The role relies on ${tag} ${i}.`, assessmentType: "practical" }));
const framework = (tag: string) => ({ roleSummary: `A ${tag} professional does ${tag} work daily.`, entryLevelExpectation: `A fresher can do basic ${tag} tasks unaided.`, responsibilities: ["first duty here", "second duty here", "third duty here"], tools: [], skills: skills(tag) });
const review = (tag: string, over: Record<string, unknown> = {}) => ({ roleIdentityMatches: true, confidence: 0.8, skills: skills(tag).map((s) => ({ name: s.name, relevance: 4, isGeneralEmployability: false, entryLevelAppropriate: true, comment: "" })), missingCoreSkills: [], concerns: [], ...over });

/** The k-th draft is `a`-tagged then `b`-tagged; the reviewer answers per call number. */
function scripted(reviews: Record<string, unknown>[]) {
  let drafts = 0;
  let reviewed = 0;
  const m = mockAdapter((req) => {
    if (req.system.includes("strict reviewer")) return reviews[reviewed++] ?? reviews.at(-1)!;
    drafts += 1;
    return framework(`draft${drafts}`);
  });
  setAdapterForTest("mock", m);
  return m;
}
afterEach(() => setAdapterForTest("mock", null));
const ctx = { industry: "Automotive", domain: "Mechanical" };

describe("buildFramework", () => {
  it("accepts a sound first draft with one draft and one review", async () => {
    const m = scripted([review("draft1")]);
    const b = await buildFramework("Automotive Design Engineer", ctx, deps);
    expect(b.verified).toBe(true);
    expect(b.attempts).toBe(1);
    expect(m.calls).toHaveLength(2);
    expect(b.gate.skills).toHaveLength(12);
  });

  it("drafts again, naming the missing skills, when the reviewer says three or more important ones are missing, and keeps the draft that misses fewer", async () => {
    const m = scripted([review("draft1", { missingCoreSkills: ["A", "B", "C"] }), review("draft2", { missingCoreSkills: ["A"] })]);
    const b = await buildFramework("Quantity Surveyor", ctx, deps);
    expect(b.attempts).toBe(2);
    expect(b.framework.skills[0].name).toBe("draft2 skill 0");
    expect(m.calls[2].req.system).toContain("A, B, C"); // the retry was told what was missing
    // and when the retry is no better, the first sound draft stands
    scripted([review("draft1", { missingCoreSkills: ["A", "B", "C"] }), review("draft2", { missingCoreSkills: ["A", "B", "C", "D"] })]);
    expect((await buildFramework("Quantity Surveyor", ctx, deps)).framework.skills[0].name).toBe("draft1 skill 0");
  });

  it("retries once with the reviewer's objections, then refuses a framework the reviewer says is a different role", async () => {
    const m = scripted([review("draft1", { roleIdentityMatches: false })]);
    await expect(buildFramework("Railway Signalling Engineer", ctx, deps)).rejects.toBeInstanceOf(FrameworkUnavailable);
    expect(m.calls).toHaveLength(4);
    expect(m.calls[2].req.system).toContain("different role");
  });

  it("keeps a low-confidence framework only as an unverified draft", async () => {
    scripted([review("draft1", { confidence: 0.4 })]);
    const b = await buildFramework("Battery Management Systems Engineer", ctx, deps);
    expect(b.verified).toBe(false);
    expect(frameworkMeta(b, null, null)).toMatchObject({ verifiedByReviewerPass: false, needsHumanReview: true, sourceCoverage: "NONE", sources: [] });
  });

  it("lets a model outage propagate instead of inventing skills", async () => {
    setAdapterForTest("mock", mockAdapter(() => { throw new Error("provider down"); }));
    await expect(buildFramework("GIS Analyst", ctx, deps)).rejects.toThrow();
  });
});

describe("frameworkMeta", () => {
  it("never claims sources or verification it does not have", async () => {
    scripted([review("draft1")]);
    const b = await buildFramework("GIS Analyst", ctx, deps);
    const meta = frameworkMeta(b, { isValidRole: true, canonicalTitle: "GIS Analyst", industry: "Geospatial", domain: "Civil", seniority: "entry", roleConfidence: 0.9, specializationsNeeded: false, specializations: [] }, null, new Date("2026-11-12T00:00:00Z"));
    expect(meta).toMatchObject({ roleConfidence: 0.9, sourceCoverage: "NONE", sources: [], needsHumanReview: true, researchedAt: "2026-11-12T00:00:00.000Z" });
    expect(meta.researchNote).toMatch(/No external occupational sources/);
  });
});

describe("identifyRole", () => {
  it("returns the model's identification and keeps the student's own title", async () => {
    setAdapterForTest("mock", mockAdapter(() => ({ isValidRole: true, canonicalTitle: "Automobile Engineer", industry: "Automotive", domain: "Mechanical", roleConfidence: 0.95, specializationsNeeded: true, specializations: [{ title: "Automotive Design Engineer", description: "Designs vehicle parts." }, { title: "Automotive Testing Engineer", description: "Tests vehicles." }] })));
    const { identity } = await identifyRole("automobile engineer", [], deps);
    expect(identity.canonicalTitle).toBe("Automobile Engineer");
    expect(identity.specializations).toHaveLength(2);
  });
});

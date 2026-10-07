import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ChildSkillsFile } from "./skills-spec";
import { TemplateSpecSchema, templateHash, validateTemplateSpec } from "./template-spec";

// The 53 skills that were active in the taxonomy when these trees were authored (the starter set). Child skills come from the review file.
const STARTER_ACTIVE = ["Algorithm Analysis","Algorithms","API Design","Artificial Intelligence Fundamentals","BI / Dashboarding","Business Analysis","C Programming","C++ Programming","CI/CD","Cloud Computing","Compiler Design","Computer Architecture","Computer Networks","Containerization","Cryptography","Data Analysis","Data Cleaning","Data Mining","Data Structures","Data Warehousing","Database Management Systems","Deep Learning","Discrete Mathematics","Excel / Spreadsheets","Graph Algorithms","Information Security Fundamentals","Java","JavaScript","Linear Algebra","Linux","Machine Learning","Natural Language Processing","Network Security","NoSQL Databases","Object-Oriented Programming","Operating Systems","Probability","Problem Solving","Product Management","Programming Fundamentals","Project Management","Python","Relational Database Design","Software Engineering","Software Testing","SQL","Statistics","System Design","Teamwork","Technical Communication","UI/UX Design","Version Control","Web Development"];
const children = ChildSkillsFile.parse(JSON.parse(readFileSync("content/skills/roadmap-child-skills.json", "utf8"))).skills.map((s) => s.name);
const ref = {
  skills: { statusByName: new Map<string, "active" | "candidate">([...STARTER_ACTIVE.map((n) => [n, "active"] as const), ...children.map((n) => [n, "active"] as const)]) },
  careers: new Map([["software-engineer", "id1"], ["data-analyst", "id2"], ["ai-ml-engineer", "id3"]]),
};
const files = readdirSync("content/roadmaps").filter((f) => f.endsWith(".json"));

describe("the authored roadmap trees", () => {
  it("there is one for each of the three starter careers", () => {
    expect(files.sort()).toEqual(["ai-ml-engineer.v1.json", "data-analyst.v1.json", "software-engineer.v1.json"]);
  });
  for (const file of files) {
    const spec = JSON.parse(readFileSync(`content/roadmaps/${file}`, "utf8"));
    describe(file, () => {
      const v = validateTemplateSpec(spec, ref);
      it("is valid: canonical skills only, no cycles, stages ordered, every topic described", () => expect(v.errors).toEqual([]));
      it("records its provenance as original work", () => {
        expect(spec.provenance.designedBy).toBe("Capabilio");
        expect(spec.provenance.notes).toMatch(/not derived from any third-party roadmap/);
      });
      it("uses only starter skills or skills in the child-skills review file (nothing invented)", () => {
        const used = new Set<string>(spec.nodes.flatMap((n: { skill: string | null }) => (n.skill ? [n.skill] : [])));
        for (const s of used) expect(STARTER_ACTIVE.includes(s) || children.includes(s), s).toBe(true);
      });
      it("has a full spine with groups on both sides, and 30+ topics", () => {
        const parsed = TemplateSpecSchema.parse(spec);
        expect(parsed.nodes.filter((n) => n.type === "SPINE")).toHaveLength(8);
        const sides = new Set(parsed.nodes.filter((n) => n.type === "GROUP").map((n) => n.side));
        expect([...sides].sort()).toEqual(["LEFT", "RIGHT"]);
        expect(parsed.nodes.filter((n) => n.type === "TOPIC").length).toBeGreaterThanOrEqual(30);
        expect(new Set(parsed.nodes.filter((n) => n.type === "SPINE").map((n) => n.stage)).size).toBe(4);
      });
      it("hashes the same however its keys, nodes or edges are ordered", () => {
        const parsed = TemplateSpecSchema.parse(spec);
        const shuffled = TemplateSpecSchema.parse({ ...spec, nodes: [...spec.nodes].reverse(), edges: [...spec.edges].reverse() });
        expect(templateHash(shuffled)).toBe(templateHash(parsed));
        expect(templateHash({ ...parsed, title: "changed" })).not.toBe(templateHash(parsed));
      });
    });
  }
});

describe("validateTemplateSpec", () => {
  const spec = JSON.parse(readFileSync("content/roadmaps/data-analyst.v1.json", "utf8"));
  it("rejects an unknown career and a skill that is still a candidate", () => {
    expect(validateTemplateSpec({ ...spec, career: "ghost" }, ref).errors.join(" ")).toMatch(/Unknown career/);
    const pending = { skills: { statusByName: new Map<string, "active" | "candidate">([...ref.skills.statusByName, ["SQL Joins", "candidate"]]) }, careers: ref.careers };
    expect(validateTemplateSpec(spec, pending).errors.join(" ")).toMatch(/SQL Joins" is candidate, not active/);
    expect(validateTemplateSpec(spec, pending, { allowPendingSkills: true }).ok).toBe(true);
  });
  it("rejects a template without provenance and one with a topic missing a description", () => {
    expect(validateTemplateSpec({ ...spec, provenance: undefined }, ref).ok).toBe(false);
    const bad = { ...spec, nodes: spec.nodes.map((n: { type: string }, i: number) => (i === 20 ? { ...n, description: "" } : n)) };
    expect(validateTemplateSpec(bad, ref).ok).toBe(false);
  });
});

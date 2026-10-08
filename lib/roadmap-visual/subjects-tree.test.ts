import { describe, expect, it } from "vitest";
import type { SubjectNode } from "./syllabus-map";
import { buildSubjectsTree, roadmapKeyOf } from "./subjects-tree";

const subject = (over: Partial<SubjectNode> & Pick<SubjectNode, "courseId" | "title">): SubjectNode => ({
  code: null, year: 2, semester: 1, timing: "CURRENT", units: [], topics: [], provenCount: 0, status: "NOT_PROVEN", ...over,
});
const topic = (nodeKey: string, level: number | null, met = false) => ({ nodeKey, title: nodeKey, level, target: 70, met });

describe("buildSubjectsTree", () => {
  const tree = buildSubjectsTree([
    subject({ courseId: "ads", title: "Advanced Data Structures", topics: [topic("arrays", 80, true), topic("linked-lists", null)], provenCount: 1 }),
    subject({ courseId: "adslab", title: "ADS Lab", topics: [topic("arrays", 80, true)], provenCount: 1 }),
    subject({ courseId: "dbms", title: "DBMS", year: 2, semester: 2, timing: "UPCOMING", topics: [topic("sql", 30)] }),
    subject({ courseId: "ethics", title: "Ethics" }),
  ]);

  it("puts semesters on the trunk and drops subjects that teach nothing for this career", () => {
    expect(tree.nodes.filter((n) => n.type === "SPINE").map((n) => n.title)).toEqual(["Semester 3", "Semester 4"]);
    expect(tree.untracked).toBe(1);
  });
  it("keeps one station per subject even when two subjects teach the same topic", () => {
    const arrays = tree.nodes.filter((n) => roadmapKeyOf(n.key) === "arrays");
    expect(arrays).toHaveLength(2);
    expect(new Set(arrays.map((n) => n.key)).size).toBe(2);
  });
  it("derives station status from evidence only", () => {
    const by = (k: string) => tree.nodes.find((n) => roadmapKeyOf(n.key) === k)!.status;
    expect([by("arrays"), by("linked-lists"), by("sql")]).toEqual(["TARGET_MET", "NOT_ASSESSED", "LEARNING"]);
  });
  it("names the subjects to focus on, this semester first", () => {
    expect(tree.focus.map((f) => f.courseId)).toEqual(["ads", "dbms"]);
    expect(tree.focus[0].toProve).toBe(1);
  });
  it("gives every node a box", () => {
    expect(tree.nodes.every((n) => n.box.w > 0)).toBe(true);
  });
});

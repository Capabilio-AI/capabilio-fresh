import { describe, expect, it } from "vitest";
import { clusterKeyForBranch, GENERAL_SCOPE_KEY, IT_CLUSTER_SCOPE_KEY, promptLabelForBranch } from "./branch-clusters";

describe("clusterKeyForBranch", () => {
  it("groups CSE, IT, AI/ML, AI&DS, Data Science, and CSBS into the same shared IT cluster", () => {
    const branches = [
      "Computer Science and Engineering (CSE)",
      "Information Technology (IT)",
      "Artificial Intelligence and Machine Learning (AI/ML)",
      "Artificial Intelligence and Data Science (AI & DS)",
      "Data Science",
      "Computer Science and Business Systems (CSBS)",
    ];
    for (const branch of branches) {
      expect(clusterKeyForBranch(branch)).toBe(IT_CLUSTER_SCOPE_KEY);
    }
  });

  it("gives each non-IT branch its own distinct scope, not a shared 'other' bucket", () => {
    const ece = clusterKeyForBranch("Electronics and Communication Engineering (ECE)");
    const mech = clusterKeyForBranch("Mechanical Engineering");
    const civil = clusterKeyForBranch("Civil Engineering");
    expect(new Set([ece, mech, civil]).size).toBe(3);
    expect(ece).not.toBe(IT_CLUSTER_SCOPE_KEY);
  });

  it("handles a branch string not in the UG catalog (e.g. MBA/MCA) via slugification, still distinct per branch", () => {
    expect(clusterKeyForBranch("MBA")).toBe("branch-mba");
    expect(clusterKeyForBranch("MCA")).toBe("branch-mca");
    expect(clusterKeyForBranch("MBA")).not.toBe(clusterKeyForBranch("MCA"));
  });

  it("falls back to a general scope for a missing branch", () => {
    expect(clusterKeyForBranch(null)).toBe(GENERAL_SCOPE_KEY);
    expect(clusterKeyForBranch("")).toBe(GENERAL_SCOPE_KEY);
  });

  it("recognizes an IT-adjacent branch by keyword even if it doesn't exactly match a catalog name", () => {
    expect(clusterKeyForBranch("B.Tech Computer Science")).toBe(IT_CLUSTER_SCOPE_KEY);
  });
});

describe("promptLabelForBranch", () => {
  it("uses the shared cluster label for any IT-cluster branch, not the specific branch name", () => {
    expect(promptLabelForBranch("Information Technology (IT)")).not.toBe("Information Technology (IT)");
    expect(promptLabelForBranch("Data Science")).toBe(promptLabelForBranch("Computer Science and Engineering (CSE)"));
  });

  it("uses the real branch name as the label for a non-IT branch", () => {
    expect(promptLabelForBranch("Civil Engineering")).toBe("Civil Engineering");
  });
});

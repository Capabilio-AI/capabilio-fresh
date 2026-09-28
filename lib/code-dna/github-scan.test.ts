import { describe, expect, it } from "vitest";
import { detectReadme, detectTechSignals, detectTestDir, normalizeGithubUsername } from "./github-scan";

describe("normalizeGithubUsername", () => {
  it("extracts the username from a pasted profile URL", () => {
    expect(normalizeGithubUsername("https://github.com/Capabilio-AI")).toBe("Capabilio-AI");
  });

  it("extracts the username from a pasted repo URL (a common mistake — pasting the repo, not the profile)", () => {
    expect(normalizeGithubUsername("https://github.com/Capabilio-AI/capabilio-fresh")).toBe("Capabilio-AI");
  });

  it("works without a protocol or www", () => {
    expect(normalizeGithubUsername("github.com/Capabilio-AI")).toBe("Capabilio-AI");
  });

  it("strips a leading @", () => {
    expect(normalizeGithubUsername("@Capabilio-AI")).toBe("Capabilio-AI");
  });

  it("leaves a bare username unchanged", () => {
    expect(normalizeGithubUsername("Capabilio-AI")).toBe("Capabilio-AI");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeGithubUsername("  Capabilio-AI  ")).toBe("Capabilio-AI");
  });
});

describe("detectTechSignals", () => {
  it("detects known signal files only, by exact presence — never guesses", () => {
    expect(detectTechSignals(["package.json", "tsconfig.json", "Dockerfile"])).toEqual(
      expect.arrayContaining(["Node.js", "TypeScript", "Docker"])
    );
  });

  it("returns nothing for an unrecognized file list", () => {
    expect(detectTechSignals(["README.md", "LICENSE", "src"])).toEqual([]);
  });

  it("de-duplicates when multiple files imply the same tech (e.g. requirements.txt + pyproject.toml)", () => {
    expect(detectTechSignals(["requirements.txt", "pyproject.toml"])).toEqual(["Python"]);
  });
});

describe("detectTestDir", () => {
  it("recognizes common test directory names case-insensitively", () => {
    expect(detectTestDir(["tests"])).toBe(true);
    expect(detectTestDir(["__tests__"])).toBe(true);
    expect(detectTestDir(["Spec"])).toBe(true);
  });

  it("returns false when no test directory is present", () => {
    expect(detectTestDir(["src", "package.json"])).toBe(false);
  });
});

describe("detectReadme", () => {
  it("recognizes README with or without an extension, case-insensitively", () => {
    expect(detectReadme(["README.md"])).toBe(true);
    expect(detectReadme(["readme"])).toBe(true);
  });

  it("returns false when there is no README", () => {
    expect(detectReadme(["src", "package.json"])).toBe(false);
  });
});

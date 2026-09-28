import { describe, expect, it } from "vitest";
import { detectReadme, detectTechSignals, detectTestDir } from "./github-scan";

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

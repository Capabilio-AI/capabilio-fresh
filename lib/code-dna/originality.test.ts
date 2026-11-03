import { describe, expect, it } from "vitest";
import { classifyOverlap, isSourceFile, lineOverlap, pickDistinctiveLine, selectProbeFiles, type TreeFile } from "./originality";

const file = (path: string, size = 2000): TreeFile => ({ path, sha: path, size });

describe("isSourceFile", () => {
  it("keeps real source and drops vendored, generated and tiny files", () => {
    expect(isSourceFile(file("src/app/cart.ts"))).toBe(true);
    expect(isSourceFile(file("node_modules/x/index.js"))).toBe(false);
    expect(isSourceFile(file("dist/app.min.js"))).toBe(false);
    expect(isSourceFile(file("next.config.js"))).toBe(false);
    expect(isSourceFile(file("src/tiny.ts", 50))).toBe(false);
    expect(isSourceFile(file("README.md"))).toBe(false);
  });
});

describe("selectProbeFiles", () => {
  it("returns the largest eligible files, deterministically", () => {
    const files = [file("a.ts", 1000), file("b.ts", 5000), file("c.ts", 3000), file("huge.ts", 900_000)];
    expect(selectProbeFiles(files, 2).map((f) => f.path)).toEqual(["b.ts", "c.ts"]);
  });
});

describe("pickDistinctiveLine", () => {
  it("picks the longest meaningful line and ignores imports and comments", () => {
    const src = [
      'import { something } from "a-very-long-module-name-that-is-over-fifty-characters-long";',
      "// this is a long comment line that should never be used as a fingerprint at all ok",
      "const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);",
      "const x = 1;",
    ].join("\n");
    expect(pickDistinctiveLine(src)).toBe("const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);");
  });

  it("returns null when nothing is distinctive", () => {
    expect(pickDistinctiveLine("const a = 1;\nlet b = 2;")).toBeNull();
  });
});

describe("lineOverlap", () => {
  const original = ["function calculateInvoiceTotal(items) {", "  return items.reduce((s, i) => s + i.price, 0);", "}"].join("\n");

  it("is 1 for identical code regardless of indentation", () => {
    expect(lineOverlap(original, original.replace(/^ +/gm, ""))).toBe(1);
  });

  it("is low for unrelated code", () => {
    expect(lineOverlap(original, "class Unrelated extends Base { render() { return null; } }")).toBeLessThan(0.2);
  });
});

describe("classifyOverlap", () => {
  it("needs many identical files for high", () => {
    expect(classifyOverlap({ identicalFiles: 12, comparedFiles: 20, nearCopyProbes: 0 })).toBe("high");
    expect(classifyOverlap({ identicalFiles: 12, comparedFiles: 100, nearCopyProbes: 0 })).toBeNull();
  });

  it("treats two near-identical probe files as high and one as moderate", () => {
    expect(classifyOverlap({ identicalFiles: 0, comparedFiles: 20, nearCopyProbes: 2 })).toBe("high");
    expect(classifyOverlap({ identicalFiles: 0, comparedFiles: 20, nearCopyProbes: 1 })).toBe("moderate");
  });

  it("ignores a couple of shared boilerplate files", () => {
    expect(classifyOverlap({ identicalFiles: 2, comparedFiles: 8, nearCopyProbes: 0 })).toBeNull();
  });
});

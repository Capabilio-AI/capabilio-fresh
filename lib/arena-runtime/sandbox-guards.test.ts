import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

// Student code must never run with the app's own origin: these are structural guards on the browser workstations.
describe("browser workstation isolation", () => {
  it("the live preview iframe is sandboxed without same-origin access", () => {
    const src = read("components/arena/runtime/CodeEditorPreview.tsx");
    expect(src).toContain('sandbox="allow-scripts"');
    expect(src).not.toMatch(/allow-same-origin|allow-top-navigation|allow-forms|allow-popups/);
  });
  it("the preview only trusts messages from its own iframe", () => {
    expect(read("components/arena/runtime/CodeEditorPreview.tsx")).toContain("e.source !== frame.current?.contentWindow");
  });
  it("student SQL runs in the browser sql.js engine, never a server shell", () => {
    const src = read("components/arena/runtime/SqlConsole.tsx");
    expect(src).toContain("runQuery(db");
    expect(src).not.toMatch(/fetch\(/);
  });
  it("Python runs in a worker, not on the page", () => {
    expect(read("lib/arena-runtime/client/python-runner.ts")).toContain("new Worker(");
    expect(read("components/arena/runtime/NotebookPython.tsx")).not.toMatch(/\beval\(|new Function\(/);
  });
  it("no workstation component evaluates strings as code", () => {
    for (const f of ["QuestionFlow", "CalculationWorksheet", "SqlConsole", "CodeEditorPreview", "NotebookPython"]) {
      expect(read(`components/arena/runtime/${f}.tsx`), f).not.toMatch(/\beval\(|new Function\(|dangerouslySetInnerHTML/);
    }
    expect(read("lib/arena-runtime/client/calc-expression.ts")).not.toMatch(/\beval\(|new Function\(/);
  });
});

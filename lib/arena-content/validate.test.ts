import { describe, expect, it } from "vitest";
import { ChallengeSpec, type TemplateSpec } from "./spec";
import { specHash, stableStringify } from "./hash";
import { sqlJsRunner } from "./sqljs-runner";
import { runLocalPython } from "./python-runner";
import { notebookProgram, validateSpec, type ValidationDeps } from "./validate";

const lim = { memoryMb: 256, wallTimeSeconds: 300 };
const templates = new Map<string, TemplateSpec>(
  (
    [
      { key: "qf", name: "Questions", runtimeType: "QUESTION_FLOW", config: {}, tools: [], resourceLimits: {} },
      { key: "calc", name: "Worksheet", runtimeType: "CALCULATION_WORKSHEET", config: { inputs: [{ key: "a", label: "A", unit: "u" }] }, tools: [], resourceLimits: {} },
      { key: "sql", name: "SQL", runtimeType: "SQL_CONSOLE", config: {}, tools: [], resourceLimits: lim },
      { key: "files", name: "Files", runtimeType: "CODE_EDITOR_PREVIEW", config: { framework: "vanilla", entry: "index.html", showPreview: false }, tools: [], resourceLimits: lim },
      { key: "nb", name: "Notebook", runtimeType: "NOTEBOOK_PYTHON", config: { packages: [], evaluationHarness: "h" }, tools: [], resourceLimits: lim },
    ] as TemplateSpec[]
  ).map((t) => [t.key, t])
);
const deps: ValidationDeps = { runSql: sqlJsRunner, runPython: runLocalPython, templates, skillNames: new Set(["SQL", "Python"]), careerKeys: new Set(["data-analyst"]) };

const base = {
  track: "domain", title: "A test challenge", category: "Test", difficulty: "easy", estMinutes: 10, template: "qf", ticketBrief: "Context for the test challenge, long enough.",
  skills: ["SQL"], careers: ["data-analyst"], steps: [{ title: "Do it", instruction: "Do the thing." }],
};
const spec = (over: Record<string, unknown>) => ChallengeSpec.parse({ key: "test-challenge", ...base, ...over });

const choice = { key: "q1", type: "CHOICE_ANSWER", label: "Q1", config: { correct: "b", public: { prompt: "Pick", options: ["a", "b", "c"] } } };

describe("validateSpec", () => {
  it("accepts a solvable question challenge", async () => {
    const r = await validateSpec(spec({ checks: [choice], reference: { answers: { q1: "b" } }, wrong: { answers: { q1: "a" } } }), deps);
    expect(r).toMatchObject({ ok: true, errors: [], evidenceStatus: "VERIFIED_AUTOMATED" });
  });

  it("rejects a reference that does not pass its own checks", async () => {
    const r = await validateSpec(spec({ checks: [choice], reference: { answers: { q1: "a" } } }), deps);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/reference solution fails check "q1"/);
  });

  it("rejects a wrong submission that passes", async () => {
    const r = await validateSpec(spec({ checks: [choice], reference: { answers: { q1: "b" } }, wrong: { answers: { q1: "b" } } }), deps);
    expect(r.errors.join(" ")).toMatch(/wrong.*passes/);
  });

  it("rejects an answer that is not among the options, and a check the workstation cannot collect", async () => {
    const bad = { ...choice, config: { correct: "z", public: { prompt: "p", options: ["a", "b"] } } };
    expect((await validateSpec(spec({ checks: [bad], reference: {} }), deps)).errors.join(" ")).toMatch(/must be one of the options/);
    const wrongType = { key: "n1", type: "NUMERIC_ANSWER", label: "n", config: { expected: 1 } };
    expect((await validateSpec(spec({ checks: [wrongType], reference: {} }), deps)).errors.join(" ")).toMatch(/QUESTION_FLOW cannot collect/);
  });

  it("flags unknown skills, careers and templates", async () => {
    const r = await validateSpec(spec({ checks: [choice], reference: { answers: { q1: "b" } }, skills: ["Nope"], careers: ["ghost"], template: "missing" }), deps);
    expect(r.errors.join(" ")).toMatch(/Unknown or inactive skill "Nope"/);
    expect(r.errors.join(" ")).toMatch(/Unknown career "ghost"/);
    expect(r.errors.join(" ")).toMatch(/Unknown workstation template "missing"/);
  });

  it("validates a SQL challenge by running the ground truth and the reference query", async () => {
    const sql = {
      template: "sql", assets: { seedSql: "create table t(x integer); insert into t values (1),(2),(3);" },
      checks: [{ key: "s1", type: "QUERY_RESULT", label: "Sum", config: { groundTruthQuery: "select sum(x) as total from t", public: { prompt: "Sum x" } } }],
    };
    const ok = await validateSpec(spec({ ...sql, reference: { queries: { s1: "select sum(x) as s from t" } }, wrong: { queries: { s1: "select count(*) from t" } } }), deps);
    expect(ok).toMatchObject({ ok: true, evidenceStatus: "VERIFIED_AUTOMATED" });
    const broken = await validateSpec(spec({ ...sql, checks: [{ ...sql.checks[0], config: { groundTruthQuery: "select * from nowhere" } }], reference: {} }), deps);
    expect(broken.errors.join(" ")).toMatch(/ground-truth query fails/);
    const empty = await validateSpec(spec({ ...sql, checks: [{ ...sql.checks[0], config: { groundTruthQuery: "select x from t where x > 99" } }], reference: {} }), deps);
    expect(empty.errors.join(" ")).toMatch(/returns no rows/);
  });

  it("warns when a pass would be UNVERIFIED (browser-reported checks)", async () => {
    const dom = { key: "d1", type: "DOM_ASSERTION", label: "h1", config: { public: { assert: { selector: "h1" } } } };
    const file = { key: "f1", type: "FILE_STATE", label: "has h1", config: { path: "index.html", contains: ["<h1>"] } };
    const r = await validateSpec(spec({ template: "files", checks: [dom, file], reference: { files: { "index.html": "<h1>x</h1>" }, reported: { d1: true } } }), deps);
    expect(r).toMatchObject({ ok: true, evidenceStatus: "UNVERIFIED" });
    expect(r.warnings.join(" ")).toMatch(/UNVERIFIED/);
  });
});

const hasPython = await runLocalPython("print(1)").then((r) => r.stdout.trim() === "1").catch(() => false);
describe.skipIf(!hasPython)("notebook references", () => {
  const nb = {
    template: "nb",
    assets: { files: { "data.csv": "v\n2\n4\n6\n" }, cells: ["x = None"] },
    checks: [{ key: "m", type: "NUMERIC_ANSWER", label: "Mean", config: { expected: 4, public: { variable: "mean_value" } } }],
  };
  it("runs the reference cells and uses the variable they produce", async () => {
    const ref = { cells: ["rows = [float(r) for r in open('data.csv').read().split()[1:]]\nmean_value = sum(rows) / len(rows)"] };
    expect((await validateSpec(spec({ ...nb, reference: ref }), deps)).ok).toBe(true);
  });
  it("fails when the reference cells give the wrong value or crash", async () => {
    expect((await validateSpec(spec({ ...nb, reference: { cells: ["mean_value = 5"] } }), deps)).ok).toBe(false);
    expect((await validateSpec(spec({ ...nb, reference: { cells: ["raise ValueError('x')"] } }), deps)).errors.join(" ")).toMatch(/failed to run/);
  });
  it("builds a program that mounts the files first", () => {
    expect(notebookProgram(spec({ ...nb, reference: {} }), ["a = 1"]).source).toContain('open("data.csv", "w")');
  });
});

describe("spec rules", () => {
  it("requires careers for domain, branches for stream, and provenance for seed content", () => {
    expect(() => spec({ checks: [choice], reference: {}, careers: [] })).toThrow(/career/);
    expect(() => spec({ track: "stream", careers: [], branches: [], checks: [choice], reference: {} })).toThrow(/branch/);
    expect(() => spec({ checks: [choice], reference: {}, isSeed: true })).toThrow(/provenance/);
  });
  it("rejects duplicate check keys and a step that does not exist", () => {
    expect(() => spec({ checks: [choice, choice], reference: {} })).toThrow(/Duplicate/);
    expect(() => spec({ checks: [{ ...choice, step: 3 }], reference: {} })).toThrow(/step 3/);
  });
});

describe("specHash", () => {
  it("ignores key order and changes with content", () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    expect(specHash({ a: 1, b: 2 })).toBe(specHash({ b: 2, a: 1 }));
    expect(specHash({ a: 1 })).not.toBe(specHash({ a: 2 }));
  });
});

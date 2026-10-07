import { describe, expect, it, vi } from "vitest";
import { effectiveVerification, evaluateCheck, SubmissionSchema, type CheckContext, type CheckRow } from "./checks";

const sub = (over: Record<string, unknown> = {}) => SubmissionSchema.parse(over);
const check = (over: Partial<CheckRow>): CheckRow => ({ id: "c1", stepId: null, checkType: "NUMERIC_ANSWER", label: "l", config: {}, visible: true, weight: 1, verification: "SERVER", ...over });
const ctx = (over: Partial<CheckContext> = {}): CheckContext => ({ assets: null, runSql: vi.fn(), ...over });

describe("NUMERIC_ANSWER", () => {
  const c = check({ config: { expected: 1250, tolerancePct: 1 } });
  it("accepts a value within tolerance, with units and separators", async () => {
    expect(await evaluateCheck(c, sub({ answers: { c1: "1,255 N" } }), ctx())).toBe(true);
    expect(await evaluateCheck(c, sub({ answers: { c1: 1250 } }), ctx())).toBe(true);
  });
  it("rejects outside tolerance, missing, or non-numeric", async () => {
    expect(await evaluateCheck(c, sub({ answers: { c1: "1300" } }), ctx())).toBe(false);
    expect(await evaluateCheck(c, sub(), ctx())).toBe(false);
    expect(await evaluateCheck(c, sub({ answers: { c1: "abc" } }), ctx())).toBe(false);
  });
});

describe("CHOICE_ANSWER", () => {
  it("needs exactly the correct set", async () => {
    const c = check({ checkType: "CHOICE_ANSWER", config: { correct: ["a", "c"] } });
    expect(await evaluateCheck(c, sub({ answers: { c1: ["c", "a"] } }), ctx())).toBe(true);
    expect(await evaluateCheck(c, sub({ answers: { c1: ["a"] } }), ctx())).toBe(false);
    expect(await evaluateCheck(c, sub({ answers: { c1: ["a", "b", "c"] } }), ctx())).toBe(false);
  });
  it("handles a single correct answer", async () => {
    const c = check({ checkType: "CHOICE_ANSWER", config: { correct: "b" } });
    expect(await evaluateCheck(c, sub({ answers: { c1: "b" } }), ctx())).toBe(true);
    expect(await evaluateCheck(c, sub({ answers: { c1: "x" } }), ctx())).toBe(false);
  });
});

describe("OUTPUT_MATCH", () => {
  const c = check({ checkType: "OUTPUT_MATCH", config: { expected: "42\nok" } });
  it("ignores trailing whitespace and CRLF", async () => expect(await evaluateCheck(c, sub({ answers: { c1: "42\r\nok\n" } }), ctx())).toBe(true));
  it("fails on a different output", async () => expect(await evaluateCheck(c, sub({ answers: { c1: "43\nok" } }), ctx())).toBe(false));
});

describe("FILE_STATE", () => {
  const c = check({ checkType: "FILE_STATE", config: { path: "index.html", contains: ["<h1>"], notContains: ["TODO"], regex: "<title>.+</title>" } });
  it("passes when every condition holds", async () => expect(await evaluateCheck(c, sub({ files: { "index.html": "<title>x</title><h1>Hi</h1>" } }), ctx())).toBe(true));
  it("fails on a missing file, a forbidden string, or a missing required one", async () => {
    expect(await evaluateCheck(c, sub(), ctx())).toBe(false);
    expect(await evaluateCheck(c, sub({ files: { "index.html": "<title>x</title><h1>TODO</h1>" } }), ctx())).toBe(false);
    expect(await evaluateCheck(c, sub({ files: { "index.html": "<title>x</title>" } }), ctx())).toBe(false);
  });
  it("fails closed on a malformed regex", async () => expect(await evaluateCheck(check({ checkType: "FILE_STATE", config: { path: "a", regex: "(" } }), sub({ files: { a: "x" } }), ctx())).toBe(false));
});

describe("TERMINAL_OUTPUT", () => {
  it("matches the transcript against the pattern and is server-verifiable", async () => {
    const c = check({ checkType: "TERMINAL_OUTPUT", config: { matches: "active \\(running\\)" } });
    expect(await evaluateCheck(c, sub({ terminal: { c1: "Active: active (running) since" } }), ctx())).toBe(true);
    expect(await evaluateCheck(c, sub({ terminal: { c1: "inactive" } }), ctx())).toBe(false);
    expect(effectiveVerification(c)).toBe("SERVER");
  });
  it("falls back to a self-reported result (CLIENT) when no pattern is configured", async () => {
    const c = check({ checkType: "TERMINAL_OUTPUT", config: {} });
    expect(await evaluateCheck(c, sub({ reported: { c1: true } }), ctx())).toBe(true);
    expect(effectiveVerification(c)).toBe("CLIENT");
  });
});

describe("QUERY_RESULT", () => {
  const c = check({ checkType: "QUERY_RESULT", config: { groundTruthQuery: "SELECT 1" } });
  const rows = (n: number) => ({ columns: ["n"], rows: [[n]], truncated: false });
  it("runs the truth and the student's query on the seed and compares them", async () => {
    const runSql = vi.fn().mockResolvedValue([rows(5), rows(5)]);
    expect(await evaluateCheck(c, sub({ queries: { c1: "SELECT count(*) FROM t" } }), ctx({ assets: { seedSql: "create table t(x)" }, runSql }))).toBe(true);
    expect(runSql).toHaveBeenCalledWith("create table t(x)", ["SELECT 1", "SELECT count(*) FROM t"]);
  });
  it("fails on a different result, an error, or no query", async () => {
    expect(await evaluateCheck(c, sub({ queries: { c1: "x" } }), ctx({ assets: { seedSql: "s" }, runSql: vi.fn().mockResolvedValue([rows(5), rows(6)]) }))).toBe(false);
    expect(await evaluateCheck(c, sub({ queries: { c1: "x" } }), ctx({ assets: { seedSql: "s" }, runSql: vi.fn().mockResolvedValue([rows(5), { error: "no such table" }]) }))).toBe(false);
    expect(await evaluateCheck(c, sub(), ctx({ assets: { seedSql: "s" } }))).toBe(false);
  });
  it("fails when the challenge has no seed", async () => expect(await evaluateCheck(c, sub({ queries: { c1: "x" } }), ctx())).toBe(false));
});

describe("browser-reported checks", () => {
  it("TEST_RUN and DOM_ASSERTION pass only on a reported true and are always CLIENT-verified", async () => {
    for (const checkType of ["TEST_RUN", "DOM_ASSERTION"] as const) {
      const c = check({ checkType, verification: "SERVER" });
      expect(await evaluateCheck(c, sub({ reported: { c1: true } }), ctx())).toBe(true);
      expect(await evaluateCheck(c, sub({ reported: { c1: false } }), ctx())).toBe(false);
      expect(await evaluateCheck(c, sub(), ctx())).toBe(false);
      expect(effectiveVerification(c)).toBe("CLIENT");
    }
  });
});

describe("SubmissionSchema", () => {
  it("rejects oversized files", () => expect(SubmissionSchema.safeParse({ files: { a: "x".repeat(200_001) } }).success).toBe(false));
});

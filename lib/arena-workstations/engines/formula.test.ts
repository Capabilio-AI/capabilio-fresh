import { describe, expect, it } from "vitest";
import { address, columnIndex, columnLetters, evaluateSheet, formulaReferencesCells, parseFormula } from "./formula";

const ev = (sheet: Record<string, string>, cell: string) => evaluateSheet(sheet)[cell];

describe("formula engine", () => {
  it("converts column letters both ways", () => {
    expect(columnIndex("A")).toBe(0);
    expect(columnIndex("Z")).toBe(25);
    expect(columnIndex("AA")).toBe(26);
    expect(columnLetters(27)).toBe("AB");
    expect(address(2, 9)).toBe("C10");
  });

  it("does arithmetic with correct precedence", () => {
    expect(ev({ A1: "=2+3*4" }, "A1")).toBe(14);
    expect(ev({ A1: "=(2+3)*4" }, "A1")).toBe(20);
    expect(ev({ A1: "=2^3^2" }, "A1")).toBe(512);
    expect(ev({ A1: "=-2^2" }, "A1")).toBe(4);
    expect(ev({ A1: "=50%" }, "A1")).toBe(0.5);
  });

  it("resolves references and ranges", () => {
    const sheet = { A1: "10", A2: "20", A3: "30", B1: "=A1*2", B2: "=SUM(A1:A3)", B3: "=AVERAGE(A1:A3)", B4: "=MAX(A1:A3)-MIN(A1:A3)" };
    const out = evaluateSheet(sheet);
    expect(out.B1).toBe(20);
    expect(out.B2).toBe(60);
    expect(out.B3).toBe(20);
    expect(out.B4).toBe(20);
  });

  it("supports conditional aggregation", () => {
    const sheet = { A1: "Delhi", A2: "Pune", A3: "delhi", B1: "100", B2: "50", B3: "25", C1: '=SUMIF(A1:A3,"Delhi",B1:B3)', C2: '=COUNTIF(B1:B3,">40")', C3: '=AVERAGEIF(A1:A3,"delhi",B1:B3)' };
    const out = evaluateSheet(sheet);
    expect(out.C1).toBe(125);
    expect(out.C2).toBe(2);
    expect(out.C3).toBe(62.5);
  });

  it("supports IF, ROUND, IFERROR and VLOOKUP", () => {
    const sheet = { A1: "P1", A2: "P2", B1: "499", B2: "999", C1: '=VLOOKUP("p2",A1:B2,2,FALSE)', C2: '=IF(B1>500,"High","Low")', C3: "=ROUND(2/3,2)", C4: '=IFERROR(1/0,"n/a")', C5: '=VLOOKUP("P9",A1:B2,2,FALSE)' };
    const out = evaluateSheet(sheet);
    expect(out.C1).toBe(999);
    expect(out.C2).toBe("Low");
    expect(out.C3).toBe(0.67);
    expect(out.C4).toBe("n/a");
    expect(out.C5).toEqual({ error: "#N/A" });
  });

  it("reports errors instead of throwing", () => {
    expect(ev({ A1: "=1/0" }, "A1")).toEqual({ error: "#DIV/0!" });
    expect(ev({ A1: "=FOO(1)" }, "A1")).toEqual({ error: "#NAME?" });
    expect(ev({ A1: "=1+" }, "A1")).toEqual({ error: "#ERROR!" });
    expect(ev({ A1: "=B1", B1: "=A1" }, "A1")).toEqual({ error: "#CIRC!" });
    expect(ev({ A1: '="a"*2' }, "A1")).toEqual({ error: "#VALUE!" });
  });

  it("treats plain text and numbers as literals", () => {
    expect(ev({ A1: "1,250" }, "A1")).toBe(1250);
    expect(ev({ A1: "Mumbai" }, "A1")).toBe("Mumbai");
    expect(ev({ A1: "" }, "A1")).toBeNull();
  });

  it("cannot execute arbitrary code", () => {
    expect(() => parseFormula("constructor.constructor('x')()")).toThrow();
    expect(ev({ A1: "=__proto__(1)" }, "A1")).toEqual({ error: "#NAME?" });
    expect(ev({ A1: "=constructor" }, "A1")).toEqual({ error: "#ERROR!" });
  });

  it("detects hardcoded values vs formulas that reference cells", () => {
    expect(formulaReferencesCells("=B2*C2")).toBe(true);
    expect(formulaReferencesCells("=SUM(B2:B9)")).toBe(true);
    expect(formulaReferencesCells("=1200")).toBe(false);
    expect(formulaReferencesCells("1200")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { address, columnIndex, columnLetters, evaluateSheet, formulaReferencesCells, parseFormula, shiftFormulaRows } from "./formula";

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

  it("shifts relative rows for fill-down, leaving anchors and strings alone", () => {
    expect(shiftFormulaRows("=C2*D2", 3)).toBe("=C5*D5");
    expect(shiftFormulaRows("=VLOOKUP(B2,$H$2:$I$4,2,FALSE)", 1)).toBe("=VLOOKUP(B3,$H$2:$I$4,2,FALSE)");
    expect(shiftFormulaRows('=IF(A2="B2","x",A$2)', 2)).toBe('=IF(A4="B2","x",A$2)');
    expect(shiftFormulaRows("=ROUND(C2/D2,2)", 1)).toBe("=ROUND(C3/D3,2)");
    expect(shiftFormulaRows("120", 5)).toBe("120");
  });

  it("detects hardcoded values vs formulas that reference cells", () => {
    expect(formulaReferencesCells("=B2*C2")).toBe(true);
    expect(formulaReferencesCells("=SUM(B2:B9)")).toBe(true);
    expect(formulaReferencesCells("=1200")).toBe(false);
    expect(formulaReferencesCells("1200")).toBe(false);
  });
});

describe("analyst functions: statistics, multi-criteria and lookups", () => {
  const sheet = {
    A1: "North", A2: "South", A3: "North", A4: "East", A5: "North",
    B1: "app", B2: "web", B3: "web", B4: "app", B5: "app",
    C1: "10", C2: "20", C3: "30", C4: "40", C5: "50",
  };
  const e = (f: string) => ev({ ...sheet, Z1: f }, "Z1");

  it("MEDIAN and STDEV match the textbook values", () => {
    expect(e("=MEDIAN(C1:C5)")).toBe(30);
    expect(e("=MEDIAN(C1:C4)")).toBe(25);
    expect(e("=STDEV(C1:C5)")).toBeCloseTo(15.8114, 3);
    expect(e("=STDEV(C1)")).toEqual({ error: "#DIV/0!" });
  });

  it("SUMIFS, COUNTIFS and AVERAGEIFS need every criterion to hold", () => {
    expect(e('=SUMIFS(C1:C5,A1:A5,"North",B1:B5,"app")')).toBe(60);
    expect(e('=COUNTIFS(A1:A5,"North",B1:B5,"web")')).toBe(1);
    expect(e('=COUNTIFS(A1:A5,"North",C1:C5,">15")')).toBe(2);
    expect(e('=AVERAGEIFS(C1:C5,A1:A5,"North",B1:B5,"app")')).toBe(30);
    expect(e('=AVERAGEIFS(C1:C5,A1:A5,"West")')).toEqual({ error: "#DIV/0!" });
    expect(e('=SUMIFS(C1:C5,A1:A5)')).toEqual({ error: "#VALUE!" });
  });

  it("INDEX with MATCH finds a value by key, and XLOOKUP does it in one step", () => {
    expect(e('=INDEX(C1:C5,MATCH("East",A1:A5,0))')).toBe(40);
    expect(e('=XLOOKUP("South",A1:A5,C1:C5)')).toBe(20);
    expect(e('=XLOOKUP("West",A1:A5,C1:C5,"none")')).toBe("none");
    expect(e('=XLOOKUP("West",A1:A5,C1:C5)')).toEqual({ error: "#N/A" });
    expect(e('=MATCH("West",A1:A5,0)')).toEqual({ error: "#N/A" });
    expect(e("=INDEX(A1:C5,2,3)")).toBe(20);
    expect(e("=INDEX(C1:C5,9)")).toEqual({ error: "#REF!" });
  });

  it("MATCH accepts only the exact-match form and says so instead of guessing", () => {
    expect(e('=MATCH("North",A1:A5,1)')).toEqual({ error: "#VALUE!" });
  });
});

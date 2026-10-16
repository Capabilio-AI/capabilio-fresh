import { describe, expect, it } from "vitest";
import { decideOutcome, describeSubmission, effortCap, finalScore, MAX_ATTEMPTS, PASS_SCORE, QUESTION_COUNT } from "./explain";

describe("describeSubmission", () => {
  it("shows an SQL query as the user wrote it", () => {
    expect(describeSubmission("sql_workspace", { query: "SELECT 1 FROM orders", note: "checked the dates" })).toBe("SQL they wrote:\nSELECT 1 FROM orders\n\nNote they left: checked the dates");
  });

  it("lists cleaning steps in words, and the findings of an investigation with their note", () => {
    expect(describeSubmission("cleaning_workspace", { steps: [{ op: "trim", column: "city" }, { op: "to_number", column: "amount" }] })).toContain("1. trim on city");
    const found = describeSubmission("investigation_workspace", { answers: { dimension: "channel", value: "app", impact: 1234.5 }, note: "app cancellations spiked" });
    expect(found).toContain("dimension: channel");
    expect(found).toContain("value: app");
    expect(found).toContain("Note they left: app cancellations spiked");
  });

  it("shows the formulas of a spreadsheet and keeps anything long within a limit", () => {
    expect(describeSubmission("spreadsheet_workspace", { cells: { E2: "=C2*D2", E3: "=C3*D3" } })).toContain("E2: =C2*D2");
    expect(describeSubmission("sql_workspace", { query: "x".repeat(9000) }).length).toBeLessThan(2500);
  });

  it("copes with a shape it does not know", () => {
    expect(describeSubmission("something_new", { a: 1 })).toContain('"a": 1');
    expect(describeSubmission("sql_workspace", null)).toBe("");
  });
});

describe("effortCap", () => {
  const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
  it("caps the score of answers that are blank or only a few words, and leaves real answers alone", () => {
    expect(effortCap(["", "", "", ""])).toBe(0);
    expect(effortCap(["idk", "no", "ok", "yes"])).toBeLessThanOrEqual(30);
    expect(effortCap([words(12), words(12), words(12), words(12)])).toBe(100);
  });
});

describe("finalScore", () => {
  it("takes the AI score but never above what the effort allows, and keeps it within 0 to 100", () => {
    expect(finalScore(90, ["", "", "", ""])).toBe(0);
    expect(finalScore(250, [Array(40).fill("w").join(" "), "a b c d e f g h i j", "a b c d e f g h i j", "a b c d e f g h i j"])).toBe(100);
    expect(finalScore(-5, ["x y z"])).toBe(0);
  });
});

describe("decideOutcome", () => {
  it("awards the rating at the pass mark, gives one more try after a miss, then closes without a rating", () => {
    expect(QUESTION_COUNT).toBe(4);
    expect(MAX_ATTEMPTS).toBe(2);
    expect(decideOutcome(PASS_SCORE, 1)).toBe("award");
    expect(decideOutcome(PASS_SCORE - 1, 1)).toBe("retry");
    expect(decideOutcome(PASS_SCORE - 1, 2)).toBe("close");
    expect(decideOutcome(100, 2)).toBe("award");
  });
});

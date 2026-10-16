import { describe, expect, it } from "vitest";
import { areasForLevel } from "./areas";

const ALL = ["sql", "spreadsheet", "debugging", "investigation", "incident"];

describe("areasForLevel", () => {
  it("keeps the everyday skill areas for everyone and holds back the demanding ones until the user has the experience", () => {
    expect(areasForLevel(ALL, "fresher")).toEqual(["sql", "spreadsheet", "debugging"]);
    expect(areasForLevel(ALL, "junior")).toEqual(["sql", "spreadsheet", "debugging", "investigation"]);
    expect(areasForLevel(ALL, "mid")).toEqual(ALL);
    expect(areasForLevel(ALL, "senior")).toEqual(ALL);
  });

  it("never leaves a role with nothing to serve", () => {
    expect(areasForLevel(["incident"], "fresher")).toEqual(["incident"]);
    expect(areasForLevel([], "fresher")).toEqual([]);
  });
});

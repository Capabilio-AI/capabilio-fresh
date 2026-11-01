import { describe, expect, it } from "vitest";
import { areasForLevel } from "./areas";

const ALL = ["sql", "spreadsheet", "debugging", "investigation", "incident"];

describe("areasForLevel", () => {
  it("serves every Data Analyst area to everyone, since investigation and incidents have guided entry-level tickets", () => {
    expect(areasForLevel(ALL, "fresher")).toEqual(ALL);
    expect(areasForLevel(ALL, "junior")).toEqual(ALL);
  });

  it("still holds back an area that has no entry-level tickets until the user has the experience", () => {
    expect(areasForLevel(["sql", "pipeline-debugging"], "fresher")).toEqual(["sql"]);
    expect(areasForLevel(["sql", "pipeline-debugging"], "junior")).toEqual(["sql", "pipeline-debugging"]);
  });

  it("never leaves a role with nothing to serve", () => {
    expect(areasForLevel(["incident"], "fresher")).toEqual(["incident"]);
    expect(areasForLevel([], "fresher")).toEqual([]);
  });
});

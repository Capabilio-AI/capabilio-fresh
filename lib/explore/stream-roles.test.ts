import { describe, expect, it } from "vitest";
import { cleanTitles } from "./stream-roles";

describe("cleanTitles", () => {
  it("drops repeats and seniority words, keeping order", () => {
    expect(cleanTitles(["Site Engineer", "site engineer", "Senior Structural Design Engineer", "QA", "Quantity Surveyor"])).toEqual(["Site Engineer", "Structural Design Engineer", "Quantity Surveyor"]);
  });
});

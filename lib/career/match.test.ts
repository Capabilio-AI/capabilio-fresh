import { describe, expect, test } from "vitest";
import { interestForRole } from "./match";

describe("interestForRole", () => {
  test("matches distribution keys case-insensitively", () => {
    expect(interestForRole("Software Engineer", { "software engineer": 90 }, null)).toBe(90);
  });
  test("treats developer as engineer for the stated role", () => {
    expect(interestForRole("Software Engineer", {}, "Software Developer")).toBe(90);
  });
  test("returns 0 for unrelated roles", () => {
    expect(interestForRole("Data Analyst", { "software engineer": 90 }, "Software Developer")).toBe(0);
  });
});
